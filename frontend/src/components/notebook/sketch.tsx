"use client";

import { useEffect, useRef, type ReactNode } from "react";
import rough from "roughjs";
import { annotate } from "rough-notation";

export function Paper({
  children,
  className = "",
  tone = "paper",
  id,
}: {
  children: ReactNode;
  className?: string;
  tone?: string;
  id?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!box.current || !svg.current) return;
    const node = box.current;
    const surface = svg.current;
    let frame = 0;
    let lastWidth = 0;
    let lastHeight = 0;
    const draw = () => {
      // Measure the page itself, not its rotated screen-space bounding box.
      const width = node.offsetWidth;
      const height = node.offsetHeight;
      if (!width || !height || (width === lastWidth && height === lastHeight)) return;
      lastWidth = width;
      lastHeight = height;
      surface.replaceChildren();
      surface.setAttribute("viewBox", `0 0 ${width} ${height}`);
      const pen = rough.svg(surface);
      surface.appendChild(
        pen.rectangle(2, 2, width - 4, height - 4, {
          seed: 28,
          roughness: 1.25,
          bowing: 1.1,
          stroke: "#7c7d6f",
          strokeWidth: 0.8,
          disableMultiStroke: false,
        }),
      );
    };
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(draw);
    });
    observer.observe(node);
    draw();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div id={id} ref={box} className={`paper paper-${tone} ${className}`}>
      <svg ref={svg} className="paper-edge" aria-hidden="true" />
      <div className="paper-content">{children}</div>
    </div>
  );
}

export function Mark({
  children,
  color = "#e8d983",
  type = "underline",
}: {
  children: ReactNode;
  color?: string;
  type?: "underline" | "highlight" | "circle";
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const mark = annotate(ref.current, {
      type,
      color,
      strokeWidth: 2,
      padding: 3,
      animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      animationDuration: 500,
      multiline: true,
      iterations: 2,
    });
    mark.show();
    return () => mark.remove();
  }, [type, color]);
  return (
    <span ref={ref} className="ink-mark">
      {children}
    </span>
  );
}

export function NotebookLogo({ small = false }: { small?: boolean }) {
  return (
    <div className={`notebook-logo ${small ? "small" : ""}`}>
      <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <path
          d="M8 5l19 1 5 6-1 23-23-1V5M26 6v7l6-1M12 5l-1 29"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <path
          d="M7 12h8M7 21h7M7 29h7M19 21h8M19 26h5"
          stroke="currentColor"
          strokeWidth=".5"
        />
      </svg>
      <div>
        <strong>Continuum</strong>
      </div>
    </div>
  );
}

export function MountainSketch({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 300 130"
      fill="none"
      className={`mountain-sketch ${className}`}
      aria-hidden="true"
    >
      <path
        d="M12 111l53-66 36 42 56-77 118 105M14 112l52-64 33 41 59-76 115 100M39 77l24 5 12-9M122 57l20 10 17-8 21 10M156 13l-8 75 39 26M74 65l15 48M9 118c63-5 136 6 275-1"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M222 34c18-21 24-1 21 8-5 10-20 10-23 0-4-8-1-19 10-20M232 10v-7M257 30l9-1M211 18l-5-5M247 56l3 5"
        stroke="#bd9e37"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path d="M98 104l-2 11M92 107l9-1" stroke="#788b76" strokeWidth="1.5" />
    </svg>
  );
}
