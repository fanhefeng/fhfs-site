/**
 * The photographs the lens slides between, in order. Files live in
 * `public/lab/lens/<id>.jpg` (Unsplash, see README「内容与模型从哪来」); the
 * captions come from `lab.items.lensSlider.<id>{Alt,Title,Body,Meta}`.
 *
 * Kept out of the demo module for the same reason `neonStills` is: the page —
 * a Server Component — reads these ids to know which message keys to translate,
 * and must not pull a client module in to do it. Written twice before this
 * file existed, once on each side, where adding a fifth photograph showed up
 * as a picture with a raw message key under it.
 */
export const LENS_SLIDES = ["river", "falls", "sea", "coffee"] as const;

export type LensSlideId = (typeof LENS_SLIDES)[number];
