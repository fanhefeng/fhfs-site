/**
 * What the admin may upload to the Blob store, and what it is called there.
 * Shared by the route that signs an upload (`app/admin/upload`) and the
 * editor that makes one (`app/admin/ui/MediaUploader`), so the two cannot
 * disagree about a type or a folder — the store would take the file the
 * editor offered and the route refused, or the other way round.
 */

export type UploadKind = "image" | "audio" | "video";

/** The types each kind accepts: what the browsers play or draw natively. */
export const UPLOAD_TYPES: Record<UploadKind, readonly string[]> = {
  image: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"],
  audio: [
    "audio/mpeg",
    "audio/mp4",
    "audio/x-m4a",
    "audio/aac",
    "audio/wav",
    "audio/ogg",
    "audio/webm",
  ],
  video: ["video/mp4", "video/quicktime", "video/webm"],
};

export const ALL_UPLOAD_TYPES: readonly string[] = Object.values(UPLOAD_TYPES).flat();

/** A phone's longest video is the one to fit: 200 MB. */
export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

/** The folders in the store, one per place the admin uploads from. */
export const UPLOAD_FOLDERS = ["moments", "posts", "secrets", "films", "idols"] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

/** The kind a MIME type belongs to, or null for one the admin does not take. */
export function uploadKind(type: string): UploadKind | null {
  for (const [kind, types] of Object.entries(UPLOAD_TYPES) as [UploadKind, readonly string[]][]) {
    if (types.includes(type)) return kind;
  }
  return null;
}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
  "audio/webm": "weba",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

/**
 * Where a file goes in the store: `moments/20260929-beach.jpg`. The day comes
 * first so the store's own listing reads in order; the name is the file's,
 * cut to what a URL carries without escaping (lower-case letters, digits,
 * hyphens), and "file" when nothing of it survives — a phone's `IMG_0412.HEIC`
 * keeps `img-0412`, a Chinese name keeps nothing. The extension follows the
 * type, not the name, since a converted photo keeps its old name. The store
 * adds a random suffix, so two uploads of one name never collide.
 */
export function blobPathname(
  folder: UploadFolder,
  fileName: string,
  type: string,
  day: string,
): string {
  const stem = fileName
    .replace(/\.[^.]*$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const ext = EXTENSIONS[type] ?? "bin";
  return `${folder}/${day.replaceAll("-", "")}-${stem || "file"}.${ext}`;
}

/** What the signing route accepts as a pathname: exactly the shape above. */
export function validBlobPathname(pathname: string): boolean {
  const match = /^([a-z]+)\/\d{8}-[a-z0-9-]{1,40}\.([a-z0-9]{2,4})$/.exec(pathname);
  return (
    match !== null &&
    (UPLOAD_FOLDERS as readonly string[]).includes(match[1]!) &&
    Object.values(EXTENSIONS).includes(match[2]!)
  );
}

/**
 * A picture's size shrunk to fit `max` on its longest side, the ratio kept;
 * unchanged when it already fits. Phones shoot 4000 pixels across — the
 * column is 672, and the file behind a picture's link does not need to be
 * four times the screen.
 */
export function fitWithin(width: number, height: number, max: number): [number, number] {
  const scale = Math.min(1, max / Math.max(width, height));
  return [Math.round(width * scale), Math.round(height * scale)];
}
