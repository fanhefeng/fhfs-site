import "server-only";
import { unstable_cache as nextCache } from "next/cache";
import { showDrafts } from "./auth/session";
import { isNeonUnavailable } from "./neonAvailability";
import { type PublicSnapshot, readPublicSnapshot } from "./snapshotSource";

async function isPreview() {
  try {
    return await showDrafts();
  } catch (error) {
    // Static parameter generation has no request or draft cookie.
    if (
      error instanceof Error &&
      error.message.includes("used `draftMode()` inside `generateStaticParams`")
    )
      return false;
    throw error;
  }
}

/** Snapshot reads stay outside Next's tagged live data cache. */
export function unstable_cache<A extends unknown[], R>(
  read: (...args: A) => Promise<R>,
  keys: string[],
  options: { tags: string[]; revalidate: number },
  fromSnapshot?: (snapshot: PublicSnapshot, ...args: A) => NoInfer<R> | undefined,
) {
  const live = nextCache(read, keys, options);
  return async (...args: A): Promise<R> => {
    try {
      return await live(...args);
    } catch (error) {
      if (!fromSnapshot || !isNeonUnavailable(error) || (await isPreview())) throw error;
      const snapshot = await readPublicSnapshot();
      const fallback = fromSnapshot(snapshot, ...args);
      // A snapshot miss says nothing about the requested article's current status.
      if (fallback === undefined) throw error;
      console.warn("public content snapshot", keys[0], snapshot.publishedAt);
      return fallback;
    }
  };
}
