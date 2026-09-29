"use client";

import { useEffect, useState } from "react";
import { formatMedia } from "@/lib/forms";
import { describeMedia, type MomentMedia } from "@/lib/moments";
import { postMoment } from "../actions/moments";
import { SaveControls } from "../ui/SaveControls";
import { cardClass, hintClass, textareaClass } from "../styles";
import { MediaUploader } from "../ui/MediaUploader";
import { useSaveAction } from "../ui/useSaveAction";

/**
 * 发一条: the board's form cut to what a line posted from a phone needs — the
 * words and the pictures. It sits at the top of the admin's front page, which
 * is also where the home-screen icon opens (`../manifest.webmanifest`). The
 * time, the key and every other field are the full form's defaults, set by
 * the action at the moment it is sent (`postMoment`). Anything more — a
 * notebook, a quote's source, a draft — is the full form under 说说.
 */
export function QuickMoment() {
  const { state, pending, formProps } = useSaveAction(postMoment);
  const [media, setMedia] = useState<MomentMedia[]>([]);
  /** Bumped on every send: the uploader starts over with an empty list. */
  const [sent, setSent] = useState(0);

  // A sent line clears its pictures along with its words (the form's own
  // reset takes the words).
  useEffect(() => {
    if (!state.ok) return;
    setMedia([]);
    setSent((n) => n + 1);
  }, [state]);

  return (
    <form {...formProps} className={`${cardClass} space-y-3 p-4`}>
      <label className="block">
        <span className="sr-only">说说正文</span>
        <textarea
          name="content"
          rows={4}
          placeholder="此刻在想什么？"
          className={`${textareaClass} text-body`}
        />
      </label>
      <input type="hidden" name="media" value={formatMedia(media)} />
      {media.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {media.map((item, i) => (
            <li key={item.src} className="relative">
              {item.kind === "audio" ? (
                <span className="flex h-16 items-center rounded-lg border border-line px-3 font-mono text-meta text-fg-secondary">
                  {describeMedia([item])}
                </span>
              ) : (
                // A thumbnail of the file just uploaded, straight from the store.
                // oxlint-disable-next-line nextjs/no-img-element
                <img
                  src={item.kind === "video" ? item.poster : item.src}
                  alt=""
                  className="size-16 rounded-lg border border-line object-cover"
                />
              )}
              <button
                type="button"
                aria-label={`去掉第 ${i + 1} 个文件`}
                onClick={() => setMedia((all) => all.filter((_, j) => j !== i))}
                className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-fg text-[11px] leading-none text-bg"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <MediaUploader
        key={sent}
        folder="moments"
        doneLabel="已加上"
        kinds={["image", "audio", "video"]}
        label="加图片 / 语音 / 视频"
        onUploaded={(file) => setMedia((all) => [...all, file])}
      />
      <p className={hintClass}>
        发出去就是公开的，时间按此刻。要选文集、写出处或存草稿，去「说说」里写。
      </p>
      <SaveControls state={state} pending={pending} label="发布" />
    </form>
  );
}
