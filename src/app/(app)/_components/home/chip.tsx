import type { ChipTone } from "@/base/landing/home-rules";

const TONE: Record<ChipTone | "blocked" | "waiting", string> = {
  late: "bg-late text-late-foreground",
  soon: "bg-soon text-soon-foreground",
  normal: "bg-normal text-normal-foreground",
  blocked: "bg-blocked text-blocked-foreground",
  waiting: "border border-current text-waiting",
};

export function Chip({ tone, children }: { tone: keyof typeof TONE; children?: React.ReactNode }) {
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}
