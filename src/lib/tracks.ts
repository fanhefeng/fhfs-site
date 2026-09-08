/**
 * The records the site owns, by the room that plays them.
 *
 * One player (`components/fx/Jukebox`), several tunes: the front door and the
 * neon study play the theme; 《多的是你不知道的事》 plays the song it is named
 * after, 《不能说的秘密》 likewise, and the 大话西游 room plays the film's
 * closing song. A room asks for its record through `setTrack` in
 * `lib/jukebox`; what the record *is* — the Spotify track and the stand-in on
 * NetEase — lives here, and only here.
 *
 * The stand-ins follow the rule written down for the theme (README, 内容与
 * 模型从哪来): whatever NetEase will stream to a visitor who is not logged in.
 * For the three songs that is a piano rendition — the originals there are
 * behind a VIP wall (Wang, Lo) or absent altogether (Chou) — and the page
 * says so beside the title rather than pretending otherwise. Nothing is
 * downloaded or self-hosted: all of them are commercial recordings.
 *
 * Titles and artists are copy, so they stay in `messages/*.json` under
 * `tracks.<id>`; a room reads them there and hands them to `RoomMusic`.
 */
export type TrackId = "theme" | "unknown" | "secret" | "odyssey";

export type Track = {
  /** The Spotify track id — `spotify:track:<id>` for the iFrame API. */
  spotify: string;
  /** The NetEase Cloud Music song id of the stand-in recording. */
  netease: string;
};

export const TRACKS: Record<TrackId, Track> = {
  /** Mia & Sebastian's Theme — Justin Hurwitz, La La Land (2016); stand-in: his 2026 re-recording. */
  theme: { spotify: "1Vk4yRsz0iBzDiZEoFMQyv", netease: "3420987569" },
  /** 你不知道的事 — 王力宏 (2010); stand-in: a piano rendition (NewPiano). */
  unknown: { spotify: "3HH9pAwNfQVXYVUbmHxWwn", netease: "1998598395" },
  /** 不能說的秘密 — 周杰倫 (2007); stand-in: a piano rendition (酷客音乐). */
  secret: { spotify: "5mktG3zst5SVxAiVHY4j6C", netease: "2160818134" },
  /** 一生所愛 — 盧冠廷, the 1995 original; stand-in: a piano rendition (MappleZS). */
  odyssey: { spotify: "6zzVfWt16XAejBMA0mnDvg", netease: "1998046134" },
};

/** The record that plays when no room has asked for another. */
export const DEFAULT_TRACK: TrackId = "theme";
