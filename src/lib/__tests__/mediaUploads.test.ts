import { describe, expect, it } from "vite-plus/test";
import { MEDIA_ORIGIN } from "@/config/csp";
import {
  readUpload,
  signUpload,
  uploadFile,
  uploadIds,
  UPLOAD_PREFIX,
  type UploadPermit,
} from "@/lib/mediaUploads";

const id = "c185fd3d-452d-4a67-9af7-bd501ef036b1";
const secret = "a-dedicated-test-secret-with-at-least-32-characters";
const now = 1800000000000;
const permit: UploadPermit = {
  path: `${UPLOAD_PREFIX}${id}.jpg`,
  size: 42,
  type: "image/jpeg",
  origin: "https://site.example",
  expires: now / 1000 + 600,
};

describe("upload files", () => {
  it("accepts only supported media extensions and nonempty files up to 25 MiB", () => {
    for (const name of [
      "x.JPG",
      "x.jpeg",
      "x.png",
      "x.webp",
      "x.avif",
      "x.gif",
      "x.mp3",
      "x.m4a",
      "x.wav",
      "x.ogg",
      "x.mp4",
      "x.mov",
      "x.webm",
    ])
      expect(uploadFile(name, 25 * 1024 * 1024).ok).toBe(true);
    for (const name of [
      "x.html",
      "x.svg",
      "x.exe",
      "x",
      "x.jpg.js",
      "x.constructor",
      "x.__proto__",
    ])
      expect(uploadFile(name, 1).ok).toBe(false);
    for (const size of [0, -1, 1.5, Infinity, NaN, 25 * 1024 * 1024 + 1])
      expect(uploadFile("x.jpg", size).ok).toBe(false);
  });
  it("finds only owned upload IDs, including markdown, once", () => {
    expect(uploadIds(undefined)).toEqual([]);
    const src = `${MEDIA_ORIGIN}${permit.path}`;
    expect(uploadIds({ body: `![image](${src})`, media: [{ src }] })).toEqual([id]);
    expect(
      uploadIds([
        `${MEDIA_ORIGIN}.evil${permit.path}`,
        `${MEDIA_ORIGIN}/moments/legacy.jpg`,
        `${MEDIA_ORIGIN}${UPLOAD_PREFIX}bad.jpg`,
      ]),
    ).toEqual([]);
  });
});

describe("scoped upload permits", () => {
  it("verifies authentic permits and rejects a forged signature, wrong secret or expiry", async () => {
    const token = await signUpload(permit, secret);
    expect(await readUpload(token, secret, now)).toEqual(permit);
    expect(await readUpload(token, "wrong", now)).toBeNull();
    expect(await readUpload(token + "x", secret, now)).toBeNull();
    expect(await readUpload(token, secret, now + 600001)).toBeNull();
    expect(await readUpload("invalid", secret, now)).toBeNull();
    expect(await readUpload(token + ".extra", secret, now)).toBeNull();
  });
  it("rejects malformed, oversized, off-prefix and overlong grants even if signed", async () => {
    for (const patch of [
      { path: "/moments/legacy.jpg" },
      { path: `${UPLOAD_PREFIX}bad.jpg` },
      { path: `${UPLOAD_PREFIX}${id}/x.jpg` },
      { path: `${UPLOAD_PREFIX}${id}.svg` },
      { size: 0 },
      { size: 30 * 1024 * 1024 },
      { type: "text/html" },
      { expires: now / 1000 + 3600 },
      { expires: 1.1 },
      { origin: "https://site.example/path" },
    ])
      expect(
        await readUpload(await signUpload({ ...permit, ...patch }, secret), secret, now),
      ).toBeNull();
  });
});
