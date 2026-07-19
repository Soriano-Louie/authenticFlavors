import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { getPaymentStatus } from "../api/paymentApi";
import { CheckCircle, Loader2, Clock } from "lucide-react";

export function SuccessPage() {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const paymentId = searchParams.get("payment_id");
  
  const [status, setStatus] = useState<"checking" | "paid" | "failed">("checking");
  const [paidAt, setPaidAt] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState<string | null>(null);

  useEffect(() => {
    if (!paymentId || !accessToken) {
      navigate("/dashboard");
      return;
    }

    let attempts = 0;
    const maxAttempts = 20; // 20 * 3s = 60s max

    const checkStatus = async () => {
      try {
        const result = await getPaymentStatus(accessToken, Number(paymentId));
        
        if (result.payment_status === "Paid") {
          setStatus("paid");
          setPaidAt(result.paid_at);
          setPaymentMethod(result.payment_method);
          setPaymentReference(result.payment_reference);
          setTimeout(() => navigate("/dashboard"), 1500);
          return true;
        }
        
        attempts++;
        if (attempts >= maxAttempts) {
          setStatus("failed");
          return true;
        }
        
        return false;
      } catch (error) {
        console.error("Failed to check payment status:", error);
        attempts++;
        if (attempts >= maxAttempts) {
          setStatus("failed");
          return true;
        }
        return false;
      }
    };

    // Initial check
    checkStatus().then((shouldStop) => {
      if (!shouldStop) {
        // Poll every 3 seconds
        const interval = setInterval(async () => {
          const shouldStop = await checkStatus();
          if (shouldStop) {
            clearInterval(interval);
          }
        }, 3000);

        return () => clearInterval(interval);
      }
    });
  }, [paymentId, accessToken, navigate]);

  const handleContinue = () => {
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-[#F5F0E8] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full border border-[#C8922A]/10">
        {status === "checking" && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-[#C8922A]/10 rounded-full flex items-center justify-center">
              <Loader2 className="animate-spin text-[#C8922A]" size={32} />
            </div>
            <h2 className="text-2xl font-['Playfair_Display'] text-[#2C1810]">
              Processing Payment
            </h2>
            <p className="text-sm font-['Lato'] text-[#2C1810]/60">
              Please wait while we confirm your payment...
            </p>
            <div className="flex items-center justify-center gap-2 text-xs font-['Lato'] text-[#2C1810]/40">
              <Clock size={14} />
              <span>This may take a few moments</span>
            </div>
          </div>
        )}

        {status === "paid" && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-[#7A8C5C]/10 rounded-full flex items-center justify-center">
              <CheckCircle className="text-[#7A8C5C]" size={32} />
            </div>
            <h2 className="text-2xl font-['Playfair_Display'] text-[#2C1810]">
              Payment Successful!
            </h2>
            <p className="text-sm font-['Lato'] text-[#2C1810]/60">
              Your payment has been processed successfully.
            </p>
            
            {paidAt && (
              <div className="bg-[#F5F0E8] rounded-xl p-4 text-left space-y-2">
                <div className="text-xs font-['Lato'] text-[#2C1810]/50">
                  Paid At
                </div>
                <div className="text-sm font-['Lato'] text-[#2C1810]">
                  {new Date(paidAt).toLocaleString("en-PH", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                {paymentMethod && (
                  <>
                    <div className="text-xs font-['Lato'] text-[#2C1810]/50 mt-2">
                      Payment Method
                    </div>
                    <div className="text-sm font-['Lato'] text-[#2C1810] capitalize">
                      {paymentMethod}
                    </div>
                  </>
                )}
                {paymentReference && (
                  <>
                    <div className="text-xs font-['Lato'] text-[#2C1810]/50 mt-2">
                      Reference
                    </div>
                    <div className="text-sm font-['Lato'] text-[#2C1810]">
                      {paymentReference}
                    </div>
                  </>
                )}
              </div>
            )}

            <button
              onClick={handleContinue}
              className="w-full py-3 bg-gradient-to-r from-[#7A8C5C] to-[#5C7A3E] text-white rounded-xl font-['Lato'] font-semibold hover:opacity-90 transition-opacity"
            >
              Continue to Dashboard
            </button>
          </div>
        )}

        {status === "failed" && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-[#C4541A]/10 rounded-full flex items-center justify-center">
              <Clock className="text-[#C4541A]" size={32} />
            </div>
            <h2 className="text-2xl font-['Playfair_Display'] text-[#2C1810]">
              Payment Verification Timeout
            </h2>
            <p className="text-sm font-['Lato'] text-[#2C1810]/60">
              We couldn't verify your payment within the expected time. Please check your bookings shortly, or contact us if the payment was deducted.
            </p>
            
            <button
              onClick={handleContinue}
              className="w-full py-3 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-white rounded-xl font-['Lato'] font-semibold hover:opacity-90 transition-opacity"
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
