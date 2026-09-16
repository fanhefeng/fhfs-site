/**
 * The records the site owns, by the room that plays them.
 *
 * One player (`components/fx/Jukebox`), several tunes: the front door and the
 * neon study play the theme; 《多的是你不知道的事》 plays the song it is named
 * after, 《不能说的秘密》 likewise — the essays and the film share it — and
 * the 大话西游 room plays the film's closing song. A room asks for its record through `setTrack` in
 * `lib/jukebox`; what the record *is* lives here, and only here.
 *
 * A record comes in one of two forms. Every record a room actually plays is
 * **self-hosted**: a file under `public/music`, served from our own origin,
 * playing whole in every network with no embed, no login and no
 * thirty-second preview. 《你不知道的事》 is the one **streamed** record
 * left — the Spotify track with a NetEase Cloud Music stand-in for the
 * networks that cannot reach Spotify at all — and no room plays it today;
 * both it and the player's streaming path stay for the next record that
 * arrives without a file. That stand-in follows the rule written down in the
 * README (内容与模型从哪来): whatever NetEase will stream to a visitor who is
 * not logged in — a piano rendition, the original there being behind a VIP
 * wall — and the page would say so beside the title rather than pretending
 * otherwise.
 *
 * What plays in a room is the recording we have, and the copy names *that*
 * recording: 《不能说的秘密》's room plays 《路小雨》, the piano piece from the
 * film's own soundtrack, and says so — the room is named after the film, not
 * after the song.
 *
 * Titles and artists are copy, so they stay in `messages/*.json` under
 * `tracks.<id>`; a room reads them there and hands them to `RoomMusic`.
 */
export type TrackId = "theme" | "lovely" | "unknown" | "secret" | "odyssey";

export type Track =
  /** Ours to serve: a file under `public/music`, played by a plain `<audio>`. */
  | { src: string }
  /** Someone else's to serve: the Spotify track id, and the NetEase song id
   *  of the stand-in recording. */
  | { spotify: string; netease: string };

export const TRACKS: Record<TrackId, Track> = {
  /** Mia & Sebastian's Theme — Justin Hurwitz, La La Land (2016); ours, whole. */
  theme: { src: "/music/mia-and-sebastians-theme.mp3" },
  /** Lovely Day — Bill Withers (1977); ours, whole. 峰言疯语's record. */
  lovely: { src: "/music/lovely-day.mp3" },
  /** 你不知道的事 — 王力宏 (2010); stand-in: a piano rendition (NewPiano).
   *  No room plays it since 峰言疯语 took Lovely Day — it is the only record
   *  left on the streamed path, and the path stays for the next one. */
  unknown: { spotify: "3HH9pAwNfQVXYVUbmHxWwn", netease: "1998598395" },
  /** 路小雨 — 周杰倫, from the 不能說的秘密 soundtrack (2007); ours, whole. */
  secret: { src: "/music/lu-xiaoyu.mp3" },
  /** 一生所愛 — 盧冠廷, the 1995 original; ours, whole. */
  odyssey: { src: "/music/a-lifetime-of-love.mp3" },
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
