// Accept availability failures from the database driver, never SQL bugs,
// authorization errors, framework redirects or errors thrown while rendering.
export function isNeonUnavailable(error: unknown): boolean {
  for (let depth = 0; depth < 8 && error && typeof error === "object"; depth++) {
    const entry = error as Record<string, unknown>;
    if (entry.name === "NeonDbError") {
      const code = entry.code;
      if (typeof code === "string" && code) return /^(?:08[A-Z0-9]{3}|53300|57P0[123])$/.test(code);
      const message = entry.message;
      return (
        typeof message === "string" &&
        (/^Server error \(HTTP status (?:402|429|5\d\d)\):/.test(message) ||
          (message.startsWith("Error connecting to database:") && entry.sourceError !== undefined))
      );
    }
    error = entry.cause ?? entry.sourceError;
  }
  return false;
}
