import { Loader2, LogOut } from "lucide-react";

interface LogoutConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  loading: boolean;
  description?: string;
}

export function LogoutConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  loading,
  description = "Are you sure you want to logout? You'll need to sign in again to access your account.",
}: LogoutConfirmationDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => !loading && onOpenChange(false)}
      />
      <div className="relative bg-white rounded-2xl w-full max-w-md p-6 shadow-xl border border-[#C8922A]/20">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-[#C4541A]/15 flex items-center justify-center mx-auto mb-4">
            <LogOut size={26} className="text-[#C4541A]" />
          </div>
          <h3 className="text-lg font-['Playfair_Display'] text-[#2C1810] mb-2">
            Confirm Logout
          </h3>
          <p className="text-sm font-['Lato'] text-[#2C1810]/60 mb-6">
            {description}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => !loading && onOpenChange(false)}
              disabled={loading}
              className="px-4 py-2.5 rounded-full border border-[#2C1810]/20 text-sm font-['Lato'] text-[#2C1810]/70 hover:bg-[#F5F0E8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#C4541A] to-[#8B3A1A] text-white rounded-full text-sm font-['Lato'] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? "Logging out..." : "Logout"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}