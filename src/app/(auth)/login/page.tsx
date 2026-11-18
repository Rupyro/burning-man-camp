import Link from "next/link";
import { getDb } from "@/base/db/client";
import { isDemoOn } from "@/base/demo/mode";
import { Wordmark } from "../../_components/brand";
import { LoginForm } from "./login-form";
import { PersonaPicker } from "./persona-picker";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const demo = await isDemoOn(getDb());
  return (
    <>
      <div className="bg-sunset -mx-6 rounded-2xl p-5">
        <Wordmark className="text-5xl" />
        <p className="mt-3 text-sm font-semibold">
          {demo ? "Demo: pick who you want to be" : "Welcome home"}
        </p>
      </div>
      {demo ? (
        <>
          <p className="text-sm text-muted-foreground">
            Everything here is fake. Each card signs you in as that person, with exactly their
            permissions.
          </p>
          <PersonaPicker />
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Invite only. We'll email you a link; no password needed.
          </p>
          {error ? (
            <p
              role="alert"
              className="rounded-md border border-destructive p-3 text-sm text-destructive"
            >
              That login link didn't work (it may have expired or this email isn't invited). Ask for
              a new one.
            </p>
          ) : null}
          <LoginForm />
        </>
      )}
      <p className="text-center text-xs text-muted-foreground">
        New here and want to join the camp?{" "}
        <Link href="/signup" className="font-semibold text-foreground underline">
          Sign up
        </Link>
      </p>
    </>
  );
}
