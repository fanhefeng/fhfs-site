import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("hashPassword", () => {
  it("produces salt:hash, both hex, with a 16-byte salt and a 64-byte key", () => {
    const stored = hashPassword("correct horse");
    expect(stored).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
  });

  it("salts, so the same password hashes differently each time", () => {
    const a = hashPassword("same");
    const b = hashPassword("same");
    expect(a).not.toBe(b);
    expect(verifyPassword("same", a)).toBe(true);
    expect(verifyPassword("same", b)).toBe(true);
  });
});

describe("verifyPassword", () => {
  const stored = hashPassword("open sesame");

  it("accepts the password that was hashed", () => {
    expect(verifyPassword("open sesame", stored)).toBe(true);
  });

  it("rejects anything else, including near misses", () => {
    expect(verifyPassword("open sesame ", stored)).toBe(false);
    expect(verifyPassword("Open sesame", stored)).toBe(false);
    expect(verifyPassword("", stored)).toBe(false);
  });

  it("rejects a stored value that is not salt:hash", () => {
    expect(verifyPassword("x", "")).toBe(false);
    expect(verifyPassword("x", "nocolon")).toBe(false);
    expect(verifyPassword("x", ":abc")).toBe(false);
    expect(verifyPassword("x", "abc:")).toBe(false);
  });

  it("rejects a stored hash of the wrong length without throwing", () => {
    // timingSafeEqual throws on unequal lengths; the guard before it must
    // turn that into a plain "no".
    expect(verifyPassword("x", "abcd:1234")).toBe(false);
  });
});
