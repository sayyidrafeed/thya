import { NotebookPen, QrCode } from "lucide-react";

import { type ShopAppId, shopApps } from "@/lib/landing/shop-apps";

// Brand apps draw their own glyph; QRIS and the notebook have none we can use, so they get a Lucide one.
const genericGlyph = { qris: QrCode, notebook: NotebookPen } as const;

export type TileId = ShopAppId | keyof typeof genericGlyph;

const tileClass = {
  whatsapp: "bg-app-whatsapp",
  sheets: "bg-app-sheets",
  gmail: "bg-app-gmail",
  qris: "bg-app-qris",
  notebook: "bg-brand",
} as const satisfies Record<TileId, string>;

const sizeClass = {
  sm: "size-5 rounded-md p-1",
  md: "size-12 rounded-xl p-2.5",
} as const;

// An app tile in the app's colour with a white glyph, like a home-screen icon.
export function AppIcon({ app, size = "md" }: { app: TileId; size?: keyof typeof sizeClass }) {
  const className = `grid shrink-0 place-items-center text-surface-raised ${tileClass[app]} ${sizeClass[size]}`;

  if (app === "qris" || app === "notebook") {
    const Glyph = genericGlyph[app];

    return (
      <span className={className}>
        <Glyph aria-hidden="true" className="size-full" strokeWidth={2.25} />
      </span>
    );
  }

  return (
    <span className={className}>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-full fill-current">
        <path d={shopApps[app].path} />
      </svg>
    </span>
  );
}
