// Misty layered hills drawn in SVG, so the footer needs no photo asset.
const layers = [
  {
    fill: "fill-hill-far",
    d: "M0 210 C 160 150 300 170 430 140 C 560 110 650 60 760 70 C 880 80 960 150 1100 140 C 1240 130 1340 90 1440 110 L1440 400 L0 400 Z",
  },
  {
    fill: "fill-hill-mid",
    d: "M0 260 C 140 220 260 240 400 210 C 560 175 700 230 860 205 C 1020 180 1160 150 1300 175 C 1380 190 1420 200 1440 205 L1440 400 L0 400 Z",
  },
  {
    fill: "fill-hill-near",
    d: "M0 300 C 180 260 320 300 520 275 C 700 252 820 290 1000 280 C 1180 270 1300 240 1440 255 L1440 400 L0 400 Z",
  },
  {
    fill: "fill-hill-front",
    d: "M0 350 C 220 320 420 345 640 330 C 860 315 1060 345 1260 330 C 1350 323 1410 325 1440 328 L1440 400 L0 400 Z",
  },
] as const;

export function FooterLandscape() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1440 400"
      preserveAspectRatio="xMidYMax slice"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-3/4 w-full"
    >
      {layers.map((layer) => (
        <path key={layer.fill} d={layer.d} className={layer.fill} />
      ))}
    </svg>
  );
}
