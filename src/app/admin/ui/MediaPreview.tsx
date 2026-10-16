"use client";

import { useEffect, useRef, useState } from "react";
import { asset } from "@/lib/asset";
import { validMediaSrc } from "@/lib/forms";
import type { MomentMedia } from "@/lib/moments";
import { pauseOtherMedia } from "@/lib/client/mediaPlayback";

export type PreviewMedia = Pick<MomentMedia, "kind" | "src"> & { poster?: string; local?: boolean };

const KIND_LABEL = { image: "图片", audio: "音频", video: "视频" };

/** An incomplete address must never throw out an editor's unsaved text. */
function mediaAddress(src: string, local = false): string | null {
  if (local && src.startsWith("blob:")) return src;
  if (!validMediaSrc(src)) return null;
  try {
    return asset(src);
  } catch {
    return null;
  }
}

function fileName(src: string): string {
  const name = src.split("/").at(-1) || src;
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

/** File previews shared by saved records, live fields and picture rows. */
export function MediaPreview({
  media,
  compact = false,
}: {
  media: PreviewMedia;
  compact?: boolean;
}) {
  // Changing an address remounts the player and clears its previous error.
  return (
    <MediaFile
      key={`${media.kind}:${media.src}:${media.poster ?? ""}`}
      media={media}
      compact={compact}
    />
  );
}

function MediaFile({ media, compact }: { media: PreviewMedia; compact: boolean }) {
  const [failed, setFailed] = useState(false);
  const figure = useRef<HTMLElement | null>(null);
  const [showPoster, setShowPoster] = useState(!compact);
  useEffect(() => {
    if (!compact || media.kind !== "video") return;
    // The board has dozens of saved videos. Fetch their posters only as the
    // list approaches them, just as the native image previews are lazy.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShowPoster(true);
          observer.disconnect();
        }
      },
      { rootMargin: "240px" },
    );
    if (figure.current) observer.observe(figure.current);
    return () => observer.disconnect();
  }, [compact, media.kind]);
  const src = mediaAddress(media.src.trim(), media.local);
  const poster = media.poster ? mediaAddress(media.poster.trim()) : null;
  const name = fileName(media.src);

  if (!src) {
    return (
      <p
        role="status"
        className="rounded-chip border border-dashed border-line p-3 text-caption text-fg-tertiary"
      >
        无法预览：请填写已存在的站内文件或媒体站地址。
      </p>
    );
  }

  return (
    <figure
      ref={figure}
      className={`min-w-0 overflow-hidden rounded-chip border border-line bg-surface-raised ${compact ? (media.kind === "audio" ? "w-full sm:w-72" : "w-40 sm:w-48") : ""}`}
    >
      {failed ? (
        <p role="status" className="p-4 text-caption text-fg-tertiary">
          文件加载失败，可打开原文件检查。
        </p>
      ) : media.kind === "image" ? (
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`查看原图：${name}`}
          className="block bg-surface"
        >
          {/* Native images show the original file, including animated images, without an optimizer. */}
          {/* oxlint-disable-next-line nextjs/no-img-element */}
          <img
            src={src}
            alt={`图片预览：${name}`}
            loading="lazy"
            onError={() => setFailed(true)}
            className={`w-full object-contain ${compact ? "h-28" : "max-h-80 min-h-24"}`}
          />
        </a>
      ) : media.kind === "audio" ? (
        <div className="p-3">
          {/* This editor previews the original file; no caption track is stored with it. */}
          {/* oxlint-disable-next-line jsx-a11y/media-has-caption */}
          <audio
            src={src}
            controls
            preload="none"
            aria-label={`音频预览：${name}`}
            onError={() => setFailed(true)}
            onPlay={(event) => pauseOtherMedia(event.currentTarget)}
            className="w-full"
          />
        </div>
      ) : (
        // The original uploaded file has no caption-track field in the editor.
        // oxlint-disable-next-line jsx-a11y/media-has-caption
        <video
          src={src}
          poster={showPoster ? (poster ?? undefined) : undefined}
          controls
          playsInline
          preload="none"
          aria-label={`视频预览：${name}`}
          onError={() => setFailed(true)}
          onPlay={(event) => pauseOtherMedia(event.currentTarget)}
          className={`aspect-video w-full bg-black object-contain ${compact ? "" : "max-h-80 min-h-32"}`}
        />
      )}
      <figcaption className="flex min-w-0 items-center gap-2 border-t border-line px-3 py-1 text-caption">
        <span className="shrink-0 text-fg-tertiary">{KIND_LABEL[media.kind]}</span>
        <span className="min-w-0 flex-1 truncate text-fg-secondary" title={name}>
          {name}
        </span>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`打开原文件：${name}`}
          className="inline-flex min-h-11 shrink-0 items-center text-fg-secondary underline decoration-line underline-offset-4 hover:text-accent"
        >
          原文件 ↗
        </a>
      </figcaption>
    </figure>
  );
}

export function MediaGallery({
  items,
  compact = false,
  limit,
}: {
  items: readonly PreviewMedia[];
  compact?: boolean;
  limit?: number;
}) {
  if (!items.length) return null;
  const visible = limit === undefined ? items : items.slice(0, limit);
  return (
    <div role="group" aria-label="媒体预览" className="space-y-2">
      <div
        className={
          compact
            ? "flex flex-wrap gap-2"
            : items.length === 1
              ? "max-w-xl"
              : "grid items-start gap-4 sm:grid-cols-2"
        }
      >
        {visible.map((media, index) => (
          <MediaPreview
            key={`${index}:${media.kind}:${media.src}`}
            media={media}
            compact={compact}
          />
        ))}
      </div>
      {visible.length < items.length && (
        <p className="text-caption text-fg-tertiary">共 {items.length} 个文件</p>
      )}
    </div>
  );
}
