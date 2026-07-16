import { Star } from "lucide-react";

const RATING_LABELS: Record<number, string> = {
  1: "⭐ 1 — Very Poor",
  2: "⭐⭐ 2 — Poor",
  3: "⭐⭐⭐ 3 — Average",
  4: "⭐⭐⭐⭐ 4 — Good",
  5: "⭐⭐⭐⭐⭐ 5 — Excellent",
};

interface StarRatingProps {
  rating: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
}

export function StarRating({
  rating,
  onChange,
  disabled = false,
}: StarRatingProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= rating;
          return (
            <button
              key={star}
              type="button"
              disabled={disabled}
              onClick={() => onChange(star)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onChange(star);
                }
              }}
              aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
              className={`transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#C8922A] focus:ring-offset-2 rounded-md ${
                disabled ? "cursor-default" : "cursor-pointer hover:scale-110"
              }`}
            >
              <Star
                size={32}
                className={`transition-all duration-200 ${
                  isFilled
                    ? "text-[#C8922A] fill-[#C8922A] drop-shadow-sm"
                    : "text-[#C8922A]/25 hover:text-[#C8922A]/50"
                }`}
                strokeWidth={isFilled ? 1.5 : 1.5}
              />
            </button>
          );
        })}
      </div>
      {rating > 0 && (
        <p className="text-sm font-['Lato'] text-[#2C1810]/70">
          {RATING_LABELS[rating]}
        </p>
      )}
    </div>
  );
}
