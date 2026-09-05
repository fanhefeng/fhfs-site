"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyPassword } from "@/lib/auth/password";
import { clearAttempts, recordAttempt } from "@/lib/auth/throttle";
import {
  clearSessionCookie,
  createSession,
  setSessionCookie,
} from "@/lib/auth/session";

export type LoginState = { error?: string };

/**
 * Sign in.
 *
 * The failure messages are deliberately uninformative — a wrong password and a
 * missing one say the same thing — and every attempt is recorded before the
 * password is even looked at, so the throttle counts guesses rather than
 * successes. The record and the verdict travel as one request (lib/auth/
 * throttle.ts), so a burst of concurrent guesses cannot all slip under the
 * same count.
 */
export async function login(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const stored = process.env.ADMIN_PASSWORD_HASH;
  const secret = process.env.AUTH_SECRET;
  if (!stored || !secret) {
    return { error: "服务器未配置管理员密码。" };
  }

  const headerList = await headers();
  // Trusting the leftmost XFF entry is only sound behind a proxy that
  // overwrites the header (Vercel does). Self-hosting without one would let
  // a client mint fresh identities per request and reset its own throttle.
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0].trim() ??
    headerList.get("x-real-ip") ??
    "unknown";

  const { throttled } = await recordAttempt(ip);
  if (throttled) {
    return { error: "尝试次数过多，请等 15 分钟后再试。" };
  }

  const password = formData.get("password");
  if (typeof password !== "string" || !verifyPassword(password, stored)) {
    return { error: "密码不对。" };
  }

  await setSessionCookie(await createSession());
  await clearAttempts(ip);

  const next = formData.get("next");
  redirect(typeof next === "string" && next.startsWith("/admin") ? next : "/admin");
}

export async function logout(): Promise<void> {
  await clearSessionCookie();
  redirect("/admin/login");
}
