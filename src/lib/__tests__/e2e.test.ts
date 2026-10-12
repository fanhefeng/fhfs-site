import { describe, expect, it } from "vite-plus/test";
import { testDatabaseProblem } from "@/lib/e2e";

describe("browser test database safety", () => {
  const production = "postgresql://owner:secret@ep-prod-pooler.neon.tech/site";
  it("refuses missing configuration and the pooled or direct production endpoint", () => {
    expect(testDatabaseProblem(undefined, [production])).toMatch(/missing/);
    expect(testDatabaseProblem(production, [production])).toMatch(/production endpoint/);
    expect(
      testDatabaseProblem("postgres://tester:other@ep-prod.neon.tech/other", [production]),
    ).toMatch(/production endpoint/);
    expect(testDatabaseProblem("not-a-url", [production])).toMatch(/invalid/);
    expect(testDatabaseProblem("https://example.com", [production])).toMatch(/invalid/);
  });
  it("accepts a separate test endpoint", () => {
    expect(
      testDatabaseProblem("postgresql://tester:secret@ep-test.neon.tech/site", [production]),
    ).toBeNull();
  });
});
