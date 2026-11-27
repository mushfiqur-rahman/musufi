import type { Art } from "@/lib/products";

// Product image slot. Until real photos exist it shows a flat illustration
// for the product type. Later: swap for <Image src=... alt=... /> from next/image.
export function ProductPhoto({ label, art, src, className, closeUp, note }: { label: string; art?: Art; src?: string; className?: string; closeUp?: boolean; note?: string }) {
  if (src) {
    return (
      <div className={`photo-slot photo${className ? ` ${className}` : ""}`}>
        {/* Already resized at upload; plain img avoids server-side image processing (no native deps). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={label} loading="lazy" decoding="async" />
      </div>
    );
  }
  if (!art) {
    return (
      <div className={`photo-slot${className ? ` ${className}` : ""}`} role="img" aria-label={label}>
        <span>{note ?? "ছবি আসছে"}</span>
      </div>
    );
  }
  return (
    <div className={`photo-slot art${closeUp ? " close" : ""}${className ? ` ${className}` : ""}`}>
      <svg viewBox="0 0 200 200" role="img" aria-label={label || undefined} aria-hidden={label ? undefined : true}>
        <ellipse cx="100" cy="176" rx="58" ry="7" fill="#173F2A" opacity=".10" />
        {art in shapes ? shapes[art] : null}
      </svg>
    </div>
  );
}

// Palette shared by all illustrations so they read as one set.
const C = {
  green: "#23613F",
  greenDark: "#173F2A",
  cream: "#FBF7EC",
  amber: "#D9962A",
  amberLight: "#EDB54C",
  honey: "#C9821C",
  ghee: "#F1D27C",
  red: "#A8461E",
  brown: "#8A5426",
  brownLight: "#B5793A",
  silver: "#C9D3D6",
  silverDark: "#8C9BA1",
  ink: "#24302A",
  hi: "#FFFFFF",
};

const Label = ({ x, y, w, h }: { x: number; y: number; w: number; h: number }) => (
  <>
    <rect x={x} y={y} width={w} height={h} rx="4" fill={C.cream} />
    <path d={`M${x + w / 2 - 7} ${y + h / 2 + 5}c0-8 5-12 13-13-1 8-5 12-13 13Z`} fill={C.green} />
  </>
);

const shapes: Record<Art, React.ReactNode> = {
  bottle: (
    <>
      <rect x="86" y="26" width="28" height="14" rx="3" fill={C.green} />
      <path d="M88 40h24v14l14 18v92a8 8 0 0 1-8 8H82a8 8 0 0 1-8-8V72l14-18Z" fill={C.amber} />
      <path d="M82 80v76" stroke={C.hi} strokeOpacity=".35" strokeWidth="6" strokeLinecap="round" />
      <Label x={84} y={98} w={32} h={40} />
    </>
  ),
  jar: (
    <>
      <rect x="62" y="40" width="76" height="18" rx="5" fill={C.green} />
      <path d="M58 62h84a6 6 0 0 1 6 6v94a10 10 0 0 1-10 10H62a10 10 0 0 1-10-10V68a6 6 0 0 1 6-6Z" fill={C.honey} />
      <path d="M58 62h84a6 6 0 0 1 6 6v10H52V68a6 6 0 0 1 6-6Z" fill={C.amberLight} opacity=".7" />
      <path d="M64 86v70" stroke={C.hi} strokeOpacity=".3" strokeWidth="6" strokeLinecap="round" />
      <Label x={76} y={100} w={48} h={40} />
    </>
  ),
  ghee: (
    <>
      <rect x="60" y="54" width="80" height="16" rx="5" fill={C.green} />
      <path d="M56 72h88v88a12 12 0 0 1-12 12H68a12 12 0 0 1-12-12Z" fill={C.ghee} />
      <path d="M64 84v72" stroke={C.hi} strokeOpacity=".45" strokeWidth="6" strokeLinecap="round" />
      <Label x={78} y={104} w={44} h={36} />
    </>
  ),
  pickle: (
    <>
      <rect x="68" y="34" width="64" height="16" rx="5" fill={C.green} />
      <path d="M66 52h68l8 12v98a10 10 0 0 1-10 10H68a10 10 0 0 1-10-10V64Z" fill={C.red} />
      <g fill={C.amberLight}>
        <path d="M74 80c8-4 18-2 20 6s-8 10-16 8-8-12-4-14Z" />
        <path d="M108 92c8-6 20-2 20 6s-10 10-18 8-6-10-2-14Z" />
        <path d="M82 116c8-4 18 0 18 8s-10 8-16 6-6-12-2-14Z" />
      </g>
      <path d="M68 70v84" stroke={C.hi} strokeOpacity=".25" strokeWidth="5" strokeLinecap="round" />
      <rect x="74" y="138" width="52" height="22" rx="4" fill={C.cream} />
    </>
  ),
  gur: (
    <>
      <ellipse cx="100" cy="150" rx="62" ry="18" fill={C.brown} />
      <path d="M38 132c0-10 28-18 62-18s62 8 62 18v18c0 10-28 18-62 18s-62-8-62-18Z" fill={C.brown} />
      <ellipse cx="100" cy="132" rx="62" ry="18" fill={C.brownLight} />
      <ellipse cx="100" cy="104" rx="48" ry="14" fill={C.brown} />
      <path d="M52 92c0-8 22-14 48-14s48 6 48 14v12c0 8-22 14-48 14s-48-6-48-14Z" fill={C.brown} />
      <ellipse cx="100" cy="92" rx="48" ry="14" fill={C.brownLight} />
      <path d="M78 88c8-3 20-3 30 0" stroke={C.hi} strokeOpacity=".35" strokeWidth="3" strokeLinecap="round" fill="none" />
    </>
  ),
  muri: (
    <>
      <path d="M52 64h96l-8 104H60Z" fill="#E6D9B8" />
      <path d="M52 64h96v16H52Z" fill={C.green} />
      <g fill={C.cream} stroke="#D3C39C" strokeWidth="1.2">
        <ellipse cx="78" cy="56" rx="9" ry="5" />
        <ellipse cx="98" cy="50" rx="9" ry="5" transform="rotate(-20 98 50)" />
        <ellipse cx="118" cy="56" rx="9" ry="5" transform="rotate(15 118 56)" />
        <ellipse cx="88" cy="44" rx="8" ry="4.5" transform="rotate(25 88 44)" />
        <ellipse cx="110" cy="42" rx="8" ry="4.5" />
      </g>
      <rect x="74" y="104" width="52" height="36" rx="4" fill={C.cream} />
      <path d="M93 128c0-8 5-12 13-13-1 8-5 12-13 13Z" fill={C.green} />
    </>
  ),
  fish: (
    <>
      <path d="M30 104c20-30 68-40 110-24l18-20c4 16 4 32 0 48 0 0 0 0 0 0-2 14-2 28 0 40l-18-20c-42 16-90 6-110-24Z" fill={C.silver} />
      <path d="M30 104c20-30 68-40 110-24l2 4c-40-10-84-2-112 20Z" fill={C.hi} opacity=".55" />
      <path d="M30 104c20 30 68 40 110 24l2-2c-40 10-84 2-112-22Z" fill={C.silverDark} opacity=".6" />
      <path d="M62 86c6 10 6 26 0 36" stroke={C.silverDark} strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="46" cy="98" r="5" fill={C.ink} />
      <circle cx="47.5" cy="96.5" r="1.6" fill={C.hi} />
    </>
  ),
  prawn: (
    <>
      <path d="M150 70c-30-26-90-20-100 24-8 34 26 60 60 50l-6-14c-24 4-42-12-36-34 8-28 50-32 72-14Z" fill="#E58A5A" />
      <g stroke="#C4643A" strokeWidth="3" fill="none" strokeLinecap="round">
        <path d="M76 70c4 10 4 22 0 32" />
        <path d="M96 64c4 12 4 24 0 36" />
        <path d="M116 66c4 10 4 20 0 30" />
      </g>
      <path d="M104 130l-14 22 26-6Z" fill="#C4643A" />
      <circle cx="142" cy="72" r="4" fill={C.ink} />
      <path d="M150 68c14-14 26-22 36-26M148 74c16-6 28-6 38-4" stroke="#C4643A" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </>
  ),
  stem: (
    <>
      <g transform="rotate(-18 100 110)">
        <rect x="40" y="76" width="120" height="22" rx="11" fill={C.brownLight} />
        <rect x="40" y="76" width="120" height="7" rx="3.5" fill={C.hi} opacity=".25" />
        <rect x="88" y="74" width="8" height="26" rx="3" fill={C.brown} />
      </g>
      <g transform="rotate(8 100 130)">
        <rect x="34" y="118" width="132" height="24" rx="12" fill="#7C6A3A" />
        <rect x="34" y="118" width="132" height="7" rx="3.5" fill={C.hi} opacity=".2" />
        <rect x="70" y="116" width="8" height="28" rx="3" fill={C.brown} />
        <rect x="124" y="116" width="8" height="28" rx="3" fill={C.brown} />
      </g>
      <path d="M150 64c10-12 22-14 30-10-6 10-18 14-30 10Z" fill={C.green} />
    </>
  ),
};
