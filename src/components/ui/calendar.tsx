"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";

type Props = {
  mode?: "single";
  selected?: Date;
  captionLayout?: "dropdown" | "buttons";
  onSelect?: (date: Date | undefined) => void;
  month?: Date;
  onMonthChange?: (d?: Date) => void;
};

export function Calendar({ selected, onSelect, month, onMonthChange }: Props) {
  return (
    <div className="p-2">
      <DayPicker
        mode="single"
        selected={selected}
        month={month}
        onMonthChange={onMonthChange}
        onSelect={(d) => onSelect?.(d ?? undefined)}
        showOutsideDays
        weekStartsOn={0}
        className="rdp-head_font-medium rdp-nav_button:hover:bg-neutral-100"
      />
    </div>
  );
}

export default Calendar;
