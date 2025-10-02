"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

export type RefreshHandler = (options?: { force?: boolean }) => void;

type Props = {
  title?: string;
  date: string; // YYYY-MM-DD
  onDateChange: (date: string) => void;
  onRefresh?: RefreshHandler;
};

export function AppHeader({
  title = "TA机間指導支援システム",
  date,
  onDateChange,
  onRefresh,
}: Props) {
  const [open, setOpen] = useState(false);

  const selectedDate = useMemo(() => {
    if (!date) return undefined;
    const d = new Date(date + "T00:00:00");
    return isNaN(d.getTime()) ? undefined : d;
  }, [date]);

  const handleSelect = useCallback(
    (d?: Date) => {
      if (!d) return;
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const da = String(d.getDate()).padStart(2, "0");
      onDateChange(`${y}-${m}-${da}`);
      setOpen(false);
    },
    [onDateChange]
  );

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-12 bg-emerald-600 text-white flex items-center px-4 font-semibold w-full">
      {title}
      <div className="ml-auto flex items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded px-3 py-1 text-sm bg-white/15 text-white hover:bg-white/20 border-white/30 justify-between min-w-40"
            >
              <span className="tabular-nums">{date || "日付を選択"}</span>
              <ChevronDown className="opacity-90" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto overflow-hidden p-0" align="end">
            <Calendar
              mode="single"
              selected={selectedDate}
              captionLayout="dropdown"
              onSelect={handleSelect}
            />
          </PopoverContent>
        </Popover>
        <button
          className="h-8 text-sm bg-white/15 rounded px-3 py-1 hover:bg-white/20 focus:ring-2 focus:ring-white/30"
          onClick={() => {
            if (onRefresh) {
              onRefresh({ force: true });
            } else {
              window.location.reload();
            }
          }}
        >
          更新
        </button>
      </div>
    </header>
  );
}
