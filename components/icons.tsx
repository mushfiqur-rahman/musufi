import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export const LeafIcon = (p: P) => (<svg {...base} {...p}><path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15M5 19l7-7" /></svg>);
export const SearchIcon = (p: P) => (<svg {...base} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>);
export const PhoneIcon = (p: P) => (<svg {...base} {...p}><path d="M6 3h3l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v3a3 3 0 0 1-3 3A15 15 0 0 1 3 6a3 3 0 0 1 3-3Z" /></svg>);
export const MenuIcon = (p: P) => (<svg {...base} {...p}><path d="M4 7h16M4 12h16M4 17h16" /></svg>);
export const CloseIcon = (p: P) => (<svg {...base} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>);
export const TruckIcon = (p: P) => (<svg {...base} {...p}><path d="M2 6h11v10H2zM13 10h4l3 3v3h-7z" /><circle cx="6" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></svg>);
export const CashIcon = (p: P) => (<svg {...base} {...p}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="3" /></svg>);
export const ReturnIcon = (p: P) => (<svg {...base} {...p}><path d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" /></svg>);
export const HandIcon = (p: P) => (<svg {...base} {...p}><path d="M7 11V6a1.5 1.5 0 0 1 3 0v4m0-5a1.5 1.5 0 0 1 3 0v5m0-4a1.5 1.5 0 0 1 3 0v5m0-2a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.5A6.5 6.5 0 0 1 6 17.4L4.3 14a1.5 1.5 0 0 1 2.6-1.4L8 14" /></svg>);
export const CalendarIcon = (p: P) => (<svg {...base} {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>);
export const UserIcon = (p: P) => (<svg {...base} {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>);
export const PinIcon = (p: P) => (<svg {...base} {...p}><path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" /><circle cx="12" cy="9" r="2.5" /></svg>);
export const WhatsAppIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 20l1.3-4A8 8 0 1 1 8 19L4 20Z" />
    <path fill="currentColor" stroke="none" d="M9.2 8.3c.3-.4.7-.3.9 0l.7 1.5c.1.3 0 .5-.2.7l-.4.4c.5 1.1 1.4 2 2.5 2.5l.4-.4c.2-.2.4-.3.7-.2l1.5.7c.3.2.4.6 0 .9-.6.7-1.4 1-2.3.7a7 7 0 0 1-4.2-4.2c-.3-.9 0-1.7.4-2.6Z" />
  </svg>
);

export function LogoMark(p: P) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" {...p}>
      <rect width="40" height="40" rx="12" fill="var(--green)" />
      <path d="M11 29c0-10 6-16 18-18-1 12-7 18-17 18m-1 0 9-9" fill="none" stroke="var(--on-green)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="28" cy="28" r="3" fill="var(--honey)" />
    </svg>
  );
}
