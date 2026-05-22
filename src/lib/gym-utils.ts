import { addMonths, differenceInCalendarDays, format } from "date-fns";

export type ExpiryState = "active" | "expiring" | "expired";

export function computeExpiry(joiningDate: string | Date, planMonths: number) {
  const d = typeof joiningDate === "string" ? new Date(joiningDate) : joiningDate;
  return addMonths(d, planMonths);
}

export function expiryState(expiryDate: string | Date, todayRef = new Date()): ExpiryState {
  const d = typeof expiryDate === "string" ? new Date(expiryDate) : expiryDate;
  const days = differenceInCalendarDays(d, todayRef);
  if (days < 0) return "expired";
  if (days <= 7) return "expiring";
  return "active";
}

export function daysUntil(expiryDate: string | Date, todayRef = new Date()) {
  const d = typeof expiryDate === "string" ? new Date(expiryDate) : expiryDate;
  return differenceInCalendarDays(d, todayRef);
}

export function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return format(date, "dd MMM yyyy");
}

export function generateMemberCode() {
  const ts = Date.now().toString(36).toUpperCase().slice(-5);
  const rand = Math.floor(Math.random() * 36 ** 3)
    .toString(36)
    .toUpperCase()
    .padStart(3, "0");
  return `GYM-${ts}${rand}`;
}

export function currency(n: number | string | null | undefined) {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v);
}

export const PLAN_OPTIONS = [
  { months: 1, label: "1 Month" },
  { months: 3, label: "3 Months" },
  { months: 6, label: "6 Months" },
  { months: 12, label: "1 Year" },
];