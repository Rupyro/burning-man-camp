"use client";
import { useEffect, useRef } from "react";

/**
 * The fixed brand-book photo behind every page. Which photo (daily rotation) and day or night are
 * chosen by classes the pre-paint theme script sets on <html>, so server and client render the
 * same markup. The faint logo drifts at ~0.3x scroll for depth; off under reduced motion.
 */
export function Backdrop() {
  const mark = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = mark.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!el || reduced.matches) return;
    let frame = 0;
    const draw = () => {
      frame = 0;
      el.style.setProperty("--drift", `${(-0.3 * window.scrollY).toFixed(1)}px`);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    draw();
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div aria-hidden className="backdrop">
      <span ref={mark} />
    </div>
  );
}
