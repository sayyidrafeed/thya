import { type ShopAppId, shopApps } from "@/lib/landing/shop-apps";

const tileClass = {
  gofood: "bg-app-gofood",
  grabfood: "bg-app-grabfood",
  shopeefood: "bg-app-shopeefood",
  whatsapp: "bg-app-whatsapp",
  sheets: "bg-app-sheets",
  gmail: "bg-app-gmail",
  instagram: "bg-app-instagram",
  tiktok: "bg-app-tiktok",
} as const satisfies Record<ShopAppId, string>;

const sizeClass = {
  sm: "size-5 rounded-md p-1",
  md: "size-12 rounded-xl p-2.5",
} as const;

// An app tile in the app's brand colour with its white glyph, like a home-screen icon.
export function AppIcon({ app, size = "md" }: { app: ShopAppId; size?: keyof typeof sizeClass }) {
  return (
    <span className={`grid shrink-0 place-items-center ${tileClass[app]} ${sizeClass[size]}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-full fill-surface-raised">
        <path d={shopApps[app].path} />
      </svg>
    </span>
  );
}
