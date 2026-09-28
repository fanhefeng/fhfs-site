/**
 * The records the site owns, by the room that plays them.
 *
 * One player (`components/fx/Jukebox`), several tunes: the front door and the
 * neon study play the theme; 峰言峰语 plays Lovely Day, 《不能说的秘密》 plays
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
 * The files are addressed through `asset()`, which hashes them — and that
 * resolves against the whole manifest, so it happens on the server:
 * `trackFiles()` is called by the locale layout, which hands the four
 * addresses to the player. This module, which the rooms import on the client
 * for `TrackId`, stays free of the manifest; importing `asset` here put all
 * 288 entries of it into every page's scripts.
 *
 * What a room prints is the recording that actually plays, not the room's own
 * name: 《不能说的秘密》's record is 路小雨, and the page says so. Titles and
 * artists are copy, so they stay in `messages/*.json` under `tracks.<id>`;
 * a room reads them there and hands them to `RoomMusic`.
 */
export type TrackId = "theme" | "lovely" | "secret" | "odyssey";

/** The address each record plays from — built by `trackFiles()`. */
export type TrackFiles = Record<TrackId, string>;

/** The record that plays when no room has asked for another. */
export const DEFAULT_TRACK: TrackId = "theme";
