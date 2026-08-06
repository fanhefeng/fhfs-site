import { LoginForm } from "./LoginForm";

/**
 * One field. There is one account, so there is nothing to identify — only
 * something to prove.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6">
      <h1 className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
        fhf · admin
      </h1>
      {/* Carried through the sign-in so a bookmarked edit page comes back.
          `next` can arrive as an array (?next=a&next=b) — treat that as unset. */}
      <LoginForm
        next={typeof next === "string" && next.startsWith("/admin") ? next : ""}
      />
    </main>
  );
}
