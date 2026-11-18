import Link from "next/link";
import { connection } from "next/server";
import { getDb } from "@/base/db/client";
import { isDemoOn } from "@/base/demo/mode";
import { Wordmark } from "../../_components/brand";
import { SignUpForm } from "./signup-form";

/** Sign up to apply (spec applicants §1). The demo explains and points at the Applicant persona. */
export default async function SignUpPage() {
  await connection(); // per request: never prerendered at build time (it reads the database)
  const demo = await isDemoOn(getDb());
  return (
    <>
      <div className="bg-sunset -mx-6 rounded-2xl p-5">
        <Wordmark className="text-5xl" />
        <p className="mt-3 text-sm font-semibold">Apply to join the camp</p>
      </div>
      {demo ? (
        <p className="text-sm">
          In the demo, nobody can sign up for real. Go back and pick the <b>Applicant</b> card to
          see what applying looks like.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Tell us who you are. We'll email you a login link (no password), then you can fill in
            the application.
          </p>
          <SignUpForm />
        </>
      )}
      <p className="text-center text-xs text-muted-foreground">
        Already have a login?{" "}
        <Link href="/login" className="font-semibold text-foreground underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
