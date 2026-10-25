"use client";

import { type RefObject, useEffect } from "react";

import { convergenceFibres } from "@/lib/footer-art/convergence";
import { gpuScene, paintStill, type Rgb } from "@/lib/footer-art/scene";

function brandRgb(element: Element): Rgb {
  const hex = getComputedStyle(element).getPropertyValue("--color-brand").trim().replace("#", "");
  const channel = (start: number) => Number.parseInt(hex.slice(start, start + 2), 16) / 255 || 0;

  return [channel(0), channel(2), channel(4)];
}

// Pattern from FIKES' pulse panel: GPU scene each frame while on screen, rebuilt after resizes or a
// lost context. Without WebGL2 the fibres are painted once in 2D; reduced motion draws frame 0 only.
export function useConvergenceCanvas(canvasRef: RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const color = brandRgb(canvas);
    const fibres = convergenceFibres();
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, antialias: true });
    let draw: ((seconds: number) => void) | null = null;
    let frame = 0;
    let pending = 0;
    let visible = true;

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      draw?.(now / 1000);
    };

    const start = () => {
      cancelAnimationFrame(frame);

      // GL lines are one device pixel wide; drawing at CSS pixels keeps them visible on retina.
      const ratio = gl ? 1 : Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.round(canvas.clientWidth * ratio);
      canvas.height = Math.round(canvas.clientHeight * ratio);

      if (canvas.width === 0 || canvas.height === 0) return;

      if (!gl) {
        const ctx = canvas.getContext("2d");

        if (ctx) paintStill(ctx, fibres, color);

        return;
      }

      draw = gpuScene(gl, fibres, color);

      if (still || !draw) draw?.(0);
      else if (visible && !document.hidden) frame = requestAnimationFrame(loop);
    };

    const resume = () => {
      cancelAnimationFrame(frame);

      if (draw && !still && visible && !document.hidden) frame = requestAnimationFrame(loop);
    };

    // A window drag fires many resizes: rebuild once, on the frame after the last of them.
    const resize = new ResizeObserver(() => {
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(start);
    });

    const onScreen = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      resume();
    });

    const onLost = (event: Event) => {
      event.preventDefault();
      cancelAnimationFrame(frame);
      draw = null;
    };

    resize.observe(canvas);
    onScreen.observe(canvas);
    document.addEventListener("visibilitychange", resume);
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", start);

    return () => {
      resize.disconnect();
      onScreen.disconnect();
      document.removeEventListener("visibilitychange", resume);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", start);
      cancelAnimationFrame(pending);
      cancelAnimationFrame(frame);
    };
  }, [canvasRef]);
}
