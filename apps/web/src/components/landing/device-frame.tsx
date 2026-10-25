import { BatteryFull, Signal, Wifi } from "lucide-react";
import type { ReactNode } from "react";

// A current "Pro" phone drawn in CSS: titanium rim, side buttons, black bezel, Dynamic Island,
// status bar and home indicator. Deliberately unbranded.
export function DeviceFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative w-full max-w-phone">
      <span
        aria-hidden="true"
        className="absolute top-24 -left-0.5 h-7 w-1 rounded-l-sm bg-titanium-edge"
      />
      <span
        aria-hidden="true"
        className="absolute top-36 -left-0.5 h-12 w-1 rounded-l-sm bg-titanium-edge"
      />
      <span
        aria-hidden="true"
        className="absolute top-52 -left-0.5 h-12 w-1 rounded-l-sm bg-titanium-edge"
      />
      <span
        aria-hidden="true"
        className="absolute top-40 -right-0.5 h-20 w-1 rounded-r-sm bg-titanium-edge"
      />
      <div className="rounded-device bg-titanium p-0.75 shadow-phone">
        <div className="rounded-bezel bg-ink p-2.5">
          <div className="relative overflow-hidden rounded-screen bg-chat">
            <div
              aria-hidden="true"
              className="absolute top-2.5 left-1/2 z-10 h-8 w-28 -translate-x-1/2 rounded-full bg-ink"
            />
            <div
              aria-hidden="true"
              className="flex h-12 items-center justify-between bg-chat-bar px-7 pt-1 text-caption font-semibold tabular-nums"
            >
              <span>9:41</span>
              <span className="flex items-center gap-1">
                <Signal className="size-3.5" strokeWidth={2.5} />
                <Wifi className="size-3.5" strokeWidth={2.5} />
                <BatteryFull className="size-4.5" strokeWidth={2} />
              </span>
            </div>
            {children}
            <div aria-hidden="true" className="flex h-6 items-center justify-center">
              <span className="h-1 w-32 rounded-full bg-ink/80" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
