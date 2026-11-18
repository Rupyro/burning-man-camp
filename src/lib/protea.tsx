// Self-drawn king protea (the Oe-aa-sies camp flower). One protea that opens a little more for
// each year: 1 a closed bud, 2 half open, 3 mostly open, 4+ full bloom with a soft glow.
// Static SVG, no motion, no outside artwork.

type Row = { n: number; spread: number; len: number; w: number };
const STAGES: Record<1 | 2 | 3 | 4, { back: Row; front: Row; dome: number }> = {
  1: {
    back: { n: 5, spread: 10, len: 36, w: 7 },
    front: { n: 3, spread: 6, len: 32, w: 7 },
    dome: 0,
  },
  2: {
    back: { n: 7, spread: 26, len: 38, w: 7.5 },
    front: { n: 5, spread: 18, len: 26, w: 7 },
    dome: 9,
  },
  3: {
    back: { n: 9, spread: 52, len: 40, w: 7.5 },
    front: { n: 7, spread: 40, len: 22, w: 7 },
    dome: 15,
  },
  4: {
    back: { n: 11, spread: 80, len: 42, w: 7.5 },
    front: { n: 9, spread: 62, len: 20, w: 7 },
    dome: 17,
  },
};
const f = (x: number) => x.toFixed(1);
function bract(l: number, w: number) {
  return `M0,0 C${f(w)},${f(-l * 0.3)} ${f(w * 0.7)},${f(-l * 0.78)} 0,${f(-l)} C${f(-w * 0.7)},${f(-l * 0.78)} ${f(-w)},${f(-l * 0.3)} 0,0Z`;
}
function Bracts({ row, fill, stroke }: { row: Row; fill: string; stroke: string }) {
  return (
    <>
      {Array.from({ length: row.n }, (_, i) => {
        const a = row.n === 1 ? 0 : -row.spread + (2 * row.spread * i) / (row.n - 1);
        const l = row.len * (1 - (0.18 * Math.abs(a)) / 90);
        return (
          <path
            key={a}
            className="protea-bract"
            d={bract(l, row.w)}
            transform={`translate(50 70) rotate(${f(a)})`}
            fill={fill}
            stroke={stroke}
            strokeWidth=".8"
          />
        );
      })}
    </>
  );
}

export function Protea({
  stage,
  head = false,
  className,
  label,
}: {
  stage: number;
  /** Flower head only (no stem or leaves): for badges and small marks. */
  head?: boolean;
  className?: string;
  label?: string;
}) {
  const st = Math.min(4, Math.max(1, Math.round(stage))) as 1 | 2 | 3 | 4;
  const s = STAGES[st];
  const r = s.dome;
  const cy = 70 - r * 1.45;
  return (
    <svg
      viewBox={head ? "12 14 76 64" : "0 0 100 100"}
      data-stage={st}
      className={["protea", st === 4 ? "protea-glow" : "", className ?? ""].join(" ").trim()}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {head ? null : (
        <g className="protea-stem">
          <path
            d="M50,72 L50,98"
            stroke="var(--protea-stem)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path d="M50,88 C38,84 30,90 26,97 C36,98 45,95 50,88Z" fill="var(--protea-leaf-left)" />
          <path d="M50,82 C62,77 71,82 75,89 C65,91 56,89 50,82Z" fill="var(--protea-leaf-right)" />
        </g>
      )}
      <Bracts
        row={s.back}
        fill="var(--protea-bract-back)"
        stroke="var(--protea-bract-back-stroke)"
      />
      {r ? (
        <g className="protea-dome">
          <ellipse
            cx="50"
            cy={f(cy)}
            rx={f(r)}
            ry={f(r * 1.05)}
            fill="var(--protea-dome)"
            stroke="var(--protea-dome-stroke)"
            strokeWidth=".8"
          />
          <ellipse
            cx="47"
            cy={f(cy - r * 0.35)}
            rx={f(r * 0.55)}
            ry={f(r * 0.4)}
            fill="var(--protea-dome-highlight)"
          />
          {[0, 0.9, 1.8, 2.7, 3.6, 4.5, 5.4].map((t) => (
            <circle
              key={t}
              cx={f(50 + Math.cos(t) * r * 0.6)}
              cy={f(cy + Math.sin(t) * r * 0.55)}
              r="1"
              fill="var(--protea-anther)"
            />
          ))}
        </g>
      ) : null}
      <Bracts
        row={s.front}
        fill="var(--protea-bract-front)"
        stroke="var(--protea-bract-front-stroke)"
      />
    </svg>
  );
}

/** The tiny bud mark on a picked year chip. */
export function ProteaBud({ className }: { className?: string }) {
  return <Protea stage={1} head className={["protea-bud", className ?? ""].join(" ").trim()} />;
}
