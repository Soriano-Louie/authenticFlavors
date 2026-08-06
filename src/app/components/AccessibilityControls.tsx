import { Minus, Plus } from "lucide-react";
import {
  useTextSize,
  type TextSizeLevel,
} from "../accessibility/TextSizeContext";

const LEVEL_LABELS: Record<TextSizeLevel, string> = {
  default: "Default",
  large: "Large",
  "extra-large": "Extra Large",
};

export function AccessibilityControls() {
  const { level, currentSize, increase, decrease, reset } = useTextSize();

  const buttonBase =
    "flex items-center justify-center rounded-full border transition-all outline-none";

  return (
    <div className="flex items-center gap-1">
      <span
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-label={`Text size set to ${LEVEL_LABELS[level]}`}
      >
        Text size: {LEVEL_LABELS[level]} ({currentSize}px)
      </span>

      {/* Decrease */}
      <button
        type="button"
        onClick={decrease}
        disabled={level === "default"}
        aria-label="Decrease text size"
        title="Decrease text size (A−)"
        className={`${buttonBase} w-8 h-8 bg-[#1A0E08]/80 text-[#F5F0E8]/70 hover:text-[#F5F0E8] hover:border-[#C8922A] border border-[#C8922A]/30 disabled:opacity-30 disabled:cursor-not-allowed`}
      >
        <Minus size={14} />
      </button>

      {/* Current level indicator */}
      <button
        type="button"
        onClick={reset}
        aria-label="Reset text size to default"
        title="Reset text size"
        className={`${buttonBase} px-2.5 h-8 bg-[#C8922A]/15 text-[#C8922A] hover:bg-[#C8922A]/25 border border-[#C8922A]/40 min-w-[70px]`}
      >
        <span className="flex items-center gap-1 text-xs font-semibold font-['Lato']">
          <span className="text-sm font-bold" aria-hidden="true">
            A
          </span>
          <span className="uppercase text-[10px]">
            {level === "default" ? "DEF" : LEVEL_LABELS[level]}
          </span>
        </span>
      </button>

      {/* Increase */}
      <button
        type="button"
        onClick={increase}
        disabled={level === "extra-large"}
        aria-label="Increase text size"
        title="Increase text size (A+)"
        className={`${buttonBase} w-8 h-8 bg-[#1A0E08]/80 text-[#F5F0E8]/70 hover:text-[#F5F0E8] hover:border-[#C8922A] border border-[#C8922A]/30 disabled:opacity-30 disabled:cursor-not-allowed`}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
