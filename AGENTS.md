<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Commands

```bash
pnpm check        # tsc + vp lint + vp fmt --check + vp test with its coverage floor — the gate
pnpm test         # vp test (Vitest) over src/lib (src/lib/__tests__); test:coverage adds the floor
pnpm format       # vp fmt (Oxfmt, printWidth 100)
pnpm dev          # dev server
pnpm build        # prerenders from the DB — fails loudly on a missing/malformed env var (src/config/env.ts)
pnpm smoke [url]  # every page in the sitemap, in this machine's Chrome: 4xx, exceptions, console/CSP errors
pnpm assets       # after touching public/: re-hash, rewrite assets.gen.json + font CSS
pnpm media:music <src> <name>   # encode a record the way the others were, report loop silence
pnpm db:generate  # after editing src/db/schema.ts, then:
pnpm db:migrate
pnpm db:check     # print what's actually in each table
pnpm db:export    # write DB back to backup/
pnpm db:import    # restore from backup/ (upsert by key, one batch per table; save once in /admin after to flush caches; in dev `rm -rf .next/dev/cache/fetch-cache` + restart does the same — Next 16 keeps the dev data cache under .next/dev, not .next/cache)
pnpm admin:password   # the admin's two secrets, or the hash of a password fed on stdin (never as an argument)
```

Tests cover pure functions in `src/lib`, plus a set that reads the *source*
rather than running it — the rules that break without an error:
`conventions.test.ts` (pages start from `pageLocale`, the database is read
only in `content.ts` and only inside `unstable_cache`, every admin action
checks the session first and invalidates last, every ease is an `EASE`
token, the accent face is never `font-serif` or `italic` and names its
weight at title sizes), `asset.test.ts`,
`media.test.ts` (sizes written in code against the files), `tables.test.ts`
(every schema table named in db:check / export / import / backup),
`env.test.ts`, `messages.test.ts`, `copy.test.ts` (every namespace in the
catalogue has a card in `COPY_GROUPS`), `lab.test.ts` (every lab study's
`sources` exist under `src/`, and it has copy in both catalogues),
`errorCopy.test.ts` (the global error boundary's copy says what the
catalogues say). When you
add a rule of that kind to this file, add its check there. There is no component suite; `pnpm smoke` is the
end-to-end pass. The scripts share `scripts/connect.mts` (env, unpooled URL,
the same connection-level retry as the site, with more patient delays); a new
script calls `connect()` rather than building its own handle. The toolchain is
Vite+ (`vite-plus`, the project-local `vp`): lint rules, format settings and
ignores, and the test config are all in `vite.config.ts` — there is no
`.oxlintrc.json`, `.prettierrc` or `vitest.config` — and tests import from
`vite-plus/test`, not `vitest` (a lint rule). `vp` does not build anything
here; `next build` does. Lint is type-aware (floating promises, unbound
methods, …); the type check itself stays `tsc`. `gsap` may only be imported via
`@/lib/client/gsap` (a lint rule). TypeScript runs with `noUncheckedIndexedAccess`:
use `!` where a loop bound or a fixed table proves the index, narrow
otherwise. CI (`.github/workflows/check.yml`) runs `pnpm check` and
`pnpm audit`, then a second job builds against a read-only database role
(`ci_readonly`) and runs the smoke test; both on Node 24 (`.node-version`,
`engines`). Hooks in `.githooks/` (installed by `pnpm install`): pre-commit
regenerates the asset manifest when `public/` changed and checks format and
lint on staged files; pre-push runs `pnpm check`. This machine's Node and
global JS CLIs are managed by `vp`, not npm/nvm.

The one read from outside the database is `src/lib/server/github.ts`: apps read
GitHub releases, publication dates, downloadable assets and Star/Fork counts.
`fetch` caches them hourly under a case-insensitive per-repo `github:*` tag.
`/api/github/webhook` verifies the original body with `GITHUB_WEBHOOK_SECRET`
before reading configured apps and expiring that repo's tag with
`revalidateTag(tag, { expire: 0 })` (Route Handlers cannot use `updateTag`).
Home and software also declare `revalidate = 3600`, including when every API
request failed at build time. GitHub failures omit only the unavailable data;
tag fallback is for a release's 404, never a rate limit or timeout. Parsing and
webhook/cache checks live in the `github*.test.ts` tests; setup: `docs/GITHUB-SYNC.md`.

# Architecture

- **Where a module lives says where it runs.** `src/lib/server/` never reaches
  the browser (the read layer, auth, OG images, markdown, SEO, the message
  cut); `src/lib/client/` never runs on the server (GSAP, the jukebox, scroll
  lock, the splash and overture, three's guards, the hooks); `src/lib/node/`
  is for scripts and tests (it reads the file system); the root of `src/lib`
  and its domain folders (`grove/`, `intro/`, `neon/`) are plain functions
  and data either side can import — except the few domain modules that draw
  on a canvas or mount WebGL (`grove/scene`, `grove/plates`,
  `grove/liquidMetalMount`, `intro/stickerTexture`), which stay beside their
  data and mark themselves with `client-only`. `src/config/` is what `next.config.ts`
  reads as well (`site`, `env`, `csp`, `immutable`). Client modules import
  `client-only` and server modules `server-only`, so a module imported on the
  wrong side is a build error — except the server ones a test, a script or the
  proxy loads directly (`markdown`, `messages`, `seo`, `auth/password`,
  `auth/token`), where `server-only` would throw; the folder is their marker.
- **Routing**: public pages live under `src/app/[locale]/` (locales `zh`/`en`,
  default `zh`, `localePrefix: "always"`). Every page starts with
  `const locale = await pageLocale(params)` (`src/i18n/page.ts`): it 404s an
  unknown locale and returns it narrowed. next-intl reads the locale itself
  as a root param (`next/root-params`, in `src/i18n/request.ts`), so pages
  prerender without handing it over — `setRequestLocale` is deprecated and a
  test keeps it out. Root params do not reach Route Handlers, Server Actions
  or `unstable_cache`: pass `getTranslations({ locale })` there (the feed
  does), and never translate inside a cached getter. `/admin` sits *outside* the locale tree and is a
  browser-based editor for all content; admin sessions are jose-signed JWTs.
- **Client messages**: the layout hands `NextIntlClientProvider` only the
  namespaces in `CLIENT_NAMESPACES` (`src/lib/server/messages.ts`); without the cut
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
  Operational upload leases are the exception: `admin/media/uploads` checks
  its session and Origin before reading JSON; `admin/media/storage.ts` owns
  lease transitions. These writes do not invalidate public content. The
  hourly cleanup route authenticates with the dedicated Worker secret.
- **Environment and origin**: every variable is described in
  `src/config/env.ts` and documented in `.env.example` (a test keeps them in
  step); a new `process.env.X` needs a rule there. `site.url` comes from the
  deployment (`src/lib/siteUrl.ts`: `SITE_URL`, else Vercel's production
  domain) — never hard-code the origin.
- **Security headers**: the CSP lives in `src/config/csp.ts` and is sent from
  `next.config.ts`. It allows nothing cross-origin; a new third-party script,
  font, frame or fetch has to be added there, and `pnpm smoke` is how you find
  out you forgot.
- **Error boundaries**: `src/app/[locale]/error.tsx` (a page failing at
  request time — a cold database on an uncached path), `src/app/global-error.tsx`
  (the layout itself), `src/app/admin/error.tsx`. Keep them dependency-free;
  they must not be able to fail the way the page did. The global one renders
  above the provider, so it reads `ERROR_COPY` (`src/lib/errorCopy.ts`), a
  copy of the catalogues' `error` lines — change both, `errorCopy.test.ts`
  compares them.
- **Database**: Neon Postgres over the HTTP driver (`src/db/index.ts`). Admin
  content writes use `db.batch` in one Read Committed transaction: lock the
  table, verify its old counts, write content/upload leases, then record the
  new expected counts in `admin_content_state`. Both deployments use this
  protocol; see `docs/BACKUP-EDIT-AUDIT.md`. Public exports read content and
  expected counts together in one read-only Repeatable Read transaction.
  Schema is in `src/db/schema.ts`, migrations via drizzle-kit. The driver's `fetch` is
  wrapped in `src/db/index.ts` to retry a *connection-level* failure (the
  `fetch failed` a proxied network throws now and then); that is only safe
  because every statement is idempotent — keep writes as keyed upserts or
  deletes, never a plain insert into a serial-keyed table.
- **Animation**: all GSAP plugins are registered once in `src/lib/client/gsap.ts` —
  import `gsap` and plugins from there, never from `"gsap"` directly. Eases
  come from its `EASE` token table, named by use — a new curve gets a token
  there first; an `ease: "…"` string anywhere else fails
  `conventions.test.ts`. `prefersReducedMotion` gates only the
  short no-stop-button list documented there, and that list is closed
  (DESIGN-LOG 10-02): a new loop gets a stop control of its own and pauses
  off screen — the record deck's 启停 and its `IntersectionObserver` are the
  pattern. Lenis inertial scrolling shares
  GSAP's clock (`gsap.ticker` drives `lenis.raf`).
- **Type**: Latin is Nunito, meta is Geist Mono, and the accent face — a
  quote, the slogan's echo, a sleeve — is Josefin Sans, upright, through
  `font-accent` / `--font-stack-accent` (`src/app/fonts.ts`, `globals.css`;
  DESIGN-LOG 10-03). No italic is loaded, so `italic` beside it is a slant
  the browser shears on; a title-size line names its weight, `font-normal`
  or `.accent-light`. All Chinese, including metadata, code, admin fields and
  accent text, uses self-hosted Resource Han Rounded through the shared
  `--font-stack-cjk` token (`src/app/rounded.css`). Each Latin stack keeps its
  existing face first, then that token; never add a separate Chinese face to
  one role. Its unicode ranges exclude Latin. `conventions.test.ts` checks
  the stacks, and `rounded.test.ts` checks the pinned subset bytes/ranges.
  A line that is not in the page's language
  (the slogan is English on both) gets `lang` from its own words through
  `langOfText` (`src/lib/localized.ts`); the CJK tracking guard reads it.
- **URL state on a static page** — the software shelf's `?app=` / `?cat=`,
  the board's `?nb=` — goes through `useUrlChoice`
  (`src/lib/client/useUrlChoice.ts`): read once after hydration, written
  back with `replaceState`. `useSearchParams` would cost the page its
  prerender.
- **3D**: `/intro` and the statue on `/idols/kobe` use @react-three/fiber +
  drei; the moss (`components/grove` — two lab studies, `/lab/grove` and
  `/lab/approach`; it left the home page's cover on 2026-09-24) and the
  workbench — now a lab study, `/lab/workstation`, no longer on `/about` —
  are imperative three.js. The home page mounts no three.js at all, and its
  script budget in `scripts/smoke.mts` is the ordinary page's; keep it that
  way. Every scene sits behind `next/dynamic`, and the component that
  mounts it asks `prefersSaveData()` / `hasWebGL()` (`src/lib/client/three/guards.ts`)
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
  (`src/config/immutable.ts` has the folder lists and the address shapes). After
  adding, replacing or removing a file there, run `pnpm assets` and commit
  `src/lib/assets.gen.json` (and `src/app/rounded.css` / the legacy `yozai.css`, whose font URLs it
  rewrites); a new top-level folder goes into `IMMUTABLE_DIRS`. Tests fail on
  a stale manifest, an unlisted folder, or a path written without `asset()`.
  Only `src/app/[locale]/not-found.tsx` loads its stage through
  `next/dynamic`; a not-found boundary is bundled with its layout, so
  anything it imports statically ships with every page.
- **Board media (the media site)**: a moment's pictures, voice notes, videos
  and posters (`moments.media`, a jsonb list — see `MomentMedia` in
  `src/lib/moments.ts`) are addresses on the media site, the Cloudflare
  Worker `fhfs-media` in `media/` (`MEDIA_ORIGIN` in `csp.ts`, on the free
  plan, no card) — the one cross-origin entry there (`img-src`, `media-src`;
  `next.config.ts` lets `next/image` fetch from it). The imported ones are
  `moments/<line key>-<n>.<ext>`. The files are the Worker's static assets in
  `media/files/`, which is not in git: the site is the live copy, `pnpm
  media:pull` fetches every file the database points at, and `pnpm
  media:deploy` uploads the folder (scripts/media.mts). A deploy replaces
  every asset at once, so it refuses while a referenced file is missing, or
  one is over Cloudflare's 25 MiB (re-encode a longer video under it); it
  writes `media/sizes.gen.json` — commit it — and runs the global `wrangler`
  from `media/` (never from the root: wrangler's autoconfig takes the root for
  a Next app to port). Static assets ignore `Range`, and Safari plays no media
  without it, so `media/worker.ts` runs first for `/moments/*` and answers
  ranges itself from that size table (`src/lib/byteRange.ts`, unit-tested);
  `mediaSite.test.ts` fails when the backup points at a file the table lacks.
  The free plan gives a request 10 ms of CPU, and a stream whose chunks pass
  through JavaScript spent 240–400 ms on one video — so `byteSlice` skips to
  the start with a BYOB reader a megabyte at a time and, for a range that
  runs to the end (what a player asks for), hands the asset's own stream
  back for the runtime to pipe. Keep bytes out of JavaScript there, and
  measure a change with `wrangler tail`.
  Admin uploads now use the Worker's `UPLOADS` KV binding, alongside legacy
  static files (2026-10-16, docs/MEDIA-UPLOADS.md). New addresses are under
  `/moments/uploads/`; the browser previews local files before upload. Saves
  retain leases atomically with their content write through `saveWithUploads`;
  cancellation and the hourly sweep delete only unretained uploads. Drafts
  retain files too. `pnpm e2e` tests against local KV, never production media.
  Static imports still use `media/files/` and `media:deploy`.
  The list is one file per line (`parseMedia` in `src/lib/forms.ts`); a site
  path into `public/` is still accepted, and a save refuses one the manifest
  does not know (`unknownAsset` in `actions/shared.ts`).
- **Draft preview**: `/admin/preview` turns on Draft Mode for the signed-in
  browser and opens a post, secret, film or idol on its own page; those pages
  pass `await showDrafts()` (`lib/server/auth/session.ts`: the mode is on *and*
  the session still holds — the mode's cookie outlives a session) to their
  getter as `drafts`, and the mode skips every cache, so a draft never lands
  in one. Logging out turns the mode off. The banner
  (`components/layout/PreviewBanner.tsx`) posts to `/admin/preview/exit`.
- **Search (⌘K, `/`)**: `components/search/SearchLauncher.tsx` in the
  layout listens for the keys and loads the palette as its own chunk on
  first use; the palette fetches `/[locale]/search.json`, a force-static
  route built from the same getters as the pages (so their tags rebuild it
  on save) and matched by `src/lib/search.ts`. A new kind of page is found
  once it is added to that route.
- **Films and idols** are rows (`films`, `idols`), a page per row, edited
  under 电影 / 偶像 in the admin; their repeated groups (stills, photos,
  lines, milestones) are jsonb lists edited with `app/admin/ui/RowsField.tsx`
  and read back with `formRows`. A film's page is the synopsis, the film's
  own lines and the stills, nothing else: the lede, the per-film headings
  and the parts left the table on 2026-10-02 (migration 0015) so that no
  column is left for an opinion — do not add one back. A page reads its row
  through `inLocale`
  (`src/lib/localized.ts`), which picks each `{ zh, en }` pair's side and
  falls back to the other when one is empty. Two of Kobe's things are code,
  not columns (`src/lib/idols.ts`): the statue, mounted by `/idols/[slug]`
  for `STATUE_IDOL`, its words under `idols.kobe` in the catalogues, standing
  on its own photograph (`components/idols/statue.ts`); and his record,
  `IDOL_TRACKS` — the only idol with one, so a map there rather than a
  column on every row. `media.test.ts` checks the
  size of every picture in `public/` that `backup/db.json` lists.
- **About and résumé** read one table: the rows of
  `resume_experiences` are the cities (`company` the place, `role` one line
  of what the work was, oldest first), drawn on `/about` by
  `components/about/Changelog.tsx` and listed again on `/resume`. The lab's
  `/lab/changelog` hands the same component `timeline_entries`. Its year
  rail takes the first four digits of a row's `period`, so a period starts
  with its year. No employer is named anywhere public (DESIGN-LOG 10-04).
- **Email links** go through `components/ui/MailLink.tsx`, never a bare
  `mailto:`: the browser says nothing when no mail program takes the link,
  so it copies the address inside the click (Safari allows the clipboard
  only in the gesture) and shows a chip if the page still has focus 0.8 s
  later.
- **Front door and music**: the home page opens with `NeonSplash` once per
  session, on a hard landing only — decided before first paint by the inline
  script in `src/lib/client/splash.ts` (`<html data-splash>`), which is also what
  `OvertureLight` and `Opening` consult. The background music is one hidden
  player in the layout (`components/fx/Jukebox.tsx`) driven by the store in
  `src/lib/client/jukebox.ts`; the signs (splash, `/lab/neon`, the island's note)
  only write `wanted`. The sign's drawing lives in `src/components/neon/`.
  The player is also the site's one rule about sound — never two things at
  once: it catches every `<audio>`/`<video>` `play` at the document, pauses
  the rest and steps aside (`held`), and comes back when the last one stops.
  A new player anywhere gets this for free; do not add a second copy. A
  room puts on its own record through `components/fx/RoomMusic` (the films
  by their `track` column, Kobe's page by `IDOL_TRACKS`). Every record is
  self-hosted in `public/music/`; a new one is encoded with `pnpm
  media:music`, its id added to `TRACK_IDS` (`src/lib/tracks.ts`), its
  hashed address to `trackFiles()` (`src/lib/server/trackFiles.ts` — server
  only, so the manifest stays out of every page's scripts), its name under
  `tracks.<id>` in both catalogues, and its source in `docs/CREDITS.md`.
- **Design source of truth**: `docs/DESIGN.md` — §5 (工程规则) is required
  reading before implementation work. Every revision since the original spec
  is dated in `docs/DESIGN-LOG.md` and overrides what it contradicts there;
  a comment citing "DESIGN.md, 09-14" means that log's entry. `docs/INTRO3D.md`
  covers the `/intro` scene; `docs/CREDITS.md` is where every third-party
  picture, recording, model and typeface is credited.

Three scroll gotchas that cost real debugging time (the first two in
README.md, the third in DESIGN-LOG 10-03):

- `html` must keep `scrollbar-gutter: stable`, or ScrollTrigger pins measured
  while the intro overlay locks `overflow` leave the page 15px horizontally
  scrollable.
- Taking over the wheel locally needs Lenis's own `data-lenis-prevent-wheel`
  attribute, enabled only while actually captured — `preventDefault()` alone
  does nothing, because Lenis's window-level listener never checks
  `defaultPrevented`.
- Lenis eats a native `#anchor` jump made while it is still gliding (about a
  second after the wheel, longer on a trackpad): the browser lands, and the
  next frame Lenis pulls the page back to its own target. Keep the `href`
  for no-script and modified clicks, but on a plain click `pushState` the
  hash and scroll with `lenis.scrollTo(target, { lock: true })` — after
  `lenis.resize()` if the DOM just grew. `components/moments/MomentBoard.tsx`
  does this for the calendar's squares.

# Content lives in Postgres

`src/lib/server/content.ts` is the only place the site reads content. Every getter is
wrapped in `unstable_cache` with tags and a 30-second revalidation window,
so edits made by either independent deployment reach this site's cache too.
Pages stay statically prerendered while still being invalidatable — in a
prerender those tags are collected into the page's ISR entry, so `updateTag`
from a Server Action reaches the pages, the sitemap, the feed and the OG
images together. Two rules follow:

- **Never read the database outside that file**, and never leave a read
  uncached. An uncached read still renders correctly and then ignores every
  later edit, with no error to notice. The two deliberate exceptions are the
  admin, which shows what is stored right now rather than what the cache
  says, and the login throttle, a write path; `conventions.test.ts` names
  exactly those.
- **Pass every request-varying value into cached functions as an argument.**
  `unstable_cache` does not key on captured values: locale, slug, tag and other
  values that vary between calls must be parameters. Stable database handles,
  column sets and query helpers may be shared at module scope.

Cache Components (`cacheComponents: true` / `'use cache'`) is off. What
used to rule it out — next-intl passing the locale through `React.cache`,
which a cached scope cannot see — is gone since the move to root params
(2026-09-29), which `'use cache'` can read. What remains is the switch
itself: every getter in `content.ts` is `unstable_cache` with tags and a bounded
revalidation window, and Next 16 names `'use cache'` + `cacheTag` its
replacement. That is one deliberate change of the whole read layer, verified
against the route table (every public page must stay prerendered), not
something to start one getter at a time.

`messages/*.json` holds the defaults for *all* copy — every line of it (the
films' and idols' own words left for their tables on 2026-09-29; no count is
written here, since one went stale twice). The `copy_blocks` table is an override layer merged in
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

Copy is written plainly (DESIGN-LOG 10-04, three rounds): a page's header
line says what the page holds and nothing more — no metaphor (shelf, room,
wall), no instructions to the reader, no explanation of the implementation
or where the data comes from, no 「不是…是…」, and no title that is a quip.
Error and empty states say what happened. Labels for things actually drawn
on the page (唱片架, 唱机上, 开灯) stay; it is the prose that is kept flat.
The navigation groups read 作品 / 生活 / 关于我 while their keys stay
`issue` / `rooms` / `me`.

`pnpm db:export` writes the database back out to `backup/`, which is committed.
Content keeps a diffable history that way; keep it current after bulk edits.

That copy only moves when someone opens a pull request, so a nightly workflow
(`.github/workflows/backup.yml`) exports on its own and commits a snapshot to
the `db-snapshots` branch when the content changed. It is gated on
`scripts/db-snapshot-guard.mts`: public counts must match the transactional
admin edit evidence. Intentional empty tables are valid; unexplained decreases
or missing evidence fail rather than overwriting the last good snapshot.
The protocol and rollout are in `docs/BACKUP-EDIT-AUDIT.md`; its pure checks
are in `src/lib/backupAudit.ts`. A red `backup` run is a real alarm.
Restoring — a wrong edit, a lost project, a lost Neon account
and the three files that would have to change to move off Neon — is
`docs/RECOVERY.md`.

The repository's history was rewritten on 2026-10-01 (`public/moments/` and
a platform's name taken out of every commit) and moved to a fresh public
repository the next day; the old one is the private, archived
`fhfs-site-archive`. Pull request numbers restarted at #1, so a PR number
cited in the docs or a comment from before 2026-10-02 refers to the archive.
Git holds no copy of the board's media: `media/files/` after `pnpm media:pull`
is the backup.

# Build and recovery checks (2026-10-12)

Browser fonts are committed under `src/app/font-files/` and loaded with
`next/font/local`. OG fonts are server files under `src/lib/server/og-fonts/`;
neither build nor OG generation downloads Google Fonts (`conventions.test.ts`
checks the sources). Provenance, hashes and regeneration: `docs/FONTS.md`.

`pnpm e2e:public` reads a running local production server. `pnpm e2e` writes
only to `TEST_DATABASE_URL`, after rejecting the production endpoint and
checking the manually provisioned `fhfs_e2e_guard` marker. See `docs/TESTING.md`.
The proxy lets Server Action POSTs reach their own session checks so an expired
editor retains its input; ordinary unauthenticated visits still redirect.

Public JSON exports still exclude drafts. Private encrypted recovery copies
include drafts and media, through `pnpm backup:private`; `verify` checks restored
bytes, while a real Postgres restore drill is separate. The local synthetic
round trip is `pnpm backup:private:selftest`. Configuration and activation:
`docs/PRIVATE-BACKUP.md`. Neither workflow is enabled until its repository
variable is set after configuration and first verification.
