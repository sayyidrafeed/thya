"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

export type ThreadStage = "asked" | "typing" | "answered";

export type ThreadEntry = { key: number; index: number; stage: ThreadStage };

const typingAfterMs = 300;
const answerAfterMs = 950;
const keep = 3;

// Each newly active conversation is appended to the thread: the owner asks, Thya types, Thya answers.
export function useChatThread(activeIndex: number) {
  const reduceMotion = useReducedMotion();
  const counter = useRef(0);
  const [entries, setEntries] = useState<ThreadEntry[]>([]);

  useEffect(() => {
    counter.current += 1;

    const key = counter.current;

    const stageOf = (stage: ThreadStage) => (entry: ThreadEntry) =>
      entry.key === key ? { ...entry, stage } : entry;

    // Re-running for the same conversation (Strict Mode, re-selecting it) replaces the last entry.
    setEntries((current) => [
      ...(current.at(-1)?.index === activeIndex ? current.slice(0, -1) : current).slice(
        -(keep - 1),
      ),
      { key, index: activeIndex, stage: reduceMotion === true ? "answered" : "asked" },
    ]);

    if (reduceMotion === true) return;

    const typing = setTimeout(
      () => setEntries((current) => current.map(stageOf("typing"))),
      typingAfterMs,
    );

    const answer = setTimeout(
      () => setEntries((current) => current.map(stageOf("answered"))),
      answerAfterMs,
    );

    return () => {
      clearTimeout(typing);
      clearTimeout(answer);
    };
  }, [activeIndex, reduceMotion]);

  return entries;
}
