import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { adminSession } from "@/lib/server/auth/session";
import { ALL_UPLOAD_TYPES, MAX_UPLOAD_BYTES, validBlobPathname } from "@/lib/upload";

/**
 * Signs an upload from the editor to the Blob store `fhfs-media`. The file
 * itself never passes through here — a function takes at most a few megabytes
 * of body, and a phone's video is a hundred — so the browser asks this route
 * for a short-lived token and sends the bytes to the store directly
 * (`@vercel/blob/client`). The token is only handed out behind the session,
 * for a pathname of the shape `blobPathname` makes, and only for the types
 * the admin takes, up to their size.
 *
 * No completion callback: the editor writes the address into the form it was
 * uploading for, and the save is what records it. A file uploaded and never
 * saved stays in the store unused, which costs a few cents a year at most.
 */
export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json(
      { error: "这个部署没有配置 BLOB_READ_WRITE_TOKEN，上传不了。" },
      { status: 503 },
    );
  }
  try {
    const body = (await request.json()) as HandleUploadBody;
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!(await adminSession())) throw new Error("登录过期了，重新登录后再传。");
        if (!validBlobPathname(pathname)) throw new Error("文件名不对。");
        return {
          allowedContentTypes: [...ALL_UPLOAD_TYPES],
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
          // A year, like the hashed files in public/: an address in the store
          // never changes what it holds.
          cacheControlMaxAge: 31_536_000,
        };
      },
    });
    return Response.json(json);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "上传没能开始。" },
      { status: 400 },
    );
  }
}
