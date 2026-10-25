"use client";

import { SendHorizontal } from "lucide-react";

import { ChatBubble } from "@/components/chat/chat-bubble";
import { demoSuggestions, useDemoChat } from "@/hooks/use-demo-chat";

export function DemoChat() {
  const chat = useDemoChat();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-prose flex-col bg-chat">
      <header className="bg-brand px-4 py-3 text-on-brand">
        <h1 className="text-body font-medium">Thya</h1>
        <p className="text-caption">Demo: Kopi Senja, Yogyakarta</p>
      </header>
      <ol aria-live="polite" className="flex flex-1 flex-col gap-2 p-3">
        {chat.lines.map((line) => (
          <li key={line.id} className="flex flex-col">
            <ChatBubble side={line.side} text={line.text} />
          </li>
        ))}
        {chat.checkingData || chat.waiting ? (
          <li className="text-caption text-ink-muted">Thya lagi cek data…</li>
        ) : null}
        {chat.failed ? (
          <li className="text-caption text-ink-muted">
            Maaf Kak, Thya lagi gangguan. Coba kirim ulang sebentar lagi ya.
          </li>
        ) : null}
      </ol>
      {chat.lines.length === 0 ? (
        <div className="flex flex-wrap gap-2 px-3 pb-3">
          {demoSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => chat.send(suggestion)}
              className="min-h-11 rounded-control bg-surface px-3 text-caption text-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
      <form
        className="flex gap-2 bg-surface-muted p-3"
        onSubmit={(event) => {
          event.preventDefault();
          chat.send(chat.draft);
        }}
      >
        <label htmlFor="demo-input" className="sr-only">
          Pesan untuk Thya
        </label>
        <input
          id="demo-input"
          value={chat.draft}
          onChange={(event) => chat.setDraft(event.target.value)}
          placeholder="Tanya soal penjualan…"
          className="min-h-11 flex-1 rounded-control bg-surface px-4 text-chat text-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
        <button
          type="submit"
          disabled={chat.busy}
          aria-label="Kirim"
          className="inline-flex size-11 items-center justify-center rounded-full bg-brand text-on-brand disabled:opacity-50"
        >
          <SendHorizontal aria-hidden className="size-5" />
        </button>
      </form>
    </main>
  );
}
