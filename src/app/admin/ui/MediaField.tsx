"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { parseMedia } from "@/lib/forms";
import { hintClass, inputClass, labelClass, monoClass, textareaClass } from "../styles";
import { MediaGallery, type PreviewMedia } from "./MediaPreview";
import { MediaUpload } from "./MediaUpload";

/** Keep the form field uncontrolled; only the preview follows its current text. */
export function MediaField({
  name,
  label,
  kind,
  defaultValue,
  hint,
  placeholder,
  rows = 4,
}: {
  name: string;
  label: string;
  kind: "image" | "audio" | "list";
  defaultValue: string;
  hint?: string;
  placeholder?: string;
  rows?: number;
}) {
  const id = useId();
  const field = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [value, setValue] = useState(defaultValue);
  const [preview, setPreview] = useState(defaultValue);

  useEffect(() => {
    const timer = setTimeout(() => setPreview(value), 350);
    return () => clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    const form = field.current?.form;
    // reset fires before the browser resets the input. A successful save must
    // reset its preview too, while a failed save keeps both text and preview.
    const reset = () => queueMicrotask(() => setValue(field.current?.value ?? ""));
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, []);

  const items: PreviewMedia[] = [];
  const errors: string[] = [];
  if (kind === "list") {
    preview.split("\n").forEach((line, index) => {
      const result = parseMedia(line);
      if (result.ok) items.push(...result.value);
      else errors.push(result.error.replace("第 1 行", `第 ${index + 1} 行`));
    });
  } else if (preview.trim()) {
    items.push({ kind, src: preview.trim() });
  }

  const shared = {
    id,
    name,
    defaultValue,
    placeholder,
    spellCheck: false,
    "aria-describedby": hint ? `${id}-hint` : undefined,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValue(event.target.value),
  };
  const replace = (next: string) => {
    if (field.current) field.current.value = next;
    setValue(next);
  };

  return (
    <div className="min-w-0 space-y-2">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className={hintClass}>
          {hint}
        </p>
      )}
      {kind === "list" ? (
        <textarea
          {...shared}
          ref={(element) => {
            field.current = element;
          }}
          rows={rows}
          className={`${textareaClass} ${monoClass}`}
        />
      ) : (
        <input
          {...shared}
          ref={(element) => {
            field.current = element;
          }}
          className={`${inputClass} ${monoClass}`}
        />
      )}
      <MediaUpload
        showReadyPreview={false}
        kind={kind}
        onUploaded={(media) => {
          if (kind === "list") {
            const line =
              media.kind === "image"
                ? `image ${media.src} ${media.width}x${media.height}`
                : media.kind === "audio"
                  ? `audio ${media.src} ${media.duration}s`
                  : `video ${media.src} ${media.width}x${media.height} ${media.duration}s poster=${media.poster}`;
            replace([field.current?.value.trim(), line].filter(Boolean).join("\n"));
          } else {
            replace(media.src);
            if (media.kind === "audio" && media.duration) {
              const duration = field.current?.form?.elements.namedItem("duration");
              if (duration instanceof HTMLInputElement)
                duration.value = String(Math.ceil(media.duration / 60));
            }
          }
        }}
        onRemove={(src) =>
          replace(
            kind === "list"
              ? (field.current?.value ?? "")
                  .split("\n")
                  .filter((line) => !line.includes(src))
                  .join("\n")
              : field.current?.value === src
                ? ""
                : (field.current?.value ?? ""),
          )
        }
      />
      <MediaGallery items={items} />
      {errors.map((error, index) => (
        <p key={index} role="status" className="text-caption text-accent">
          {error}
        </p>
      ))}
    </div>
  );
}
