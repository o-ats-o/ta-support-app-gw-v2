"use client";

import { useCallback } from "react";

type Props = {
  title?: string;
  date: string;
  onDateChange: (date: string) => void;
  onRefresh?: () => void;
};

export function AppHeader({
  title = "TA機関指導支援システム",
  date,
  onDateChange,
  onRefresh,
}: Props) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onDateChange(e.target.value);
    },
    [onDateChange]
  );

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-12 bg-emerald-600 text-white flex items-center px-4 font-semibold w-full">
      {title}
      <div className="ml-auto flex items-center gap-2">
        <input
          type="date"
          value={date}
          onChange={handleChange}
          className="h-8 rounded bg-white/90 text-slate-900 px-2 text-sm"
          aria-label="日付"
        />
        <button
          className="text-sm bg-white/15 rounded px-3 py-1"
          onClick={onRefresh}
        >
          更新
        </button>
      </div>
    </header>
  );
}
