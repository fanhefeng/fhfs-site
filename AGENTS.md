<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Commands

```bash
pnpm check        # tsc + oxlint + prettier --check + vitest with its coverage floor — the gate
pnpm test         # vitest over src/lib (src/lib/__tests__); test:coverage adds the floor
pnpm format       # prettier --write (pinned version, printWidth 100)
pnpm dev          # dev server
pnpm build        # prerenders from the DB — fails loudly on a missing/malformed env var (src/lib/env.ts)
pnpm smoke [url]  # every page in the sitemap, in this machine's Chrome: 4xx, exceptions, console/CSP errors
pnpm assets       # after touching public/: re-hash, rewrite assets.gen.json + yozai.css
pnpm media:music <src> <name>   # encode a record the way the others were, report loop silence
pnpm db:generate  # after editing src/db/schema.ts, then:
pnpm db:migrate
pnpm db:check     # print what's actually in each table
pnpm db:export    # write DB back to backup/
pnpm db:import    # restore from backup/ (upsert by key, one batch per table; save once in /admin after to flush caches; in dev `rm -rf .next/dev/cache/fetch-cache` + restart does the same — Next 16 keeps the dev data cache under .next/dev, not .next/cache)
```

Tests cover pure functions in `src/lib`, plus a set that reads the *source*
rather than running it — the rules that break without an error:
`conventions.test.ts` (pages start from `pageLocale`, the database is read
only in `content.ts` and only inside `unstable_cache`, every admin action
checks the session first and invalidates last, every ease is an `EASE`
token), `asset.test.ts`,
`media.test.ts` (sizes written in code against the files), `tables.test.ts`
(every schema table named in db:check / export / import / backup),
`env.test.ts`, `messages.test.ts`, `copy.test.ts` (every namespace in the
catalogue has a card in `COPY_GROUPS`), `lab.test.ts` (every lab study's
`sources` exist under `src/`, and it has copy in both catalogues). When you
add a rule of that kind to this file, add its check there. There is no component suite; `pnpm smoke` is the
end-to-end pass. The scripts share `scripts/connect.mts` (env, unpooled URL,
the same connection-level retry as the site, with more patient delays); a new
script calls `connect()` rather than building its own handle. `pnpm lint` runs
the project-local oxlint (`.oxlintrc.json`); `gsap` may only be imported via
`@/lib/gsap` (a lint rule). TypeScript runs with `noUncheckedIndexedAccess`:
use `!` where a loop bound or a fixed table proves the index, narrow
otherwise. CI (`.github/workflows/check.yml`) runs `pnpm check` and
`pnpm audit`, then a second job builds against a read-only database role
(`ci_readonly`) and runs the smoke test; both on Node 24 (`.node-version`,
`engines`). Hooks in `.githooks/` (installed by `pnpm install`): pre-commit
regenerates the asset manifest when `public/` changed and checks format and
lint on staged files; pre-push runs `pnpm check`. This machine's Node and
global JS CLIs are managed by `vp`, not npm/nvm.

The one read from outside the database is `src/lib/github.ts`: each app's
version badge is its repo's latest GitHub release, cached through `fetch`
(`next: { revalidate: 3600 }`), so pages that show one regenerate hourly.
Failures resolve to `null` and the badge is simply absent.

# Architecture

- **Routing**: public pages live under `src/app/[locale]/` (locales `zh`/`en`,
  default `zh`, `localePrefix: "always"`). Every page starts with
  `const locale = await pageLocale(params)` (`src/i18n/page.ts`): it 404s an
  unknown locale and calls `setRequestLocale` — skip it and the page quietly
  turns dynamic. `/admin` sits *outside* the locale tree and is a
  browser-based editor for all content; admin sessions are jose-signed JWTs.
- **Client messages**: the layout hands `NextIntlClientProvider` only the
  namespaces in `CLIENT_NAMESPACES` (`src/lib/messages.ts`); without the cut
  every page carried the whole catalogue in its RSC payload. A client
  component that reads a new namespace with `useTranslations` must add it
  there — `messages.test.ts` scans the source and fails otherwise. Server
  components read everything through `getTranslations` as before.
- **`src/proxy.ts` is the middleware** (Next 16's name for it). It must handle
  `/admin` and return *before* the next-intl middleware runs, or `/admin` gets
  locale-redirected to a route that doesn't exist. Its session check is
  deliberately optimistic — the real authorization boundary is
  `requireAdmin()` at the top of every Server Action.
- **Writes**: every admin write lives in `src/app/admin/actions/`, one file per
  table with the shared pieces in `shared.ts`; each starts
  with a session check, and ends with `updateTag` — never `revalidateTag`,
  which would serve the stale copy to the very person who just pressed save.
  An action that reports to a form checks with `adminSession()` and returns
  `SESSION_EXPIRED` (a throw would unmount the editor with its unsaved text);
  the delete actions keep the throwing `requireAdmin()`. Field parsing and
  validation (`validKey`, `validDate`, `validLink`, …) live in
  `src/lib/forms.ts`, where they are unit-tested — add a rule there, not
  inline. The "new" forms send `isNew`, and the action then refuses an
  existing key instead of upserting over it — for the tables saved by `key`
  that is `upsertKeyed(table, row, isNew)` in `shared.ts`.
  `conventions.test.ts` checks the session-first, invalidate-last shape of
  every action.
- **Environment and origin**: every variable is described in
  `src/lib/env.ts` and documented in `.env.example` (a test keeps them in
  step); a new `process.env.X` needs a rule there. `site.url` comes from the
  deployment (`src/lib/siteUrl.ts`: `SITE_URL`, else Vercel's production
  domain) — never hard-code the origin.
- **Security headers**: the CSP lives in `src/lib/csp.ts` and is sent from
  `next.config.ts`. It allows nothing cross-origin; a new third-party script,
  font, frame or fetch has to be added there, and `pnpm smoke` is how you find
  out you forgot.
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
  come from its `EASE` token table, named by use — a new curve gets a token
  there first; an `ease: "…"` string anywhere else fails
  `conventions.test.ts`. `prefersReducedMotion` gates only the
  short no-stop-button list documented there. Lenis inertial scrolling shares
  GSAP's clock (`gsap.ticker` drives `lenis.raf`).
- **3D**: `/intro` and the statue on `/idols/kobe` use @react-three/fiber +
  drei; the moss on the home page (`components/grove`) and the workbench —
  now a lab study, `/lab/workstation`, no longer on `/about` — are imperative
  three.js. Every scene sits behind `next/dynamic`, and the component that
  mounts it asks `prefersSaveData()` / `hasWebGL()` (`src/lib/three/guards.ts`)
  *before* mounting: a guard inside the chunk runs after three.js has already
  been downloaded.
- **Admin forms** submit through `useSaveAction` (`src/app/admin/ui/`), never
  `useActionState` directly: React resets a `<form action>` when its action
  returns, an error included, and these forms are uncontrolled — the reset is
  the unsaved article. `conventions.test.ts` checks it.
- **Script budget**: `pnpm smoke` weighs every page's scripts against the
  table in `scripts/smoke.mts` (production builds only) and fails the page
  that goes over. Raise a number there on purpose, in the commit that spends it.
- **Static assets in `public/`** are reached through `asset()`
  (`src/lib/asset.ts`), which puts the file's content hash in the address —
  `/lab/lens/sea.c694b7cb.jpg`; a rewrite in `next.config.ts` serves it from
  the plain file, and only the hashed address is cached for a year
  (`src/lib/immutable.ts` has the folder lists and the address shapes). After
  adding, replacing or removing a file there, run `pnpm assets` and commit
  `src/lib/assets.gen.json` (and `src/app/yozai.css`, whose font URLs it
  rewrites); a new top-level folder goes into `IMMUTABLE_DIRS`. Tests fail on
  a stale manifest, an unlisted folder, or a path written without `asset()`.
  Only `src/app/[locale]/not-found.tsx` loads its stage through
  `next/dynamic`; a not-found boundary is bundled with its layout, so
  anything it imports statically ships with every page.
- **Board media**: a moment's pictures, voice notes and video posters are
  files in `public/moments/` (`moments.media`, a jsonb list — see
  `MomentMedia` in `src/lib/moments.ts`), named by their site path and
  hashed by `asset()` when the page renders; the videos themselves are too
  big for the repository and live in the Vercel Blob store `fhfs-media`,
  whose host is the one cross-origin entry in `csp.ts` (`media-src`). The
  admin writes the list one file per line (`parseMedia` in `src/lib/forms.ts`,
  unit-tested), and the save action refuses a site path the manifest does
  not know — put the file in `public/moments/`, run `pnpm assets`, then save.
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

`messages/*.json` holds the defaults for *all* copy — every one of the 885
lines. The `copy_blocks` table is an override layer merged in
`src/i18n/request.ts`, and it holds **only the lines that have been edited**:
no row means the file's line, and `zh` / `en` are nullable so a line rewritten
in one language leaves the other one following the file. An empty or
unreachable table must always leave the site reading as the files say.

`/admin/copy` is therefore built from the catalogue, not from the table
(`src/lib/copy.ts`, `copyCatalogue.ts`): every line is editable, grouped by
namespace, and **clearing a field restores the default** — it does not blank
the line. To make somewhere genuinely empty, the default itself has to be
empty (the footer's two time fragments are). A save writes the difference —
equal to the file means null, both languages null means the row is deleted —
and refuses a value whose ICU arguments or tags the default does not have,
since those throw on the public page, not in the editor. A new namespace in
the catalogue needs a card in `COPY_GROUPS`; `copy.test.ts` fails otherwise.
Lines nobody sees — an `aria-label`, an `alt`, an `sr-only` node — are marked
「读屏」 in the editor, because they are edited by a different measure (name
the thing, not the action; a name that flips with state reads as nonsense).
Keep the naming convention — `…Aria`, `…Alt` / `.alt` — and a new one marks
itself; a line that lands in one under another name goes in `COPY_SR_EXTRA`.
Rows left behind by a key renamed in the files are swept from the index page.

`pnpm db:export` writes the database back out to `backup/`, which is committed.
Content keeps a diffable history that way; keep it current after bulk edits.

That copy only moves when someone opens a pull request, so a nightly workflow
(`.github/workflows/backup.yml`) exports on its own and commits a snapshot to
the `db-snapshots` branch when the content changed. It is gated on
`scripts/db-snapshot-guard.mts`: a table that had rows and came back empty
fails the run rather than overwriting the last good snapshot — the reasoning,
and the pure function it calls, are in `src/lib/backup.ts`. A red `backup` run
is a real alarm. Restoring — a wrong edit, a lost project, a lost Neon account
and the three files that would have to change to move off Neon — is
`docs/RECOVERY.md`.
