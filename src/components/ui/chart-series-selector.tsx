"use client";

type Series = "speech" | "sentiment" | "miroOps";

type Props = {
  value: Series;
  onChange: (v: Series) => void;
};

export function ChartSeriesSelector({ value, onChange }: Props) {
  return (
    <div className="flex justify-center">
      <button
        type="button"
        className="group flex flex-col items-center"
        onClick={() => onChange("speech")}
      >
        <span
          className={`text-sm ${
            value === "speech" ? "text-emerald-700" : "text-muted-foreground"
          }`}
        >
          発話回数
        </span>
        <span
          className={`mt-1 h-[2px] w-40 rounded ${
            value === "speech" ? "bg-emerald-600" : "bg-transparent"
          }`}
        />
      </button>
      <button
        type="button"
        className="group flex flex-col items-center px-2"
        onClick={() => onChange("sentiment")}
      >
        <span
          className={`text-sm ${
            value === "sentiment" ? "text-emerald-700" : "text-muted-foreground"
          }`}
        >
          感情
        </span>
        <span
          className={`mt-1 h-[2px] w-40 rounded ${
            value === "sentiment" ? "bg-emerald-600" : "bg-transparent"
          }`}
        />
      </button>
      <button
        type="button"
        className="group flex flex-col items-center px-2"
        onClick={() => onChange("miroOps")}
      >
        <span
          className={`text-sm ${
            value === "miroOps" ? "text-emerald-700" : "text-muted-foreground"
          }`}
        >
          Miro作業量
        </span>
        <span
          className={`mt-1 h-[2px] w-40 rounded ${
            value === "miroOps" ? "bg-emerald-600" : "bg-transparent"
          }`}
        />
      </button>
    </div>
  );
}

export default ChartSeriesSelector;
