/**
 * The records the site owns, by the room that plays them.
 *
 * One player (`components/fx/Jukebox`), several tunes: the front door and the
 * neon study play the theme; 峰言疯语 plays Lovely Day, 《不能说的秘密》 plays
 * 路小雨 — the piano piece from the film's own soundtrack, shared by the
 * essays and the film — and the 大话西游 room plays the film's closing song.
 * A room asks for its record through `setTrack` in `lib/jukebox`; which file
 * that is lives here, and only here.
 *
 * Every record is a file we serve ourselves, under `public/music`: it plays
 * whole, in every network, with no embed, no login and no thirty-second
 * preview. There was a second kind — a Spotify track with a NetEase Cloud
 * Music stand-in for the networks that cannot reach Spotify — and it is gone
 * (2026-09-16): once every room had a recording of its own, the embed, its
 * twelve-second timeout, the stand-in iframe and the `fallback` state existed
 * only to serve a record nothing played. Bringing it back means bringing back
 * the player's second path with it.
 *
 * `public/music` is immutable (`next.config.ts`), so a re-encode gets a new
 * file name rather than overwriting one of these.
 *
 * What a room prints is the recording that actually plays, not the room's own
 * name: 《不能说的秘密》's record is 路小雨, and the page says so. Titles and
 * artists are copy, so they stay in `messages/*.json` under `tracks.<id>`;
 * a room reads them there and hands them to `RoomMusic`.
 */
export type TrackId = "theme" | "lovely" | "secret" | "odyssey";

/** Ours to serve: a file under `public/music`, played by a plain `<audio>`. */
export type Track = { src: string };

const TRACKS: Record<TrackId, Track> = {
  /** Mia & Sebastian's Theme — Justin Hurwitz, La La Land (2016). */
  theme: { src: "/music/mia-and-sebastians-theme.mp3" },
  /** Lovely Day — Jurrivh. 峰言疯语's record. */
  lovely: { src: "/music/lovely-day.mp3" },
  /** 路小雨 — 周杰倫, from the 不能說的秘密 soundtrack (2007). */
  secret: { src: "/music/lu-xiaoyu.mp3" },
  /** 一生所愛 — 盧冠廷, the 1995 original. */
  odyssey: { src: "/music/a-lifetime-of-love.mp3" },
};

/** The file this record plays. */
export const trackFile = (track: TrackId): string => TRACKS[track].src;

/** The record that plays when no room has asked for another. */
export const DEFAULT_TRACK: TrackId = "theme";
