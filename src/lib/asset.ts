import manifest from "./assets.gen.json";
import { type AssetManifest, resolveAsset } from "./immutable";

/**
 * The address to put in a `src`: `/lab/lens/sea.jpg` →
 * `/lab/lens/sea.3fa9c1d2.jpg`, cached for a year and replaced the moment the
 * file is (src/lib/immutable.ts). Every reference to a file in one of the
 * immutable folders goes through here — `asset.test.ts` scans the source for
 * one that does not. A folder hashed as a set takes its trailing-slash path:
 * `asset("/draco/")`.
 */
export function asset(urlPath: string): string {
  return resolveAsset(manifest as AssetManifest, urlPath);
}
