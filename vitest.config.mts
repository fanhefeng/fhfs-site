import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const lib = fileURLToPath(new URL("./src/lib/", import.meta.url));

/**
 * What coverage is measured over: the modules that have a test file of their
 * own name, plus the two that are tested under another's. Not all of src/lib
 * — most of it is shaders, stores and the database layer, which these tests
 * were never meant to reach, and a number averaged over those says nothing
 * about the ones that are. A module joins by getting a test.
 */
const tested = readdirSync(`${lib}__tests__`)
  .map((file) => file.replace(/\.test\.ts$/, ""))
  .flatMap((name) => [`${name}.ts`, `auth/${name}.ts`])
  .filter((file) => existsSync(lib + file))
  .concat(["assetManifest.ts", "immutable.ts"])
  .map((file) => `src/lib/${file}`);

/**
 * Unit tests for the pure helpers under src/lib — no DOM, no database, no
 * Next runtime. Anything that needs one of those is not a unit test here.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: tested,
      reporter: ["text-summary"],
      // A floor, a little under where it stands: `pnpm test:coverage` fails
      // when a change takes the tested modules below it. Raise it as they rise.
      thresholds: { statements: 93, branches: 88, functions: 90, lines: 93 },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
