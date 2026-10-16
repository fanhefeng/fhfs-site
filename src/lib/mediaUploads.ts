import { MEDIA_ORIGIN } from "../config/csp";
import { MEDIA_FILE_LIMIT } from "./mediaSite";

export const UPLOAD_PREFIX = "/moments/uploads/";
export const UPLOAD_LIFETIME_MS = 24 * 60 * 60 * 1000;
export const UPLOAD_TOKEN_SECONDS = 10 * 60;
export const UPLOAD_TRANSFER_SECONDS = 5 * 60;
export const UPLOAD_CLEANUP_GRACE_MS = (UPLOAD_TOKEN_SECONDS + UPLOAD_TRANSFER_SECONDS + 60) * 1000;
export const UPLOAD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const FILE_TYPES: Record<string, { type: string; kind: "image" | "audio" | "video" }> = {
  jpg: { type: "image/jpeg", kind: "image" },
  jpeg: { type: "image/jpeg", kind: "image" },
  png: { type: "image/png", kind: "image" },
  webp: { type: "image/webp", kind: "image" },
  gif: { type: "image/gif", kind: "image" },
  avif: { type: "image/avif", kind: "image" },
  mp3: { type: "audio/mpeg", kind: "audio" },
  m4a: { type: "audio/mp4", kind: "audio" },
  wav: { type: "audio/wav", kind: "audio" },
  ogg: { type: "audio/ogg", kind: "audio" },
  mp4: { type: "video/mp4", kind: "video" },
  mov: { type: "video/quicktime", kind: "video" },
  webm: { type: "video/webm", kind: "video" },
};

export function uploadFile(name: string, size: number) {
  const extension = name.split(".").at(-1)?.toLowerCase() ?? "";
  const format = Object.hasOwn(FILE_TYPES, extension) ? FILE_TYPES[extension] : undefined;
  if (!format)
    return {
      ok: false as const,
      error: "支持 JPG、PNG、WebP、GIF、AVIF、MP3、M4A、WAV、OGG、MP4、MOV 和 WebM。",
    };
  if (!Number.isSafeInteger(size) || size <= 0 || size > MEDIA_FILE_LIMIT) {
    return { ok: false as const, error: "单个文件须大于 0，且不超过 25 MiB。" };
  }
  return { ok: true as const, extension, ...format };
}

/** Addresses written by this uploader, never legacy files or supplied arbitrary paths. */
export function uploadIds(value: unknown): string[] {
  const prefix = (MEDIA_ORIGIN + UPLOAD_PREFIX).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const ids = new Set<string>();
  for (const match of (JSON.stringify(value) ?? "").matchAll(
    new RegExp(`${prefix}([0-9a-f-]{36})\\.[a-z0-9]+`, "g"),
  )) {
    if (UPLOAD_ID.test(match[1]!)) ids.add(match[1]!);
  }
  return [...ids];
}

export type UploadPermit = {
  path: string;
  size: number;
  type: string;
  expires: number;
  origin: string;
};
const encoder = new TextEncoder();
const base64 = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
const unbase64 = (text: string) =>
  Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
async function signingKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signUpload(permit: UploadPermit, secret: string): Promise<string> {
  const payload = base64(encoder.encode(JSON.stringify(permit)));
  return `${payload}.${base64(new Uint8Array(await crypto.subtle.sign("HMAC", await signingKey(secret), encoder.encode(payload))))}`;
}

export async function readUpload(
  token: string,
  secret: string,
  now = Date.now(),
): Promise<UploadPermit | null> {
  try {
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra !== undefined) return null;
    if (
      !(await crypto.subtle.verify(
        "HMAC",
        await signingKey(secret),
        unbase64(signature),
        encoder.encode(payload),
      ))
    )
      return null;
    const p = JSON.parse(new TextDecoder().decode(unbase64(payload))) as UploadPermit;
    const file = p.path?.slice(UPLOAD_PREFIX.length);
    if (
      !p.path?.startsWith(UPLOAD_PREFIX) ||
      !file ||
      file.includes("/") ||
      !UPLOAD_ID.test(file.split(".")[0] ?? "")
    )
      return null;
    const format = uploadFile(file, p.size);
    if (
      !format.ok ||
      format.type !== p.type ||
      !Number.isSafeInteger(p.expires) ||
      p.expires <= now / 1000 ||
      p.expires > now / 1000 + UPLOAD_TOKEN_SECONDS + 5
    )
      return null;
    if (!/^https?:\/\/[^/]+$/.test(p.origin)) return null;
    return p;
  } catch {
    return null;
  }
}
