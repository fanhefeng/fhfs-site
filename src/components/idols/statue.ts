import { asset } from "@/lib/asset";

/**
 * The photograph that stands in for the statue where it cannot stand — no
 * WebGL, or Save-Data: Kobe at the line in the 8, the picture that also hangs
 * first in his gallery. It belongs to the statue, so it lives with it in
 * code rather than following whatever the idol's row names as its cover; its
 * description is `idols.kobe.statueAlt`. Called on the server — `asset()`
 * resolves against the whole manifest.
 */
export const statueStandIn = () => ({
  src: asset("/idols/kobe/kobe-bryant-8.jpg"),
  width: 1071,
  height: 1600,
});
