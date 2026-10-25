"use client";

import { type RefObject, useEffect } from "react";

import { type AsciiPattern, asciiCell, asciiGlyphs, glyphLevel } from "@/lib/ascii/flow-field";

const stepMs = 1000 / 15;

function brandColor(canvas: HTMLCanvasElement) {
  return getComputedStyle(canvas).getPropertyValue("--color-brand").trim();
}

// Draws an ASCII pattern on a canvas: 15 fps, paused off-screen, one still frame for reduced motion.
export function useAsciiField(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  intensity: AsciiPattern["intensity"],
) {
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    if (!canvas || !ctx) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cols = 0;
    let rows = 0;
    let visible = true;
    let timer = 0;
    let disposed = false;
    const startedAt = performance.now();

    const draw = (seconds: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = brandColor(canvas);

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const level = glyphLevel(intensity(col, row, seconds, { cols, rows }));

          if (level === 0) continue;

          ctx.globalAlpha = 0.35 + (0.65 * level) / (asciiGlyphs.length - 1);
          ctx.fillText(asciiGlyphs[level] ?? "", col * asciiCell.width, row * asciiCell.height);
        }
      }
    };

    const build = () => {
      const { width, height } = canvas.getBoundingClientRect();

      if (!width || !height) return;

      const ratio = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.font = `${asciiCell.fontPx}px ${getComputedStyle(canvas).fontFamily}`;
      ctx.textBaseline = "top";
      cols = Math.ceil(width / asciiCell.width);
      rows = Math.ceil(height / asciiCell.height);
      draw(still ? 0 : (performance.now() - startedAt) / 1000);
    };

    const tick = () => {
      timer = 0;

      if (disposed || still || !visible || document.hidden) return;

      draw((performance.now() - startedAt) / 1000);
      timer = window.setTimeout(() => requestAnimationFrame(tick), stepMs);
    };

    const resume = () => {
      if (!timer && !still && visible && !document.hidden) tick();
    };

    const resize = new ResizeObserver(build);

    const onScreen = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      resume();
    });

    resize.observe(canvas);
    onScreen.observe(canvas);
    document.addEventListener("visibilitychange", resume);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      resize.disconnect();
      onScreen.disconnect();
      document.removeEventListener("visibilitychange", resume);
    };
  }, [canvasRef, intensity]);
}
