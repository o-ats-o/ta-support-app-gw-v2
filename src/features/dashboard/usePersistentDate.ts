import { useCallback, useEffect, useState } from "react";

function isValidDateString(value: string | null | undefined): value is string {
  if (!value) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00`);
  return !Number.isNaN(parsed.getTime());
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

export function usePersistentDate(storageKey: string) {
  const [date, setDate] = useState<string>(() => getToday());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(storageKey);
    if (!isValidDateString(stored)) return;
    setDate((prev) => (prev === stored ? prev : stored));
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isValidDateString(date)) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    window.localStorage.setItem(storageKey, date);
  }, [date, storageKey]);

  const updateDate = useCallback((value: string) => {
    if (!isValidDateString(value)) return;
    setDate((prev) => (prev === value ? prev : value));
  }, []);

  return [date, updateDate] as const;
}
