/**
 * Prints the two secrets the admin needs, or hashes a password you choose.
 *
 *   pnpm admin:password                    # prompts; empty invents a strong one
 *   echo 'my pass' | pnpm admin:password   # non-interactive
 *
 * The password never travels as an argument on purpose: argv lands in shell
 * history and `ps` output, which is exactly where a credential must not be.
 * The hash is what goes in the environment; the password itself is never
 * stored anywhere.
 */
import { randomBytes } from "node:crypto";
import { hashPassword } from "../src/lib/auth/password";

if (process.argv.length > 2) {
  console.error(
    "密码不走命令行参数——它会进 shell history 和 ps 输出。直接运行，在提示符里输入（或用管道传入）。"
  );
  process.exit(1);
}

/** One line from the terminal with echo off, or from a pipe as-is. */
function readPassword(): Promise<string> {
  const { stdin } = process;
  if (!stdin.isTTY) {
    return new Promise((resolve) => {
      let data = "";
      stdin.setEncoding("utf8");
      stdin.on("data", (chunk) => (data += chunk));
      // Only the line ending comes off. Anything else — leading or trailing
      // spaces included — is part of the password: the login form hands the
      // field to verifyPassword untrimmed, so trimming here would mint a hash
      // no typed password can ever match.
      stdin.on("end", () =>
        resolve((data.split("\n")[0] ?? "").replace(/\r$/, ""))
      );
    });
  }
  process.stderr.write("要哈希的密码（留空自动生成，输入不回显）: ");
  return new Promise((resolve) => {
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let entered = "";
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\u0003") {
          // Ctrl-C
          process.stderr.write("\n");
          process.exit(130);
        }
        if (ch === "\r" || ch === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stderr.write("\n");
          resolve(entered);
          return;
        }
        if (ch === "\u007f" || ch === "\b") {
          entered = entered.slice(0, -1);
        } else {
          entered += ch;
        }
      }
    };
    stdin.on("data", onData);
  });
}

const given = await readPassword();
const password = given || randomBytes(12).toString("base64url");

console.log(`ADMIN_PASSWORD_HASH='${hashPassword(password)}'`);
console.log(`AUTH_SECRET='${randomBytes(32).toString("base64")}'`);
console.log();
console.log(given ? "hashed the password you gave" : `password: ${password}`);
console.log("put the two lines above in .env.local, then `vercel env add` them");
