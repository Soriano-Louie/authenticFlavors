import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type TextSizeLevel = "default" | "large" | "extra-large";

const STORAGE_KEY = "af-text-size";

const FONT_SIZES: Record<TextSizeLevel, number> = {
  default: 16,
  large: 18,
  "extra-large": 20,
};

const LEVEL_ORDER: TextSizeLevel[] = ["default", "large", "extra-large"];

interface TextSizeContextValue {
  level: TextSizeLevel;
  currentSize: number;
  increase: () => void;
  decrease: () => void;
  reset: () => void;
  setLevel: (level: TextSizeLevel) => void;
}

const TextSizeContext = createContext<TextSizeContextValue | undefined>(
  undefined,
);

function applyFontSize(size: number) {
  document.documentElement.style.setProperty("--font-size", `${size}px`);
}

function loadInitialLevel(): TextSizeLevel {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && LEVEL_ORDER.includes(stored as TextSizeLevel)) {
      return stored as TextSizeLevel;
    }
  } catch {
    // Ignore localStorage errors (e.g., private mode)
  }
  return "default";
}

// Apply saved font size immediately on module load to avoid FOUC
const initialLevel = loadInitialLevel();
applyFontSize(FONT_SIZES[initialLevel]);

export function TextSizeProvider({ children }: { children: ReactNode }) {
  const [level, setLevel] = useState<TextSizeLevel>(initialLevel);

  // Apply font-size to the root element whenever level changes
  useEffect(() => {
    const size = FONT_SIZES[level];
    applyFontSize(size);
    try {
      localStorage.setItem(STORAGE_KEY, level);
    } catch {
      // Ignore localStorage errors
    }
  }, [level]);

  const increase = useCallback(() => {
    setLevel((prev) => {
      const idx = LEVEL_ORDER.indexOf(prev);
      const nextIdx = Math.min(idx + 1, LEVEL_ORDER.length - 1);
      return LEVEL_ORDER[nextIdx];
    });
  }, []);

  const decrease = useCallback(() => {
    setLevel((prev) => {
      const idx = LEVEL_ORDER.indexOf(prev);
      const nextIdx = Math.max(idx - 1, 0);
      return LEVEL_ORDER[nextIdx];
    });
  }, []);

  const reset = useCallback(() => {
    setLevel("default");
  }, []);

  const value = useMemo<TextSizeContextValue>(
    () => ({
      level,
      currentSize: FONT_SIZES[level],
      increase,
      decrease,
      reset,
      setLevel,
    }),
    [level, increase, decrease, reset],
  );

  return (
    <TextSizeContext.Provider value={value}>
      {children}
    </TextSizeContext.Provider>
  );
}

export function useTextSize(): TextSizeContextValue {
  const ctx = useContext(TextSizeContext);
  if (!ctx) {
    throw new Error("useTextSize must be used within a TextSizeProvider");
  }
  return ctx;
}
