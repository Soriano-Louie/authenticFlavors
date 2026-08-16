import { useEffect } from "react";
import { X } from "lucide-react";

interface ReceiptViewerProps {
  open: boolean;
  receiptUrl: string | null;
  onClose: () => void;
}

/**
 * Lightbox that shows a payment receipt in the same window instead of a new
 * tab. The close button is pinned at the top of the overlay so it always
 * stays visible on every screen size (mobile, tablet, desktop).
 */
export function ReceiptViewer({
  open,
  receiptUrl,
  onClose,
}: ReceiptViewerProps) {
  // Close on Escape and lock page scroll while the viewer is open.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !receiptUrl) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Payment receipt preview"
    >
      {/* Always-visible header + close button (pinned, not scrolled away). */}
      <div
        className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 bg-gradient-to-b from-black/90 to-black/40"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-[#F5F0E8] text-sm sm:text-base font-['Lato'] font-semibold">
          Payment Receipt
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close receipt"
          className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/15 hover:bg-white/30 text-[#F5F0E8] font-['Lato'] text-sm font-semibold transition-colors cursor-pointer shadow-lg"
        >
          <X size={16} />
          Close
        </button>
      </div>

      {/* Image area — scrollable in both axes on small screens so wide/tall
          receipts can still be inspected while the close button stays put. */}
      <div
        className="flex-1 overflow-auto flex items-start sm:items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={receiptUrl}
          alt="Payment Receipt"
          className="max-w-full max-h-full rounded-xl shadow-2xl object-contain"
        />
      </div>
    </div>
  );
}