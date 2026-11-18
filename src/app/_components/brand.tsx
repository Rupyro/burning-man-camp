// Oe-aa-sies brand pieces: the brand-book wordmark (masked, takes currentColor) and two small
// original line drawings.
import type { SVGProps } from "react";
import { CAMP_NAME } from "@/lib/camp";

/** The brand-book "Oe-aa-sieS" logo, sized by font-size (1em tall) and coloured by currentColor. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span role="img" aria-label={CAMP_NAME} className={`inline-block ${className}`}>
      <span
        className="block h-[1em] w-[5.07em] bg-current"
        style={{ mask: "url(/backdrop/wordmark.svg) left center / contain no-repeat" }}
      />
    </span>
  );
}

const line = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** An ox pulling a covered wagon (canvas hood, spoked wheels), side view. */
export function OxWagon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 160 64" role="img" aria-label="Ox wagon" {...props}>
      <g {...line}>
        {/* canvas hood with ribs */}
        <path d="M58 34 C58 10 112 10 112 34" />
        <path d="M71 34 C71 18 99 18 99 34" opacity=".55" />
        <path d="M85 14 V34" opacity=".55" />
        {/* wagon bed */}
        <path d="M52 34 H118 L114 42 H56 Z" />
        {/* wheels */}
        <circle cx="64" cy="50" r="10" />
        <circle cx="106" cy="50" r="10" />
        <path d="M64 40 V60 M54 50 H74 M57 43 L71 57 M71 43 L57 57" opacity=".7" />
        <path d="M106 40 V60 M96 50 H116 M99 43 L113 57 M113 43 L99 57" opacity=".7" />
        {/* draw pole to the ox */}
        <path d="M54 40 L36 40" />
        {/* ox: body, legs, head, long horns */}
        <path d="M8 30 C8 24 34 24 36 30 L36 40 C30 42 14 42 8 40 Z" />
        <path d="M12 41 V54 M18 42 V54 M28 42 V54 M33 41 V54" />
        <path d="M8 30 L2 34 L4 40 L9 39" />
        <path d="M5 31 C0 25 -2 26 1 22 M7 30 C12 23 16 24 14 20" />
        <path d="M36 32 C40 36 40 42 38 46" opacity=".6" />
      </g>
    </svg>
  );
}

/** A party art car: a bus with a disco ball on a mast, speakers and light beams. */
export function ArtCar(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 160 64" role="img" aria-label="Art car" {...props}>
      <g {...line}>
        {/* body and cab */}
        <path d="M20 46 V26 Q20 22 24 22 H112 L130 34 H140 Q144 34 144 38 V46 Z" />
        <path d="M112 22 V34 H130" opacity=".7" />
        {/* windows */}
        <path d="M30 28 H46 V36 H30 Z M54 28 H70 V36 H54 Z M78 28 H94 V36 H78 Z" opacity=".7" />
        {/* wheels */}
        <circle cx="42" cy="50" r="7" />
        <circle cx="122" cy="50" r="7" />
        {/* mast, disco ball and beams */}
        <path d="M66 22 V12" />
        <circle cx="66" cy="8" r="5" />
        <path d="M63 6 H69 M62 9 H70 M66 3 V13" opacity=".6" />
        <path d="M58 4 L44 0 M74 4 L88 0 M58 12 L46 16 M74 12 L86 16" opacity=".5" />
        {/* speakers on the roof */}
        <path d="M26 22 V14 H38 V22 M94 22 V14 H106 V22" />
        <circle cx="32" cy="18" r="2" />
        <circle cx="100" cy="18" r="2" />
        {/* zig-zag paint */}
        <path
          d="M24 42 L32 38 L40 42 L48 38 L56 42 L64 38 L72 42 L80 38 L88 42 L96 38 L104 42"
          opacity=".6"
        />
      </g>
    </svg>
  );
}
