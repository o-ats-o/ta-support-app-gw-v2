"use client";

import { useMemo, useState } from "react";
import { Users } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  title?: string;
  timeLabel?: string;
};

export default function GroupListHeader({
  title = "グループ一覧",
  timeLabel = "10:40〜10:45",
}: Props) {
  const [selectedTime, setSelectedTime] = useState(timeLabel);

  const timeOptions = useMemo(() => {
    const results: string[] = [];
    const pad2 = (n: number) => n.toString().padStart(2, "0");
    const startMinutes = 9 * 60; // 9:00
    const endMinutes = 12 * 60; // 12:00
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

  return (
    <div>
      <div className="flex items-center justify-between px-1 pt-1 pb-0 mb-4 px-3">
        <div className="flex items-center gap-2 font-semibold">
          <Users className="h-4 w-4 text-muted-foreground" />
          {title}
        </div>
        <Select value={selectedTime} onValueChange={setSelectedTime}>
          <SelectTrigger size="sm" className="min-w-[96px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {timeOptions.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Separator />
    </div>
  );
}
