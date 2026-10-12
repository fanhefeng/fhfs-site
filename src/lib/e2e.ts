/** Test writes require both a different endpoint and an explicit database marker. */
export function testDatabaseProblem(
  testUrl: string | undefined,
  production: string[],
): string | null {
  if (!testUrl) return "TEST_DATABASE_URL is missing; use a dedicated Neon test project";
  const endpoint = (value: string) => {
    const url = new URL(value);
    if (!/^postgres(?:ql)?:$/.test(url.protocol)) throw new Error("Invalid Postgres URL");
    return `${url.hostname.replace(/-pooler(?=\.)/, "")}:${url.port || "5432"}`;
  };
  try {
    const test = endpoint(testUrl);
    if (production.some((url) => endpoint(url) === test))
      return "Test database must not use a production endpoint";
  } catch {
    return "Test or production database URL is invalid";
  }
  return null;
}
