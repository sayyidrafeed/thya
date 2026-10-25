import { ChatText } from "@/components/chat/chat-text";

type Bar = { label: string; value: number; display: string };

const width = 252;
const plotTop = 20;
const plotHeight = 78;
const slot = width / 7;

// Daily bars as Thya would send them: the highest day in brand green, value on top, day below.
export function ChartBars({ bars, caption }: { bars: readonly Bar[]; caption: string }) {
  const max = Math.max(...bars.map((bar) => bar.value));
  const step = width / Math.max(bars.length, 1);

  return (
    <div className="flex flex-col gap-2 border-t border-line px-3 pt-3 pb-2.5">
      <svg viewBox={`0 0 ${width} 122`} aria-hidden="true" className="w-full">
        {bars.map((bar, index) => {
          const height = (bar.value / max) * plotHeight;
          const x = index * step + (step - slot * 0.62) / 2;
          const y = plotTop + plotHeight - height;
          const top = bar.value === max;

          return (
            <g key={bar.label}>
              <rect
                x={x}
                y={y}
                width={slot * 0.62}
                height={height}
                rx={3}
                className={top ? "fill-brand" : "fill-line-strong"}
              />
              <text
                x={x + slot * 0.31}
                y={y - 5}
                textAnchor="middle"
                fontSize={10}
                fontWeight={500}
                className="fill-ink"
              >
                {bar.display}
              </text>
              <text
                x={x + slot * 0.31}
                y={plotTop + plotHeight + 15}
                textAnchor="middle"
                fontSize={9}
                className="fill-ink-muted"
              >
                {bar.label}
              </text>
            </g>
          );
        })}
      </svg>
      <ChatText text={caption} />
    </div>
  );
}
