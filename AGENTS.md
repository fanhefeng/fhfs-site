<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

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
