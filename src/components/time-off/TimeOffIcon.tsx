import type { ReactNode, SVGProps } from "react";

export type TimeOffIconName =
  | "calendar"
  | "inbox"
  | "check"
  | "clock"
  | "alert"
  | "wallet"
  | "people"
  | "shield"
  | "settings"
  | "chart"
  | "document"
  | "bell"
  | "search"
  | "hierarchy"
  | "star"
  | "monitor"
  | "exit"
  | "repeat"
  | "receipt"
  | "folder"
  | "pause";

const paths: Record<TimeOffIconName, ReactNode> = {
  calendar: <><path d="M7 3v3M17 3v3M4 9h16"/><rect x="4" y="5" width="16" height="16" rx="3"/><path d="m9 15 2 2 4-5"/></>,
  inbox: <><path d="M4 5h16v14H4z"/><path d="M4 14h4l2 3h4l2-3h4"/></>,
  check: <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  alert: <><path d="M12 3 2.8 19h18.4L12 3Z"/><path d="M12 9v4M12 17h.01"/></>,
  wallet: <><path d="M4 7h15a2 2 0 0 1 2 2v10H4a2 2 0 0 1-2-2V7a3 3 0 0 1 3-3h13"/><path d="M16 12h5v4h-5a2 2 0 0 1 0-4Z"/></>,
  people: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5v1"/></>,
  shield: <><path d="M12 3 5 6v5c0 4.5 2.8 8 7 10 4.2-2 7-5.5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-5"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a8 8 0 0 0-1.7-1L14.5 3h-5l-.4 3.1a8 8 0 0 0-1.7 1L5 6.1 3 9.5 5.1 11a7 7 0 0 0 0 2L3 14.5l2 3.4 2.4-1a8 8 0 0 0 1.7 1l.4 3.1h5l.4-3.1a8 8 0 0 0 1.7-1l2.4 1 2-3.4-2.1-1.5a7 7 0 0 0 .1-1Z"/></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
  document: <><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></>,
  bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 8h18c0-1-3-1-3-8M10 21h4"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  hierarchy: <><rect x="9" y="3" width="6" height="4" rx="1"/><rect x="3" y="17" width="6" height="4" rx="1"/><rect x="15" y="17" width="6" height="4" rx="1"/><path d="M12 7v5M6 17v-5h12v5"/></>,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>,
  monitor: <><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></>,
  exit: <><path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/></>,
  repeat: <><path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/></>,
  receipt: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6M9 16h3"/></>,
  folder: <><path d="M3 6h7l2 2h9v11H3z"/><path d="M3 9h18"/></>,
  pause: <><circle cx="12" cy="12" r="9"/><path d="M9.5 9v6M14.5 9v6"/></>,
};

export default function TimeOffIcon({ name, ...props }: { name: TimeOffIconName } & SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}
