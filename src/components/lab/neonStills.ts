/**
 * The stills hung on the wall under the sign, in order. Files live in
 * `public/lab/neon/` (1800px JPEGs cut from the studio's own stills, see
 * README「内容与模型从哪来」); the captions come from `lab.items.neon.<id>*`.
 *
 * Kept out of the demo module so the page — a Server Component — can read
 * the ids for its message keys without pulling in a client module.
 */
/** `tall` is the print beside the wide one: cropped upright so the row reads level. */
export type NeonStillSpan = "wide" | "tall" | "one" | "full";

export type NeonStill = {
  /** Message key stem: `<id>Title`, `<id>Meta`, `<id>Alt`. */
  id: string;
  file: string;
  width: number;
  height: number;
  /** How much of the wall the print takes on a desktop grid. */
  span: NeonStillSpan;
};

export const NEON_STILLS: NeonStill[] = [
  { id: "piano", file: "piano", width: 1800, height: 1012, span: "wide" },
  { id: "lovelyNight", file: "lovely-night", width: 1800, height: 1012, span: "tall" },
  { id: "lamp", file: "lamp", width: 1800, height: 1012, span: "one" },
  { id: "pier", file: "pier", width: 1403, height: 789, span: "one" },
  { id: "planetarium", file: "planetarium", width: 1800, height: 1012, span: "one" },
  { id: "keys", file: "keys", width: 1800, height: 1012, span: "full" },
];
