import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement>;
const Icon = ({ children, ...props }: Props) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{children}</svg>;

export const Plus = (p: Props) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>;
export const Search = (p: Props) => <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></Icon>;
export const Filter = (p: Props) => <Icon {...p}><path d="M4 6h16M7 12h10M10 18h4" /></Icon>;
export const Download = (p: Props) => <Icon {...p}><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" /></Icon>;
export const Wallet = (p: Props) => <Icon {...p}><path d="M4 7a2 2 0 0 1 2-2h12v14H6a2 2 0 0 1-2-2z" /><path d="M4 8h14M15 13h.01" /></Icon>;
export const Calendar = (p: Props) => <Icon {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></Icon>;
export const Trend = (p: Props) => <Icon {...p}><path d="m3 17 6-6 4 4 8-8" /><path d="M15 7h6v6" /></Icon>;
export const Dots = (p: Props) => <Icon {...p}><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></Icon>;
export const Close = (p: Props) => <Icon {...p}><path d="m6 6 12 12M18 6 6 18" /></Icon>;
export const Chevron = (p: Props) => <Icon {...p}><path d="m9 18 6-6-6-6" /></Icon>;
export const Check = (p: Props) => <Icon {...p}><path d="m5 12 4 4L19 6" /></Icon>;
export const Trash = (p: Props) => <Icon {...p}><path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7M10 11v6M14 11v6" /></Icon>;
export const Edit = (p: Props) => <Icon {...p}><path d="m4 20 4.5-1 10-10a2.12 2.12 0 0 0-3-3l-10 10zM13.5 8.5l3 3" /></Icon>;
