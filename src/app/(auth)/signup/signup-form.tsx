"use client";
import { useState, useTransition } from "react";
import { isActionFailure } from "@/base/api/action-result";
import { signUp } from "@/base/auth/server/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignUpForm() {
  const [name, setName] = useState("");
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
            const res = await signUp({ name, email });
            setMessage(isActionFailure(res) ? res.error : res.message);
          } catch {
            setMessage("Please enter your name and a valid email address.");
          }
        });
      }}
    >
      <Label htmlFor="name">Your name</Label>
      <Input
        id="name"
        autoComplete="name"
        required
        minLength={2}
        maxLength={80}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="min-h-11"
      />
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
        {pending ? "Sending…" : "Sign up and email me a login link"}
      </Button>
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
    </form>
  );
}
