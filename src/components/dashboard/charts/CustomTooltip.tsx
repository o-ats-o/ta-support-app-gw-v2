"use client";

type TooltipItem = {
  value?: number | string;
  color?: string;
  dataKey?: string | number;
  name?: string | number;
};

export type CustomTooltipProps = {
  active?: boolean;
  payload?: TooltipItem[];
  label?: string | number;
  title?: string;
};

export function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const sorted = [...payload].sort((a, b) => {
    const av =
      typeof a.value === "number" ? a.value : Number(a.value ?? -Infinity);
    const bv =
      typeof b.value === "number" ? b.value : Number(b.value ?? -Infinity);
    return bv - av; // 降順
  });

  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        color: "#111827",
        borderRadius: 8,
        border: "1px solid rgba(0,0,0,0.08)",
        boxShadow: "0 6px 18px rgba(0,0,0,0.15)",
        padding: 10,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {sorted.map((entry) => (
          <li
            key={String(entry.dataKey)}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 9999,
                background: entry.color || "#888",
                display: "inline-block",
              }}
            />
            <span
              style={{ opacity: 0.9 }}
            >{`Group ${String(entry.name)}`}</span>
            <span
              style={{
                marginLeft: "auto",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {entry.value as number}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default CustomTooltip;
