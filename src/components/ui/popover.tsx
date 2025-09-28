"use client";

import React, {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

type PopoverCtx = {
  open: boolean;
  setOpen: (v: boolean) => void;
  anchorRef: React.RefObject<HTMLDivElement>;
};

const Ctx = createContext<PopoverCtx | null>(null);

type PopoverProps = React.PropsWithChildren<{
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}>;

export function Popover({ open, onOpenChange, children }: PopoverProps) {
  const [innerOpen, setInnerOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const value = useMemo<PopoverCtx>(
    () => ({
      open: typeof open === "boolean" ? open : innerOpen,
      setOpen: (v: boolean) =>
        onOpenChange ? onOpenChange(v) : setInnerOpen(v),
      anchorRef,
    }),
    [open, innerOpen, onOpenChange]
  );

  return (
    <Ctx.Provider value={value}>
      <div ref={anchorRef} className="relative inline-flex">
        {children}
      </div>
    </Ctx.Provider>
  );
}

type TriggerProps = React.PropsWithChildren<{ asChild?: boolean }> &
  React.HTMLAttributes<HTMLElement>;
export function PopoverTrigger({ asChild, children, ...rest }: TriggerProps) {
  const ctx = useContext(Ctx);
  if (!ctx) return null;
  const { open, setOpen } = ctx;

  const onClick = (e: React.MouseEvent) => {
    (rest as any)?.onClick?.(e);
    setOpen(!open);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as any, { onClick });
  }
  return (
    <button type="button" onClick={onClick} {...rest}>
      {children}
    </button>
  );
}

type ContentProps = React.PropsWithChildren<{
  className?: string;
  align?: "start" | "end" | "center";
}>;
export function PopoverContent({
  children,
  className,
  align = "start",
}: ContentProps) {
  const ctx = useContext(Ctx);
  if (!ctx || !ctx.open) return null;
  const alignCls =
    align === "end"
      ? "right-0"
      : align === "center"
        ? "left-1/2 -translate-x-1/2"
        : "left-0";
  return (
    <div className={cn("absolute top-full mt-2 z-50", alignCls)}>
      <div
        className={cn(
          "rounded-md border bg-white text-slate-900 shadow-md",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
