import { describe, expect, it } from "vite-plus/test";
import { checkPictures, coverOf } from "@/lib/films";

const picture = (id: string, src = `/films/x/${id}.jpg`) => ({
  id,
  src,
  width: 1800,
  height: 1013,
});
const anySrc = (src: string) => src.startsWith("/");

describe("coverOf", () => {
  it("finds the named picture, else the first, else nothing", () => {
    const wall = [picture("a"), picture("b")];
    expect(coverOf(wall, "b")?.id).toBe("b");
    expect(coverOf(wall, "gone")?.id).toBe("a");
    expect(coverOf(wall, null)?.id).toBe("a");
    expect(coverOf([], "a")).toBeUndefined();
  });
});

describe("checkPictures", () => {
  it("passes a good wall", () => {
    expect(checkPictures([picture("monkeyKing"), picture("wink")], anySrc)).toBeNull();
    expect(checkPictures([], anySrc)).toBeNull();
  });

  it("says which picture is wrong, and how", () => {
    expect(checkPictures([picture("a"), picture("a")], anySrc)).toContain("第 2 张");
    expect(checkPictures([picture("a b")], anySrc)).toContain("id");
    expect(checkPictures([picture("a", "https://example.com/a.jpg")], anySrc)).toContain("地址");
    expect(checkPictures([{ ...picture("a"), width: 0 }], anySrc)).toContain("宽和高");
  });
});
