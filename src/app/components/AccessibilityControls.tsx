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
const MOBILE_BOTTOM = 96;

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
  const [expanded, setExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768,
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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

  // Re-clamp after expanding/collapsing (width changes) once layout settles.
  useEffect(() => {
    if (!isMobile) return;
    const raf = requestAnimationFrame(handleResize);
    return () => cancelAnimationFrame(raf);
  }, [expanded, isMobile]);

  const buttonBase =
    "flex items-center justify-center rounded-full border transition-all outline-none";

  const defaultStyle = pos
    ? { left: pos.x, top: pos.y }
    : isMobile
      ? { right: DEFAULT_RIGHT, bottom: MOBILE_BOTTOM }
      : { right: DEFAULT_RIGHT, top: offsetTop };

  // Compact pill for small screens — tap to expand the full control group.
  if (isMobile && !expanded) {
    return (
      <div
        ref={controlRef}
        className={`fixed z-[60] pointer-events-auto select-none ${
          dragging ? "cursor-grabbing" : ""
        }`}
        style={defaultStyle}
      >
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label="Open text size controls"
          title="Adjust text size"
          className="h-11 px-3.5 rounded-full bg-[#1A0E08]/90 text-[#F5F0E8] border border-[#C8922A]/50 shadow-lg flex items-center gap-1.5 hover:border-[#C8922A] transition-all cursor-pointer"
        >
          <span className="text-base font-bold leading-none" aria-hidden="true">
            A
          </span>
          <span className="uppercase text-[10px] font-semibold tracking-wide">
            {level === "default" ? "DEF" : LEVEL_LABELS[level]}
          </span>
          <Plus size={14} className="text-[#C8922A]" />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={controlRef}
      className={`fixed z-[60] pointer-events-auto select-none ${
        dragging ? "cursor-grabbing" : ""
      }`}
      style={defaultStyle}
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

        {/* Collapse on small screens */}
        {isMobile && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            aria-label="Collapse text size controls"
            title="Collapse"
            className={`${buttonBase} w-8 h-8 bg-[#1A0E08]/80 text-[#F5F0E8]/60 hover:text-[#F5F0E8] border border-[#C8922A]/30`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m18 15-6-6-6 6" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
