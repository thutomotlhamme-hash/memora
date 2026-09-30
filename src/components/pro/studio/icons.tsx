// A small, consistent line-icon set for the funeral-home Studio (1.6px strokes,
// rounded joins), so nothing depends on an icon library.

type P = { size?: number };
const svg = (d: React.ReactNode, size = 20) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

export const IconToday = ({ size }: P) => svg(<><rect x="3.5" y="4.5" width="17" height="16" rx="3" /><path d="M3.5 9.5h17M8 2.8v3.4M16 2.8v3.4" /><circle cx="12" cy="15" r="1.6" fill="currentColor" stroke="none" /></>, size);
export const IconFunerals = ({ size }: P) => svg(<><path d="M7 20.5V11a5 5 0 0 1 10 0v9.5" /><path d="M4.5 20.5h15" /><path d="M12 8.5v5M9.8 10.7h4.4" /></>, size);
export const IconFamily = ({ size }: P) => svg(<><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9.5" r="2.3" /><path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5M14.8 14.6c2.6-.5 4.8.9 5.5 4" /></>, size);
export const IconPrint = ({ size }: P) => svg(<><path d="M7 8V3.5h10V8" /><rect x="3.5" y="8" width="17" height="8.5" rx="2.5" /><path d="M7 14h10v6.5H7z" /><circle cx="17" cy="11" r=".8" fill="currentColor" stroke="none" /></>, size);
export const IconTeam = ({ size }: P) => svg(<><path d="M4 20.5V10l8-5.5 8 5.5v10.5" /><path d="M9.5 20.5v-5h5v5" /><path d="M4 20.5h16" /></>, size);
export const IconBrand = ({ size }: P) => svg(<><path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.3 0 1.9-.8 1.9-1.7 0-1.3-1.1-1.6-1.1-2.6 0-.9.7-1.5 1.7-1.5h2a4 4 0 0 0 4-4c0-4-3.8-7.2-8.5-7.2Z" /><circle cx="7.8" cy="11" r="1" fill="currentColor" stroke="none" /><circle cx="10.5" cy="7.5" r="1" fill="currentColor" stroke="none" /><circle cx="14.8" cy="7.8" r="1" fill="currentColor" stroke="none" /></>, size);
export const IconBilling = ({ size }: P) => svg(<><rect x="3.5" y="5.5" width="17" height="13" rx="3" /><path d="M3.5 9.5h17M7 15h4" /></>, size);
export const IconRoles = ({ size }: P) => svg(<><path d="M12 3.5 5 6v5.5c0 4.2 2.9 7.4 7 9 4.1-1.6 7-4.8 7-9V6l-7-2.5Z" /><path d="m9.2 12 2 2 3.6-3.8" /></>, size);
export const IconChevron = ({ size = 16 }: P) => svg(<path d="m9 5.5 6.5 6.5L9 18.5" />, size);
export const IconPlus = ({ size = 18 }: P) => svg(<path d="M12 5v14M5 12h14" />, size);
export const IconLink = ({ size = 18 }: P) => svg(<><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" /><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" /></>, size);
export const IconPin = ({ size = 16 }: P) => svg(<><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.2" /></>, size);
export const IconClock = ({ size = 16 }: P) => svg(<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>, size);
export const IconCheck = ({ size = 16 }: P) => svg(<path d="m5 12.5 4.5 4.5L19 7.5" />, size);
export const IconPlay = ({ size = 16 }: P) => svg(<path d="M8 5.5v13l10.5-6.5L8 5.5Z" />, size);
export const IconEye = ({ size = 16 }: P) => svg(<><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.8" /></>, size);
export const IconBack = ({ size = 16 }: P) => svg(<path d="M15 5.5 8.5 12l6.5 6.5" />, size);
export const IconSparkle = ({ size = 16 }: P) => svg(<path d="M12 3.5 13.8 10.2 20.5 12 13.8 13.8 12 20.5 10.2 13.8 3.5 12 10.2 10.2Z" />, size);
