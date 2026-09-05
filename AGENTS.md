<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Commands

```bash
pnpm check        # tsc --noEmit + oxlint + vitest — the gate; run before calling work done
pnpm test         # vitest over src/lib pure functions only (src/lib/__tests__)
pnpm dev          # dev server
pnpm build        # prerenders from the DB — DATABASE_URL required, fails loudly without
pnpm db:generate  # after editing src/db/schema.ts, then:
pnpm db:migrate
pnpm db:check     # print what's actually in each table
pnpm db:export    # write DB back to backup/
pnpm db:import    # restore from backup/ (upsert by key, one batch per table; save once in /admin after to flush caches; in dev `rm -rf .next/dev/cache/fetch-cache` + restart does the same)
```

Tests cover only pure functions in `src/lib`; there is no component or e2e
suite. The scripts share `scripts/connect.mts` (env, unpooled URL, the same
connection-level retry as the site, with more patient delays); a new script
calls `connect()` rather than building its own handle. `pnpm lint` runs the project-local oxlint (`.oxlintrc.json`) over
`src`, `scripts` and the config files; CI (`.github/workflows/check.yml`) runs
`pnpm check` on Node 24 (`.node-version`, `engines`). This machine's Node and
global JS CLIs are managed by `vp`, not npm/nvm.

The one read from outside the database is `src/lib/github.ts`: each app's
version badge is its repo's latest GitHub release, cached through `fetch`
(`next: { revalidate: 3600 }`), so pages that show one regenerate hourly.
Failures resolve to `null` and the badge is simply absent.

# Architecture

- **Routing**: public pages live under `src/app/[locale]/` (locales `zh`/`en`,
  default `zh`, `localePrefix: "always"`). `/admin` sits *outside* the locale
  tree and is a browser-based editor for all content; admin sessions are
  jose-signed JWTs.
- **`src/proxy.ts` is the middleware** (Next 16's name for it). It must handle
  `/admin` and return *before* the next-intl middleware runs, or `/admin` gets
  locale-redirected to a route that doesn't exist. Its session check is
  deliberately optimistic — the real authorization boundary is
  `requireAdmin()` at the top of every Server Action.
- **Writes**: every admin write lives in `src/app/admin/actions.ts`, starts
  with a session check, and ends with `updateTag` — never `revalidateTag`,
  which would serve the stale copy to the very person who just pressed save.
  An action that reports to a form checks with `adminSession()` and returns
  `SESSION_EXPIRED` (a throw would unmount the editor with its unsaved text);
  the delete actions keep the throwing `requireAdmin()`. Field parsing and
  validation (`validKey`, `validDate`, `validLink`, …) live in
  `src/lib/forms.ts`, where they are unit-tested — add a rule there, not
  inline. The "new" forms send `isNew`, and the action then refuses an
  existing key instead of upserting over it.
- **Error boundaries**: `src/app/[locale]/error.tsx` (a page failing at
  request time — a cold database on an uncached path), `src/app/global-error.tsx`
  (the layout itself), `src/app/admin/error.tsx`. Keep them dependency-free;
  they must not be able to fail the way the page did.
- **Database**: Neon Postgres over the HTTP driver (`src/db/index.ts`) — no
  multi-statement transactions, and the schema is designed so none are needed
  (tags are array columns, saves are single upserts). Schema in
  `src/db/schema.ts`, migrations via drizzle-kit. The driver's `fetch` is
  wrapped in `src/db/index.ts` to retry a *connection-level* failure (the
  `fetch failed` a proxied network throws now and then); that is only safe
  because every statement is idempotent — keep writes as keyed upserts or
  deletes, never a plain insert into a serial-keyed table.
- **Animation**: all GSAP plugins are registered once in `src/lib/gsap.ts` —
  import `gsap` and plugins from there, never from `"gsap"` directly. Eases
  come from its `EASE` token table; `prefersReducedMotion` gates only the
  short no-stop-button list documented there. Lenis inertial scrolling shares
  GSAP's clock (`gsap.ticker` drives `lenis.raf`).
- **3D**: `/intro` uses @react-three/fiber + drei; the `/about` workbench is
  imperative three.js.
- **Front door and music**: the home page opens with `NeonSplash` once per
  session, on a hard landing only — decided before first paint by the inline
  script in `src/lib/splash.ts` (`<html data-splash>`), which is also what
  `OvertureLight` and `Opening` consult. The background music is one hidden
  player in the layout (`components/fx/Jukebox.tsx`) driven by the store in
  `src/lib/jukebox.ts`; the signs (splash, `/lab/neon`, the island's note)
  only write `wanted`. The sign's drawing lives in `src/components/neon/`.
- **Design source of truth**: `docs/DESIGN.md` — §5 (工程规则) is required
  reading before implementation work; `docs/INTRO3D.md` covers the `/intro`
  scene.

Two scroll gotchas that cost real debugging time (details in README.md):

- `html` must keep `scrollbar-gutter: stable`, or ScrollTrigger pins measured
  while the intro overlay locks `overflow` leave the page 15px horizontally
  scrollable.
- Taking over the wheel locally needs Lenis's own `data-lenis-prevent-wheel`
  attribute, enabled only while actually captured — `preventDefault()` alone
  does nothing, because Lenis's window-level listener never checks
  `defaultPrevented`.

# Content lives in Postgres

`src/lib/content.ts` is the only place the site reads content. Every getter is
wrapped in `unstable_cache` with tags and `revalidate: false`, which is what
lets a page stay statically prerendered while still being invalidatable — in a
prerender those tags are collected into the page's ISR entry, so `updateTag`
from a Server Action reaches the pages, the sitemap, the feed and the OG
images together. Two rules follow:

- **Never read the database outside that file**, and never leave a read
  uncached. An uncached read still renders correctly and then ignores every
  later edit, with no error to notice.
- **Never capture anything from module scope inside those cached functions.**
  `unstable_cache` keys on arguments but not on closures, so a shared constant
  bleeds across cache entries.

Cache Components (`cacheComponents: true` / `'use cache'`) is deliberately
off: a cached scope cannot see values passed through `React.cache`, which is
exactly how next-intl's `setRequestLocale` works, so `getTranslations()` inside
one throws.

`messages/*.json` holds the defaults for *all* copy. The `copy_blocks` table is
an override layer merged in `src/i18n/request.ts` — an empty or unreachable
table must always leave the site reading as the files say.

`pnpm db:export` writes the database back out to `backup/`, which is committed.
Content keeps a diffable history that way; keep it current after bulk edits.
