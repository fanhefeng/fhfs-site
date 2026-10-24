import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { parse } from "yaml";

type Step = {
  if?: string;
  name?: string;
  run?: string;
  uses?: string;
  "continue-on-error"?: boolean;
  "timeout-minutes"?: number;
};
type Workflow = { jobs: Record<string, { steps: Step[] }> };
const root = fileURLToPath(new URL("../../../", import.meta.url));
const workflow = (name: string) =>
  parse(readFileSync(path.join(root, ".github/workflows", name), "utf8")) as Workflow;
const monitor = workflow("monitor.yml").jobs.audit!;
const backup = workflow("private-backup.yml").jobs.backup!;
const step = (steps: Step[], name: string) => steps.find((entry) => entry.name === name)!;
const temporary: string[] = [];
afterEach(() => {
  for (const dir of temporary.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function harness() {
  const dir = mkdtempSync(path.join(tmpdir(), "fhfs-monitor-workflow-"));
  temporary.push(dir);
  const bin = path.join(dir, "bin");
  mkdirSync(bin);
  const calls = path.join(dir, "calls");
  writeFileSync(calls, "");
  const executable = (name: string, body: string) =>
    writeFileSync(path.join(bin, name), `#!/bin/bash\nset -eu\n${body}\n`, { mode: 0o755 });
  // Reproduce the failed apt prerequisite without networking or waiting twelve minutes.
  executable("sudo", 'echo "apt mirror unavailable" >&2; exit 71');
  executable("pnpm", 'printf "pnpm %s\\n" "$*" >> "$CALLS"; exit "${HEALTH_EXIT:-0}"');
  executable("curl", 'printf "%s\\n" "$@" >> "$CALLS"');
  const execute = (body: string, extra: Record<string, string> = {}) =>
    spawnSync("/bin/bash", ["-e", "-o", "pipefail", "-c", body], {
      cwd: dir,
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, CALLS: calls, ...extra },
      encoding: "utf8",
      timeout: 5000,
    });
  return { dir, execute, executable, calls: () => readFileSync(calls, "utf8") };
}

describe("cloud monitor workflow execution", () => {
  it("bounds dependency setup and audit separately while retaining the watchdog", () => {
    for (const job of [monitor, backup]) {
      const dependencies = job.steps.find((s) => s.run === "pnpm install --frozen-lockfile")!;
      expect(dependencies["timeout-minutes"]).toBe(3);
      expect(dependencies["continue-on-error"]).not.toBe(true);
    }
    expect(
      step(monitor.steps, "Audit workflow state and actual execution")["timeout-minutes"],
    ).toBe(4);
    expect(step(monitor.steps, "Report to independent watchdog").if).toBe("always()");
    const native = step(backup.steps, "Install native backup clients");
    expect(native["timeout-minutes"]).toBe(8);
    expect(native.if).toBe("steps.operation.outputs.value != 'health'");
    expect(native.run).toContain("Acquire::http::Timeout=20");
    expect(native.run).toContain("Acquire::https::Timeout=20");
    expect(native.run).toContain("Acquire::Retries=2");
  });

  it("runs the real health command even when the Ubuntu mirror is unavailable", () => {
    const fixture = harness();
    const result = fixture.execute(step(monitor.steps, "Read encrypted repository freshness").run!);
    expect(result.status, result.stderr).toBe(0);
    expect(fixture.calls()).toContain("pnpm backup:private health");
  });

  it("does not access apt for the independent health operation", () => {
    const fixture = harness();
    const result = fixture.execute(step(backup.steps, "Install native backup clients").run!, {
      OPERATION: "health",
    });
    expect(result.status, result.stderr).toBe(0);
  });

  it("preserves a failed real health command and reports failure to the watchdog", () => {
    const fixture = harness();
    const health = step(monitor.steps, "Read encrypted repository freshness");
    expect(health["continue-on-error"]).not.toBe(true);
    const result = fixture.execute(health.run!, { HEALTH_EXIT: "17" });
    expect(result.status).toBe(17);
    const report = fixture.execute(step(monitor.steps, "Report to independent watchdog").run!, {
      AUDIT_RESULT: "failure",
      HEALTHCHECKS_PING_URL: "https://hc-ping.com/11111111-2222-3333-4444-555555555555",
    });
    expect(report.status, report.stderr).toBe(0);
    expect(fixture.calls()).toContain(
      "https://hc-ping.com/11111111-2222-3333-4444-555555555555/fail",
    );
  });

  it.each(["success", "failure", "cancelled"])(
    "reports %s without hiding non-success outcomes",
    (status) => {
      const fixture = harness();
      const url = "https://hc-ping.com/11111111-2222-3333-4444-555555555555";
      const result = fixture.execute(step(monitor.steps, "Report to independent watchdog").run!, {
        AUDIT_RESULT: status,
        HEALTHCHECKS_PING_URL: url,
      });
      expect(result.status, result.stderr).toBe(0);
      expect(fixture.calls().trim().split("\n").at(-1)).toBe(
        url + (status === "success" ? "" : "/fail"),
      );
    },
  );
});

describe("verified restic setup", () => {
  it("requires a bounded installation before health in both workflows", () => {
    for (const job of [monitor, backup]) {
      const install = step(job.steps, "Install verified restic");
      expect(install.run).toContain("bash scripts/install-restic.sh");
      expect(install["timeout-minutes"]).toBe(3);
      expect(install["continue-on-error"]).not.toBe(true);
      expect(job.steps.indexOf(install)).toBeLessThan(
        job.steps.indexOf(
          step(
            job.steps,
            job === monitor
              ? "Read encrypted repository freshness"
              : "Run backup operation and verify freshness",
          ),
        ),
      );
      const cache = step(job.steps, "Cache verified restic archive");
      expect(cache["continue-on-error"]).toBe(true);
      expect(cache["timeout-minutes"]).toBe(1);
    }
  });

  it.each([false, true])(
    "rejects unverified downloads with a bounded request (corrupt cache: %s)",
    (corruptCache) => {
      const fixture = harness();
      fixture.executable("uname", 'if [ "$1" = -s ]; then echo Linux; else echo x86_64; fi');
      fixture.executable(
        "curl",
        'printf "%s\\n" "$@" >> "$CALLS"; while [ "$#" -gt 0 ]; do if [ "$1" = --output ]; then printf untrusted > "$2"; break; fi; shift; done',
      );
      const cache = path.join(fixture.dir, "cache");
      mkdirSync(cache);
      if (corruptCache) writeFileSync(path.join(cache, "restic_0.19.1_linux_amd64.bz2"), "corrupt");
      const result = fixture.execute('bash "$INSTALL_SCRIPT" "$PWD/cache" "$PWD/installed"', {
        INSTALL_SCRIPT: path.join(root, "scripts/install-restic.sh"),
        GITHUB_PATH: path.join(fixture.dir, "github-path"),
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("checksum verification failed");
      expect(existsSync(path.join(fixture.dir, "installed/restic"))).toBe(false);
      expect(existsSync(path.join(cache, "restic_0.19.1_linux_amd64.bz2"))).toBe(false);
      expect(fixture.calls()).toContain("--connect-timeout\n10\n--max-time\n30\n--retry\n2");
      expect(fixture.calls()).toContain(
        "https://github.com/restic/restic/releases/download/v0.19.1/",
      );
    },
  );

  it("fails installation when the download times out rather than publishing a tool path", () => {
    const fixture = harness();
    fixture.executable("uname", 'if [ "$1" = -s ]; then echo Linux; else echo x86_64; fi');
    fixture.executable("curl", "exit 28");
    const githubPath = path.join(fixture.dir, "github-path");
    const result = fixture.execute('bash "$INSTALL_SCRIPT" "$PWD/cache" "$PWD/installed"', {
      INSTALL_SCRIPT: path.join(root, "scripts/install-restic.sh"),
      GITHUB_PATH: githubPath,
    });
    expect(result.status).toBe(28);
    expect(existsSync(githubPath)).toBe(false);
  });
});
