import { useEffect, useRef, useState } from "react";
import { GripVertical, Minus, Plus } from "lucide-react";
import {
  useTextSize,
  type TextSizeLevel,
} from "../accessibility/TextSizeContext";

const LEVEL_LABELS: Record<TextSizeLevel, string> = {
  default: "Default",
  large: "Large",
  "extra-large": "Extra Large",
};

const STORAGE_KEY = "af-text-size-control-pos";
const DEFAULT_RIGHT = 16;

interface DragState {
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  width: number;
  height: number;
}

function loadSavedPosition(): { x: number; y: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as { x?: number; y?: number };
      if (typeof saved.x === "number" && typeof saved.y === "number") {
        return { x: saved.x, y: saved.y };
      }
    }
  } catch {
    // ignore corrupt saved position
  }
  return null;
}

function clampToViewport(x: number, y: number, width: number, height: number) {
  const maxX = Math.max(0, window.innerWidth - width);
  const maxY = Math.max(0, window.innerHeight - height);
  return {
    x: Math.min(Math.max(0, x), maxX),
    y: Math.min(Math.max(0, y), maxY),
  };
}

export function AccessibilityControls({ offsetTop = 80 }: { offsetTop?: number }) {
  const { level, currentSize, increase, decrease, reset } = useTextSize();
  const controlRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<DragState | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(
    loadSavedPosition,
  );
  const [dragging, setDragging] = useState(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    const el = controlRef.current;
    if (!el) return;
    e.preventDefault();
    const rect = el.getBoundingClientRect();
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: rect.left,
      originY: rect.top,
      width: rect.width,
      height: rect.height,
    };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const state = dragState.current;
    if (!state) return;
    const nx = state.originX + (e.clientX - state.startX);
    const ny = state.originY + (e.clientY - state.startY);
    setPos(clampToViewport(nx, ny, state.width, state.height));
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragState.current) return;
    dragState.current = null;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setPos((prev) => {
      if (!prev) return prev;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prev));
      } catch {
        // ignore storage errors
      }
      return prev;
    });
  };

  const handleResize = () => {
    setPos((prev) => {
      if (!prev || !controlRef.current) return prev;
      const rect = controlRef.current.getBoundingClientRect();
      return clampToViewport(prev.x, prev.y, rect.width, rect.height);
    });
  };

  useEffect(() => {
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const buttonBase =
    "flex items-center justify-center rounded-full border transition-all outline-none";

  return (
    <div
      ref={controlRef}
      className={`fixed z-[60] pointer-events-auto select-none ${
        dragging ? "cursor-grabbing" : ""
      }`}
      style={
        pos
          ? { left: pos.x, top: pos.y }
          : { right: DEFAULT_RIGHT, top: offsetTop }
      }
    >
      <div className="flex items-center gap-1">
        {/* Drag handle — move the whole control group */}
        <button
          type="button"
          aria-label="Drag to move the text size controls"
          title="Drag to move"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          className={`${buttonBase} w-7 h-8 bg-[#1A0E08]/80 text-[#F5F0E8]/60 hover:text-[#F5F0E8] hover:border-[#C8922A] border border-[#C8922A]/30 touch-none ${
            dragging ? "cursor-grabbing" : "cursor-grab"
          }`}
        >
          <GripVertical size={14} />
        </button>

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
    </div>
  );
}
