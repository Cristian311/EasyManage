// The same line icons as the demo.
import type { ReactNode } from 'react';

const S = ({ children }: { children: ReactNode }) => <svg viewBox="0 0 24 24" aria-hidden="true">{children}</svg>;

export const IconToday = () => <S><path d="M3 12l9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></S>;
export const IconCalendar = () => <S><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /><rect x="7" y="12" width="4" height="6" rx="1" /></S>;
export const IconList = () => <S><path d="M4 6h16M4 12h16M4 18h10" /></S>;
export const IconGuests = () => <S><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17" cy="9" r="2.5" /><path d="M15.5 14.5a5 5 0 0 1 6 5" /></S>;
export const IconRooms = () => <S><path d="M3 18V8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10" /><path d="M3 12h18M3 21v-3M21 21v-3" /><path d="M7 12V9h4v3" /></S>;
export const IconRates = () => <S><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.5" /></S>;
export const IconFinance = () => <S><path d="M3 21h18" /><path d="M6 17V11M11 17V6M16 17v-4M21 17V8" /></S>;
export const IconInvoice = () => <S><path d="M6 2h9l5 5v15H6z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></S>;
export const IconSettings = () => <S><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></S>;
export const IconMoon = () => <S><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></S>;
export const IconCollapse = () => <S><path d="M15 6l-6 6 6 6" /></S>;
export const IconPlus = () => <S><path d="M12 5v14M5 12h14" /></S>;
export const IconPrev = () => <S><path d="M15 5l-7 7 7 7" /></S>;
export const IconNext = () => <S><path d="M9 5l7 7-7 7" /></S>;
export const IconClose = () => <S><path d="M6 6l12 12M18 6L6 18" /></S>;
export const IconSearch = () => <S><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></S>;
export const IconJump = () => <S><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /><circle cx="12" cy="15" r="1.6" fill="currentColor" stroke="none" /></S>;
export const IconFull = () => <S><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></S>;
