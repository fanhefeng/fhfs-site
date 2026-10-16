import { timingSafeEqual } from "node:crypto";
import { sweepUploads, uploadSecret } from "@/app/admin/media/storage";

export async function POST(request: Request) {
  const expected = Buffer.from(`Bearer ${uploadSecret()}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return new Response(null, { status: 401 });
  try {
    return Response.json({ removed: await sweepUploads() });
  } catch {
    return Response.json({ error: "Media cleanup failed" }, { status: 503 });
  }
}
