"use client";

import { Users } from "lucide-react";
import { Separator } from "@/components/ui/separator";

type Props = {
  title?: string;
  timeLabel?: string;
};

export default function GroupListHeader({
  title = "グループ一覧",
  timeLabel = "11:30〜",
}: Props) {
  return (
    <div>
      <div className="flex items-center justify-between px-1 pt-1 pb-0 mb-4 px-3">
        <div className="flex items-center gap-2 font-semibold">
          <Users className="h-4 w-4 text-muted-foreground" />
          {title}
        </div>
        <div className="text-sm text-muted-foreground">{timeLabel}</div>
      </div>
      <Separator />
    </div>
  );
}
