import "server-only";
import { asset } from "@/lib/asset";
import type { TrackFiles } from "@/lib/tracks";

/**
 * Where each record is served from, hashed. Server-only on purpose: `asset()`
 * carries the whole manifest, and the player that needs these addresses
 * is mounted on every page — so the layout resolves them here and passes the
 * strings down (see `lib/tracks`).
 */
export const trackFiles = (): TrackFiles => ({
  /** Mia & Sebastian's Theme — Justin Hurwitz, La La Land (2016). */
  theme: asset("/music/mia-and-sebastians-theme.mp3"),
  /** Lovely Day — Jurrivh. 峰言峰语's record. */
  lovely: asset("/music/lovely-day.mp3"),
  /** 路小雨 — 周杰倫, from the 不能說的秘密 soundtrack (2007). */
  secret: asset("/music/lu-xiaoyu.mp3"),
  /** 一生所愛 — 盧冠廷, the 1995 original. */
  odyssey: asset("/music/a-lifetime-of-love.mp3"),
  /**
   * Kobe Bryant, two speeches cut together: his jersey retirement
   * (2017-12-18, from "And lastly, our daughters…" to "I love you"), then
   * "What can I say? Mamba out." from his last game (2016-04-13).
   */
  mamba: asset("/music/the-dream-mamba-out.mp3"),
});
