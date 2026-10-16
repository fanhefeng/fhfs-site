"use client";

import { useEffect, useRef, useState } from "react";
import {
  inspectMedia,
  sendMedia,
  uploadOperation,
  type UploadedMedia,
} from "@/lib/client/mediaUpload";
import { uploadFile } from "@/lib/mediaUploads";
import { ghostButtonClass, hintClass } from "../styles";
import { MediaPreview } from "./MediaPreview";

type Item = {
  id: string;
  name: string;
  local: string;
  kind: UploadedMedia["kind"];
  busy: boolean;
  media?: UploadedMedia;
  error?: string;
  controller: AbortController;
  posterId?: string;
};
type Props = {
  kind?: "image" | "audio" | "list";
  onUploaded: (media: UploadedMedia) => void;
  onRemove: (src: string) => void;
  showReadyPreview?: boolean;
};

/** Each field owns a disposable batch; saved files are protected by the server. */
export function MediaUpload({
  kind = "list",
  onUploaded,
  onRemove,
  showReadyPreview = true,
}: Props) {
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const batch = useRef("");
  const current = useRef<Item[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState("");
  const callbacks = useRef({ onUploaded, onRemove });
  callbacks.current = { onUploaded, onRemove };
  const update = (next: Item[]) => {
    current.current = next;
    setItems(next);
  };
  const change = (id: string, patch: Partial<Item>) =>
    update(current.current.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  useEffect(() => {
    const form = root.current?.closest("form");
    const dispose = () => {
      const oldBatch = batch.current;
      batch.current = "";
      for (const item of current.current) {
        item.controller.abort();
        URL.revokeObjectURL(item.local);
      }
      current.current = [];
      if (oldBatch)
        void uploadOperation({ action: "cancel", batch: oldBatch }, undefined, true).catch(() => {
          /* the scheduled sweep retries abandoned batches */
        });
    };
    const reset = () => {
      dispose();
      setItems([]);
      setError("");
    };
    const leaving = (event: PageTransitionEvent) => {
      if (!event.persisted) dispose();
    };
    form?.addEventListener("reset", reset);
    window.addEventListener("pagehide", leaving);
    return () => {
      form?.removeEventListener("reset", reset);
      window.removeEventListener("pagehide", leaving);
      dispose();
    };
  }, []);

  const add = async (files: File[]) => {
    if (!batch.current) batch.current = crypto.randomUUID();
    const selectedBatch = batch.current;
    for (const file of files) {
      if (batch.current !== selectedBatch) break;
      const format = uploadFile(file.name, file.size);
      if (!format.ok) {
        setError(format.error);
        continue;
      }
      if (kind !== "list" && kind !== format.kind) {
        setError(`请选择${kind === "image" ? "图片" : "音频"}文件。`);
        continue;
      }
      const item: Item = {
        id: crypto.randomUUID(),
        name: file.name,
        kind: format.kind,
        local: URL.createObjectURL(file),
        busy: true,
        controller: new AbortController(),
      };
      update([...current.current, item]);
      setError("");
      try {
        const measured = await inspectMedia(file, item.local);
        item.controller.signal.throwIfAborted();
        const src = await sendMedia(file, item.id, selectedBatch, item.controller.signal);
        let poster: string | undefined;
        if (measured.posterFile) {
          item.posterId = crypto.randomUUID();
          poster = await sendMedia(
            measured.posterFile,
            item.posterId,
            selectedBatch,
            item.controller.signal,
          );
        }
        item.controller.signal.throwIfAborted();
        const media = { ...measured, src, poster };
        callbacks.current.onUploaded(media);
        change(item.id, { busy: false, media });
      } catch (failure) {
        if (!item.controller.signal.aborted)
          change(item.id, {
            busy: false,
            error: failure instanceof Error ? failure.message : "上传未完成，请重新选择文件。",
          });
      }
    }
  };

  const remove = async (item: Item) => {
    item.controller.abort();
    try {
      await uploadOperation({ action: "cancel", batch: batch.current, id: item.id });
      if (item.posterId)
        await uploadOperation({ action: "cancel", batch: batch.current, id: item.posterId });
      if (item.media) callbacks.current.onRemove(item.media.src);
      URL.revokeObjectURL(item.local);
      update(current.current.filter((existing) => existing.id !== item.id));
    } catch (failure) {
      change(item.id, {
        busy: false,
        error: failure instanceof Error ? failure.message : "清理未完成，请重试。",
      });
    }
  };

  return (
    <div
      ref={root}
      className="space-y-3"
      data-upload-pending={items.some((item) => item.busy) ? "true" : undefined}
    >
      <input
        ref={input}
        type="file"
        className="sr-only"
        aria-label={
          kind === "image"
            ? "选择上传的图片"
            : kind === "audio"
              ? "选择上传的音频"
              : "选择上传的媒体文件"
        }
        accept={kind === "list" ? "image/*,audio/*,video/*" : `${kind}/*`}
        multiple={kind === "list"}
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = "";
          void add(files);
        }}
      />
      <button type="button" onClick={() => input.current?.click()} className={ghostButtonClass}>
        ＋ 上传{kind === "image" ? "图片" : kind === "audio" ? "音频" : "图片 / 音频 / 视频"}
      </button>
      <p className={hintClass}>
        单个文件最多 25 MiB。取消编辑会清理未保存的上传；异常中断的文件 24
        小时后自动清理。草稿会保留。
      </p>
      {error && (
        <p role="alert" className="text-caption text-accent">
          {error}
        </p>
      )}
      {items.map((item) => (
        <div key={item.id} className="space-y-2 rounded-chip border border-line p-3">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-caption">
            <span className="min-w-0 break-all">
              {item.name} · {item.busy ? "上传中…" : item.error ? "未完成" : "已上传，等待保存"}
            </span>
            <button
              type="button"
              onClick={() => {
                void remove(item);
              }}
              className="min-h-11 shrink-0 text-fg-secondary underline underline-offset-4"
            >
              移除并清理
            </button>
          </div>
          {(showReadyPreview || item.busy || item.error) && (
            <MediaPreview media={{ kind: item.kind, src: item.local, local: true }} />
          )}
          {item.error && (
            <p role="alert" className="text-caption text-accent">
              {item.error}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
