"use client";
import { usePathname } from "next/navigation";

/** The slim sunset bar; on a phone the home page has its own big header instead. */
export function TopBar({ children }: { children: React.ReactNode }) {
  const home = usePathname() === "/";
  return (
    <header
      className={`app-top bg-sunset items-center justify-between gap-3 px-4 py-2 lg:flex lg:py-3 ${home ? "hidden" : "flex"}`}
    >
      {children}
    </header>
  );
}
