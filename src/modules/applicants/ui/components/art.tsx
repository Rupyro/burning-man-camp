import type { SVGProps } from "react";
import { CAMP_NAME } from "@/lib/camp";

/** A line drawing of the camp's roaming art car under a desert sun (no photos of people). */
export function ArtCarSun(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 160 70" fill="none" stroke="currentColor" strokeWidth="2.5" {...props}>
      <title>{`The ${CAMP_NAME} art car`}</title>
      <circle cx="128" cy="18" r="11" />
      <path d="M128 1v4M128 31v4M111 18h4M141 18h4M116 6l3 3M137 27l3 3M140 6l-3 3M119 27l-3 3" />
      <path d="M4 62h152" strokeDasharray="2 6" />
      <path d="M18 52V36h52l14-12h22v28" />
      <path d="M30 36V26h30v10M92 24v-8h10" />
      <circle cx="34" cy="55" r="7" />
      <circle cx="94" cy="55" r="7" />
      <path d="M41 55h46" />
    </svg>
  );
}
