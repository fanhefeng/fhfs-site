"use client";

import { useEffect, useRef } from "react";
import { jukebox, roomStart, roomStop, setTrack, useJukebox } from "@/lib/jukebox";
import { DEFAULT_TRACK, type TrackId } from "@/lib/tracks";
import { JukeboxSwitch } from "./JukeboxSwitch";

type Props = {
  track: TrackId;
  /** "今晚 · 台上放的是" — the kicker over the title. */
  tonight: string;
  title: string;
  artist: string;
  className?: string;
};

/**
 * A room with its own record.
 *
 * The board and the secrets are each named after a song, and the song plays
 * while the reader is in the room: on entry the record goes on, on the way
 * out the theme comes back. Whether the music *starts* on entry is the
 * reader's business, not the room's — it starts if it was already playing
 * (then only the record changes) or if the reader has never said no; a
 * switch turned off anywhere on the site (`silenced`) keeps every room
 * quiet until it is turned on again. A room that started the music stops it
 * on the way out; one that found it playing leaves it playing.
 *
 * The line it renders is the same one the neon sign has under it — what is
 * on tonight, and the note to switch it — so the reader can see why the
 * music changed and can stop it right here.
 */
export function RoomMusic({ track, tonight, title, artist, className = "" }: Props) {
  /** Whether this room was the one that put the music on. */
  const startedHere = useRef(false);
  const { silenced } = useJukebox();

  // The reader turning the music off here takes it out of the room's hands:
  // if they turn it back on, that is their music, and it should outlast the
  // room — the promise below. Without this the room still believed it had
  // started it, and stopped it on the way out.
  useEffect(() => {
    if (silenced) startedHere.current = false;
  }, [silenced]);

  useEffect(() => {
    setTrack(track);
    const { wanted, silenced } = jukebox();
    if (!wanted && !silenced) {
      startedHere.current = true;
      roomStart();
    }
    return () => {
      setTrack(DEFAULT_TRACK);
      // Only what this room switched on — a reader who came in with the
      // music playing, or switched it on themselves in here, keeps it.
      if (startedHere.current && jukebox().wanted) roomStop();
      startedHere.current = false;
    };
  }, [track]);

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <JukeboxSwitch className="-ml-3" />
      <p className="min-w-0 font-mono text-meta uppercase tracking-meta text-fg-tertiary">
        <span>{tonight}</span>
        <span aria-hidden="true"> · </span>
        <span className="text-fg-secondary normal-case tracking-normal">{title}</span>
        <span aria-hidden="true"> · </span>
        <span className="normal-case tracking-normal">{artist}</span>
      </p>
    </div>
  );
}
