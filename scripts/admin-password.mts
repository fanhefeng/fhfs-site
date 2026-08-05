/**
 * Prints the two secrets the admin needs, or hashes a password you choose.
 *
 *   pnpm admin:password              # invents a strong password
 *   pnpm admin:password "my pass"    # hashes yours
 *
 * The hash is what goes in the environment; the password itself is never
 * stored anywhere.
 */
import { randomBytes } from "node:crypto";
import { hashPassword } from "../src/lib/auth/password";

const given = process.argv.slice(2).filter((arg) => !arg.startsWith("-"))[0];
const password = given ?? randomBytes(12).toString("base64url");

console.log(`ADMIN_PASSWORD_HASH='${hashPassword(password)}'`);
console.log(`AUTH_SECRET='${randomBytes(32).toString("base64")}'`);
console.log();
console.log(given ? "hashed the password you gave" : `password: ${password}`);
console.log("put the two lines above in .env.local, then `vercel env add` them");
