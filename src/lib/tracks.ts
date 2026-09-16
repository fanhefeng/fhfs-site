/**
 * The records the site owns, by the room that plays them.
 *
 * One player (`components/fx/Jukebox`), several tunes: the front door and the
 * neon study play the theme; 《多的是你不知道的事》 plays the song it is named
 * after, 《不能说的秘密》 likewise — the essays and the film share it — and
 * the 大话西游 room plays the film's closing song. A room asks for its record through `setTrack` in
 * `lib/jukebox`; what the record *is* lives here, and only here.
 *
 * A record comes in one of two forms. The theme is **self-hosted**: the file
 * under `public/music` is served from our own origin, so it plays whole, in
 * every network, with no embed, no login and no thirty-second preview — the
 * front door's own tune was worth the 2.8 MB. The other three are
 * **streamed**: the Spotify track, with a NetEase Cloud Music stand-in for
 * the networks that cannot reach Spotify at all. Those stand-ins follow the
 * rule written down in the README (内容与模型从哪来): whatever NetEase will
 * stream to a visitor who is not logged in — for the three songs a piano
 * rendition, the originals there being behind a VIP wall (Wang, Lo) or absent
 * altogether (Chou) — and the page says so beside the title rather than
 * pretending otherwise.
 *
 * Titles and artists are copy, so they stay in `messages/*.json` under
 * `tracks.<id>`; a room reads them there and hands them to `RoomMusic`.
 */
export type TrackId = "theme" | "unknown" | "secret" | "odyssey";

export type Track =
  /** Ours to serve: a file under `public/music`, played by a plain `<audio>`. */
  | { src: string }
  /** Someone else's to serve: the Spotify track id, and the NetEase song id
   *  of the stand-in recording. */
  | { spotify: string; netease: string };

export const TRACKS: Record<TrackId, Track> = {
  /** Mia & Sebastian's Theme — Justin Hurwitz, La La Land (2016); ours, whole. */
  theme: { src: "/music/mia-and-sebastians-theme.mp3" },
  /** 你不知道的事 — 王力宏 (2010); stand-in: a piano rendition (NewPiano). */
  unknown: { spotify: "3HH9pAwNfQVXYVUbmHxWwn", netease: "1998598395" },
  /** 不能說的秘密 — 周杰倫 (2007); stand-in: a piano rendition (酷客音乐). */
  secret: { spotify: "5mktG3zst5SVxAiVHY4j6C", netease: "2160818134" },
  /** 一生所愛 — 盧冠廷, the 1995 original; stand-in: a piano rendition (MappleZS). */
  odyssey: { spotify: "6zzVfWt16XAejBMA0mnDvg", netease: "1998046134" },
};

/** The file we serve ourselves, or `null` for a record that is streamed. */
export const trackFile = (track: TrackId): string | null => {
  const record = TRACKS[track];
  return "src" in record ? record.src : null;
};

/** `spotify:track:…` for the iFrame API, or `null` for a self-hosted record. */
export const trackUri = (track: TrackId): string | null => {
  const record = TRACKS[track];
  return "spotify" in record ? `spotify:track:${record.spotify}` : null;
};

/** The NetEase stand-in's embed URL, or `null` where there is no stand-in. */
export const trackStandIn = (track: TrackId): string | null => {
  const record = TRACKS[track];
  return "netease" in record
    ? `https://music.163.com/outchain/player?type=2&id=${record.netease}&auto=1&height=66`
    : null;
};

/** The record that plays when no room has asked for another. */
export const DEFAULT_TRACK: TrackId = "theme";
