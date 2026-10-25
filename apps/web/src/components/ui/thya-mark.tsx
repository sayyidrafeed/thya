import Image from "next/image";

// Source art is 749×928; heights below keep that ratio so the mark never shifts layout.
const sizes = {
  sm: { width: 23, height: 28, className: "h-7 w-auto" },
  md: { width: 29, height: 36, className: "h-9 w-auto" },
  lg: { width: 39, height: 48, className: "h-12 w-auto" },
} as const;

export function ThyaMark({ size = "sm" }: { size?: keyof typeof sizes }) {
  const { width, height, className } = sizes[size];

  return (
    <Image
      src="/brand/thya-mascot.webp"
      alt=""
      width={width}
      height={height}
      className={className}
      priority={size === "sm"}
    />
  );
}
