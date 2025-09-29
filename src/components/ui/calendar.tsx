"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { ja } from "date-fns/locale";
import type { Locale } from "date-fns";

type Props = {
  mode?: "single";
  selected?: Date;
  captionLayout?: "dropdown" | "buttons";
  onSelect?: (date: Date | undefined) => void;
  month?: Date;
  onMonthChange?: (d?: Date) => void;
  locale?: Locale;
};

export function Calendar({
  selected,
  onSelect,
  month,
  onMonthChange,
  captionLayout = "buttons",
  mode = "single",
  locale = ja,
}: Props) {
  return (
    <div className="p-2">
      <DayPicker
        mode={mode}
        selected={selected}
        month={month}
        onMonthChange={onMonthChange}
        onSelect={(d) => onSelect?.(d ?? undefined)}
        showOutsideDays
        weekStartsOn={0}
        captionLayout={captionLayout === "dropdown" ? "dropdown" : undefined}
        locale={locale}
        className="rdp-head_font-medium rdp-nav_button:hover:bg-neutral-100"
      />
    </div>
  );
}

export default Calendar;
