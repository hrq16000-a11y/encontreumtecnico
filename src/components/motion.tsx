import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Scroll-reveal wrapper. Content stays in the DOM (readable by Google and
 * screen readers); only opacity/translate animate. Respects reduced motion
 * and falls back to visible when IntersectionObserver is unavailable.
 */
export function Reveal({
  children,
  delay = 0,
  y = 18,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : `translateY(${y}px)`,
        transition:
          "opacity .7s cubic-bezier(.2,.7,.2,1), transform .7s cubic-bezier(.2,.7,.2,1)",
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  text,
  align = "left",
  tone = "light",
}: {
  eyebrow?: string;
  title: string;
  text?: string;
  align?: "left" | "center";
  tone?: "light" | "dark";
}) {
  const centered = align === "center";
  return (
    <div className={`${centered ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}`}>
      {eyebrow && (
        <p
          className={`text-xs font-semibold uppercase tracking-[0.18em] ${
            tone === "dark" ? "text-brand-glow" : "text-primary"
          }`}
        >
          {eyebrow}
        </p>
      )}
      <h2
        className={`mt-2 text-2xl font-bold tracking-tight md:text-3xl ${
          tone === "dark" ? "text-brand-navy-foreground" : "text-foreground"
        }`}
      >
        {title}
      </h2>
      {text && (
        <p
          className={`mt-3 text-muted-foreground ${
            tone === "dark" ? "opacity-80" : ""
          }`}
        >
          {text}
        </p>
      )}
    </div>
  );
}
