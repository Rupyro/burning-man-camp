"use client";
import { useState, useTransition } from "react";
import { isActionFailure } from "@/base/api/action-result";
import { requestLoginLink } from "@/base/auth/server/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          try {
            const res = await requestLoginLink({ email });
            setMessage(isActionFailure(res) ? res.error : res.message);
          } catch {
            setMessage("Please enter a valid email address.");
          }
        });
      }}
    >
      <Label htmlFor="email">Email</Label>
      <Input
        id="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="min-h-11"
      />
      <Button type="submit" disabled={pending} className="min-h-11">
        {pending ? "Sending…" : "Email me a login link"}
      </Button>
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
    </form>
  );
}
