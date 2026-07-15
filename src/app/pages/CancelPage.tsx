import { useNavigate, useSearchParams } from "react-router";
import { XCircle, ArrowLeft } from "lucide-react";

export function CancelPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const paymentId = searchParams.get("payment_id");

  const handleRetry = () => {
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-[#F5F0E8] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full border border-[#C8922A]/10">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-[#C4541A]/10 rounded-full flex items-center justify-center">
            <XCircle className="text-[#C4541A]" size={32} />
          </div>
          
          <h2 className="text-2xl font-['Playfair_Display'] text-[#2C1810]">
            Payment Cancelled
          </h2>
          
          <p className="text-sm font-['Lato'] text-[#2C1810]/60">
            Your payment was cancelled. No charges were made to your account.
          </p>
          
          <div className="bg-[#F5F0E8] rounded-xl p-4 text-left space-y-2">
            <div className="text-xs font-['Lato'] text-[#2C1810]/50">
              What happens next?
            </div>
            <ul className="text-sm font-['Lato'] text-[#2C1810] space-y-1">
              <li>• Your booking remains in the system</li>
              <li>• You can retry payment anytime</li>
              <li>• Payment schedule is still active</li>
            </ul>
          </div>

          <div className="space-y-3 pt-2">
            <button
              onClick={handleRetry}
              className="w-full py-3 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-white rounded-xl font-['Lato'] font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <ArrowLeft size={16} />
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
