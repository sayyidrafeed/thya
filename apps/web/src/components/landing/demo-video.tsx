"use client";

import { Play } from "lucide-react";
import { useRef, useState } from "react";

import { SectionHeading } from "@/components/landing/section-heading";

// The 70 s demo, self-hosted (6 MB H.264, faststart). preload="none" keeps it off the page load;
// nothing downloads until the visitor presses play.
export function DemoVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);

  function play() {
    setStarted(true);
    void videoRef.current?.play();
  }

  return (
    <section
      id="demo"
      aria-labelledby="demo-title"
      className="mx-auto flex w-full max-w-page scroll-mt-20 flex-col items-center gap-12 px-4 pb-section sm:px-6"
    >
      <SectionHeading
        eyebrow="Demo"
        title={<span id="demo-title">See Thya in 70 seconds.</span>}
        lead="A closing-time chat with Kopi Senja, a sample coffee shop."
      />
      <div className="relative aspect-video w-full max-w-4xl overflow-hidden rounded-panel bg-brand-deep shadow-phone">
        {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- music and SFX only, no speech; the story is on-screen text (docs/video/storyboard.md) */}
        <video
          ref={videoRef}
          src="/video/thya-demo.mp4"
          poster="/video/thya-demo-poster.webp"
          preload="none"
          playsInline
          controls={started}
          className="size-full object-cover"
        />
        {started ? null : (
          <button
            type="button"
            onClick={play}
            className="group absolute inset-0 grid cursor-pointer place-items-center focus-visible:outline-none"
          >
            <span className="flex items-center gap-3 rounded-control glass py-2 pr-5 pl-2 text-body font-medium text-ink transition duration-200 group-hover:scale-105 group-focus-visible:ring-2 group-focus-visible:ring-ring group-active:scale-97">
              <span className="grid size-10 place-items-center rounded-full bg-ink text-surface">
                <Play aria-hidden="true" className="size-4 translate-x-px fill-current" />
              </span>
              Play demo · 1:10
            </span>
          </button>
        )}
      </div>
    </section>
  );
}
