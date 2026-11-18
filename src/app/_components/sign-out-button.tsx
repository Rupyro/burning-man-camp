"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { signOut } from "@/base/auth/server/actions";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await signOut({});
          router.push("/login");
        })
      }
    >
      Sign out
    </Button>
  );
}
