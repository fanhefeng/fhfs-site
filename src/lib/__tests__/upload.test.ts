import { describe, expect, it } from "vite-plus/test";
import {
  ALL_UPLOAD_TYPES,
  blobPathname,
  fitWithin,
  uploadKind,
  validBlobPathname,
} from "@/lib/upload";

describe("uploadKind", () => {
  it("sorts a type into its kind, and refuses the rest", () => {
    expect(uploadKind("image/jpeg")).toBe("image");
    expect(uploadKind("audio/x-m4a")).toBe("audio");
    expect(uploadKind("video/quicktime")).toBe("video");
    expect(uploadKind("image/svg+xml")).toBe(null);
    expect(uploadKind("application/pdf")).toBe(null);
  });
});

describe("blobPathname", () => {
  it("dates the file and keeps what a URL carries of its name", () => {
    expect(blobPathname("moments", "IMG_0412.HEIC", "image/jpeg", "2026-09-29")).toBe(
      "moments/20260929-img-0412.jpg",
    );
    expect(blobPathname("posts", "海边.png", "image/png", "2026-01-02")).toBe(
      "posts/20260102-file.png",
    );
    expect(blobPathname("moments", "voice memo (2).m4a", "audio/mp4", "2026-09-29")).toBe(
      "moments/20260929-voice-memo-2.m4a",
    );
  });

  it("names every type it accepts with a pathname the route accepts", () => {
    for (const type of ALL_UPLOAD_TYPES) {
      expect(validBlobPathname(blobPathname("films", "x", type, "2026-09-29")), type).toBe(true);
    }
  });

  it("cuts a long name", () => {
    const path = blobPathname("moments", `${"a".repeat(90)}.jpg`, "image/jpeg", "2026-09-29");
    expect(validBlobPathname(path)).toBe(true);
  });
});

describe("validBlobPathname", () => {
  it("refuses another folder, a climb out, or an odd extension", () => {
    expect(validBlobPathname("moments/20260929-a.jpg")).toBe(true);
    expect(validBlobPathname("other/20260929-a.jpg")).toBe(false);
    expect(validBlobPathname("moments/../20260929-a.jpg")).toBe(false);
    expect(validBlobPathname("moments/20260929-a.html")).toBe(false);
    expect(validBlobPathname("/moments/20260929-a.jpg")).toBe(false);
  });
});

describe("fitWithin", () => {
  it("shrinks the longest side to the limit, keeping the ratio", () => {
    expect(fitWithin(4032, 3024, 2560)).toEqual([2560, 1920]);
    expect(fitWithin(3024, 4032, 2560)).toEqual([1920, 2560]);
  });

  it("leaves a small picture alone", () => {
    expect(fitWithin(1080, 1440, 2560)).toEqual([1080, 1440]);
  });
});
