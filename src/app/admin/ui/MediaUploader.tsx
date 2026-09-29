"use client";

import { useId, useRef, useState, type DragEvent } from "react";
import type { MomentMedia } from "@/lib/moments";
import {
  blobPathname,
  fitWithin,
  UPLOAD_TYPES,
  uploadKind,
  type UploadFolder,
  type UploadKind,
} from "@/lib/upload";
import { hintClass } from "../styles";

/** A picture is stored at most this wide or tall — see `fitWithin`. */
const LONGEST = 2560;
/** Above this, the store's multipart upload: parts in parallel, each retried. */
const MULTIPART_FROM = 40 * 1024 * 1024;

type Job = { id: number; name: string; progress: number; error?: string; done?: boolean };

/** A file that is in the store, with what the page needs to draw it. */
export type Uploaded = MomentMedia;

/**
 * Upload from the editor: pick or drop files, and each lands in the Blob store
 * with its size (and a poster, for a video) measured here, in the browser, on
 * the way. What the caller does with it — a line in the board's media field,
 * a picture in an article, an episode's audio — is its own business
 * (`onUploaded`).
 *
 * Measured here because the browser already has the decoder: a picture's
 * pixels, a recording's length, a video's first second as a JPEG. A phone
 * photo is scaled down to `LONGEST` on its longest side on the way (the column
 * is 672 across), and re-encoded as a JPEG only then. The upload library is
 * imported on the first file, so an editor that never uploads never loads it.
 */
export function MediaUploader({
  folder,
  kinds,
  onUploaded,
  label,
  doneLabel = "已加进表单，记得保存",
}: {
  folder: UploadFolder;
  kinds: readonly UploadKind[];
  /** Each file as it lands, with the name it had on the author's disk. */
  onUploaded: (file: Uploaded, name: string) => void;
  label: string;
  /** What a finished file says — the form still has to be sent. */
  doneLabel?: string;
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [over, setOver] = useState(false);
  const next = useRef(0);
  const accept = kinds.flatMap((kind) => UPLOAD_TYPES[kind]).join(",");

  const update = (id: number, patch: Partial<Job>) =>
    setJobs((all) => all.map((job) => (job.id === id ? { ...job, ...patch } : job)));

  const run = async (file: File) => {
    const id = next.current++;
    setJobs((all) => [...all, { id, name: file.name, progress: 0 }]);
    try {
      const kind = uploadKind(file.type);
      if (!kind || !kinds.includes(kind)) {
        throw new Error(
          file.type === "image/heic" || /\.heic$/i.test(file.name)
            ? "HEIC 浏览器放不出来：在手机的相机设置里选「兼容性最佳」，或先转成 JPG。"
            : "这种文件这里不收。",
        );
      }
      const put = await uploader(folder, (progress) => update(id, { progress }));
      const media = await measureAndUpload(file, kind, put);
      onUploaded(media, file.name);
      update(id, { progress: 100, done: true });
    } catch (error) {
      update(id, { error: error instanceof Error ? error.message : "上传失败。" });
    }
  };

  const take = (files: FileList | null) => {
    for (const file of Array.from(files ?? [])) void run(file);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setOver(false);
    take(event.dataTransfer.files);
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={`space-y-2 rounded-chip border border-dashed px-3 py-2.5 transition-colors ${
        over ? "border-accent bg-accent/5" : "border-line"
      }`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor={inputId}
          className="cursor-pointer rounded-full border border-line px-3 py-1 font-mono text-meta text-fg-secondary transition-colors hover:border-fg-tertiary hover:text-fg"
        >
          {label}
        </label>
        <span className={hintClass}>也可以把文件拖到这里。</span>
        <input
          ref={input}
          id={inputId}
          type="file"
          multiple
          accept={accept}
          className="sr-only"
          onChange={(event) => {
            take(event.target.files);
            // The same file picked twice in a row is still a change.
            event.target.value = "";
          }}
        />
      </div>
      {jobs.length > 0 && (
        <ul className="space-y-1">
          {jobs.map((job) => (
            <li key={job.id} className="flex items-baseline gap-3 font-mono text-meta">
              <span className="min-w-0 flex-1 truncate text-fg-secondary">{job.name}</span>
              <span
                className={`shrink-0 tabular-nums ${job.error ? "text-accent" : "text-fg-tertiary"}`}
              >
                {job.error ?? (job.done ? doneLabel : `${Math.round(job.progress)}%`)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Put = (body: Blob, name: string, type: string) => Promise<string>;

/** The store's client, loaded on first use, bound to a folder and a progress bar. */
async function uploader(folder: UploadFolder, progress: (percent: number) => void): Promise<Put> {
  const { upload } = await import("@vercel/blob/client");
  return async (body, name, type) => {
    const day = new Date().toISOString().slice(0, 10);
    try {
      const result = await upload(blobPathname(folder, name, type, day), body, {
        access: "public",
        handleUploadUrl: "/admin/upload",
        contentType: type,
        multipart: body.size > MULTIPART_FROM,
        onUploadProgress: ({ percentage }) => progress(percentage),
      });
      return result.url;
    } catch (error) {
      throw new Error((await refusal()) ?? (error instanceof Error ? error.message : "上传失败。"));
    }
  };
}

/**
 * Why the route would not sign an upload — an expired session, a deployment
 * without the store's token — or null when it would. `upload()` reports every
 * refusal with the same English line and drops the route's words; this asks
 * for them.
 */
async function refusal(): Promise<string | null> {
  try {
    const response = await fetch("/admin/upload");
    if (response.ok) return null;
    return ((await response.json()) as { error?: string }).error ?? null;
  } catch {
    return null;
  }
}

async function measureAndUpload(file: File, kind: UploadKind, put: Put): Promise<MomentMedia> {
  if (kind === "image") {
    const bitmap = await createImageBitmap(file);
    const [width, height] = fitWithin(bitmap.width, bitmap.height, LONGEST);
    // Only a photo that is too big is redrawn: a PNG's transparency or a
    // GIF's frames would not survive the trip through a JPEG.
    const shrink = file.type === "image/jpeg" && width < bitmap.width;
    const body = shrink ? await drawJpeg(bitmap, width, height) : file;
    bitmap.close();
    const src = await put(body, file.name, shrink ? "image/jpeg" : file.type);
    return { kind: "image", src, width, height };
  }
  const url = URL.createObjectURL(file);
  try {
    if (kind === "audio") {
      const audio = document.createElement("audio");
      await loaded(audio, url);
      const duration = round(audio.duration);
      return { kind: "audio", src: await put(file, file.name, file.type), duration };
    }
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    await loaded(video, url);
    const { videoWidth: width, videoHeight: height } = video;
    const duration = round(video.duration);
    // A frame a second in, or halfway through a shorter clip: the very first
    // frame of a phone video is often still black.
    await seek(video, Math.min(1, video.duration / 2));
    const frame = await drawJpeg(video, width, height);
    const poster = await put(frame, `${file.name}-poster`, "image/jpeg");
    const src = await put(file, file.name, file.type);
    return { kind: "video", src, poster, width, height, duration };
  } finally {
    URL.revokeObjectURL(url);
  }
}

const round = (seconds: number) => Math.max(0.1, Math.round(seconds * 10) / 10);

/**
 * Waits for a recording's length. A WebM straight out of a browser's recorder
 * often carries none — `duration` is Infinity until the element has been sent
 * to the end once — so it is sent there, and back.
 */
async function loaded(element: HTMLMediaElement, url: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    element.preload = "metadata";
    element.onloadedmetadata = () => resolve();
    element.onerror = () => reject(new Error("浏览器读不了这个文件的时长，换个格式试试。"));
    element.src = url;
  });
  if (Number.isFinite(element.duration)) return;
  await new Promise<void>((resolve) => {
    element.ondurationchange = () => {
      if (Number.isFinite(element.duration)) resolve();
    };
    element.currentTime = Number.MAX_SAFE_INTEGER;
  });
  element.currentTime = 0;
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    video.onseeked = () => resolve();
    video.currentTime = time;
  });
}

function drawJpeg(source: CanvasImageSource, width: number, height: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(source, 0, 0, width, height);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("图片没能重新编码。"))),
      "image/jpeg",
      0.88,
    ),
  );
}
