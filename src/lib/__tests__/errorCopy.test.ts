import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ERROR_COPY } from "@/lib/errorCopy";
import zh from "../../../messages/zh.json";
import en from "../../../messages/en.json";

describe("the global error boundary's copy", () => {
  it("says what the catalogues say", () => {
    expect(ERROR_COPY.zh).toEqual(zh.error);
    expect(ERROR_COPY.en).toEqual(en.error);
  });

  // The boundary ships with every page; a catalogue imported there is the
  // whole catalogue in every page's scripts.
  it("is read from the copy, never from the catalogues", () => {
    const source = readFileSync(
      fileURLToPath(new URL("../../app/global-error.tsx", import.meta.url)),
      "utf8",
    );
    expect(source).not.toMatch(/messages\/(zh|en)\.json/);
    expect(source).toMatch(/@\/lib\/errorCopy/);
  });
});
