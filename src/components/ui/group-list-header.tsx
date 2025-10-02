"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export const DEFAULT_TIME_LABEL = "10:40〜10:45";

type Props = {
  title?: string;
  timeLabel?: string;
  onTimeChange?: (timeRange: string) => void;
};

export default function GroupListHeader({
  title = "グループ一覧",
  timeLabel = DEFAULT_TIME_LABEL,
  onTimeChange,
}: Props) {
  const [selectedTime, setSelectedTime] = useState(timeLabel);

  const timeOptions = useMemo(() => {
    const results: string[] = [];
    const pad2 = (n: number) => n.toString().padStart(2, "0");
    const startMinutes = 9 * 60; // 9:00
    const endMinutes = 24 * 60; // 12:00
    for (let m = startMinutes; m < endMinutes; m += 5) {
      const startHour = Math.floor(m / 60);
      const startMin = m % 60;
      const endTotal = m + 5;
      const endHour = Math.floor(endTotal / 60);
      const endMin = endTotal % 60;
      results.push(
        `${startHour}:${pad2(startMin)}〜${endHour}:${pad2(endMin)}`
      );
    }
    return results;
  }, []);

  useEffect(() => {
    if (!timeLabel) return;
    setSelectedTime((prev) => (prev === timeLabel ? prev : timeLabel));
  }, [timeLabel]);

  // 時間変更を親へ通知
  useEffect(() => {
    onTimeChange?.(selectedTime);
  }, [selectedTime, onTimeChange]);

  return (
    <div>
      <div className="flex items-center justify-between px-4 pb-0 mb-4 -mt-1">
        <div className="flex items-center gap-2 font-semibold">
          <Users className="h-4 w-4 text-muted-foreground" />
          {title}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const idx = timeOptions.indexOf(selectedTime);
              const next = Math.max(0, idx - 1);
              setSelectedTime(timeOptions[next] ?? timeOptions[0]);
            }}
            disabled={timeOptions.indexOf(selectedTime) <= 0}
            aria-label="前の時間帯"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Select value={selectedTime} onValueChange={setSelectedTime}>
            <SelectTrigger size="sm" className="w-[152px] tabular-nums">
              <SelectValue className="font-mono tabular-nums" />
            </SelectTrigger>
            <SelectContent>
              {timeOptions.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const idx = timeOptions.indexOf(selectedTime);
              const next = Math.min(timeOptions.length - 1, idx + 1);
              setSelectedTime(
                timeOptions[next] ?? timeOptions[timeOptions.length - 1]
              );
            }}
            disabled={
              timeOptions.indexOf(selectedTime) >= timeOptions.length - 1
            }
            aria-label="次の時間帯"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <Separator />
    </div>
  );
}
