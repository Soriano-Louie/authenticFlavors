import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { useSearchParams, useNavigate, Link } from "react-router";
import { Upload, X, CheckCircle, AlertTriangle, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../auth/AuthContext";
import { uploadReceiptImage } from "../api/bookingApi";

export function PaymentUploadPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  
  const bookingId = Number(searchParams.get("booking_id") || searchParams.get("bookingId"));
  
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (selectedFile: File) => {
    setErrorMsg(null);
    
    // Check file size (5 MB = 5 * 1024 * 1024 bytes)
    if (selectedFile.size > 5 * 1024 * 1024) {
      setErrorMsg("Image exceeds the maximum allowed size of 5 MB.");
      toast.error("Image exceeds the maximum allowed size of 5 MB.");
      return;
    }
    
    // Check file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(selectedFile.type)) {
      setErrorMsg("Accept ONLY: JPG, PNG, and WEBP images.");
      toast.error("Accept ONLY: JPG, PNG, and WEBP images.");
      return;
    }
    
    setFile(selectedFile);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const removeImage = () => {
    setFile(null);
    setPreviewUrl(null);
    setErrorMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = async () => {
    if (!file || !bookingId || !accessToken) return;
    
    setIsUploading(true);
    setErrorMsg(null);
    
    try {
      await uploadReceiptImage(accessToken, bookingId, file);
      setIsSuccess(true);
      toast.success("Receipt uploaded successfully!");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to upload receipt.";
      setErrorMsg(errMsg);
      toast.error(errMsg);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F0E8] py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-2xl w-full bg-white rounded-3xl p-6 sm:p-10 shadow-xl border border-[#C8922A]/10">
        
        {/* Success State */}
        {isSuccess ? (
          <div className="text-center py-6">
            <div className="w-20 h-20 rounded-full bg-[#7A8C5C]/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={40} className="text-[#7A8C5C]" />
            </div>
            <h2 className="font-['Playfair_Display'] text-[#2C1810] text-3xl mb-4">
              Receipt Uploaded Successfully
            </h2>
            <p className="text-[#2C1810]/70 font-['Lato'] text-base leading-relaxed max-w-md mx-auto mb-8">
              Receipt uploaded successfully.<br />
              Please wait while the administrator reviews and verifies your payment.
            </p>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full text-sm font-['Lato'] hover:opacity-90 transition-opacity shadow-md"
            >
              Go to My Bookings <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          /* Upload State */
          <div>
            <div className="text-center mb-8">
              <h1 className="font-['Playfair_Display'] text-[#2C1810] text-3xl mb-3 font-semibold">
                Submit Proof of Payment
              </h1>
              <p className="text-[#2C1810]/65 font-['Lato'] text-sm max-w-lg mx-auto leading-relaxed">
                Your booking has been submitted successfully. <br />
                To continue processing your reservation, please upload your proof of payment below. <br />
                Your booking will remain <strong className="text-[#C8922A]">Pending</strong> until the administrator verifies your payment. Once payment has been verified, your booking status will automatically change to Confirmed.
              </p>
            </div>

            {/* GCash Information */}
            <div className="bg-[#F5F0E8] rounded-2xl p-5 border border-[#C8922A]/10 mb-6">
              <h3 className="text-xs uppercase tracking-widest font-['Lato'] text-[#C8922A] mb-3 font-semibold">
                GCash Transfer Details
              </h3>
              <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm font-['Lato']">
                <div className="text-[#2C1810]/50">Store Name:</div>
                <div className="text-[#2C1810] font-medium text-right">Authentic Flavors by Chef Ramos</div>
                
                <div className="text-[#2C1810]/50">GCash Number:</div>
                <div className="text-[#2C1810] font-medium text-right">0912-345-6789</div>
                
                <div className="text-[#2C1810]/50">GCash Name:</div>
                <div className="text-[#2C1810] font-medium text-right">Chef Ramos</div>
              </div>
            </div>

            {/* Mock Payment Warning Box */}
            <div className="bg-[#C4541A]/10 border border-[#C4541A]/30 rounded-2xl p-4 mb-6 flex gap-3">
              <AlertTriangle size={20} className="text-[#C4541A] shrink-0 mt-0.5" />
              <div>
                <p className="text-[#C4541A] text-xs font-semibold uppercase tracking-wider font-['Lato'] mb-1">
                  ⚠ MOCK PAYMENT INFORMATION
                </p>
                <p className="text-[#2C1810]/70 text-xs font-['Lato'] leading-relaxed">
                  This payment information is placeholder data for development and demonstration purposes only. It will be replaced with the actual payment details before deployment.
                </p>
              </div>
            </div>

            {/* File Drag-and-Drop Area */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-3xl p-6 sm:p-10 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[220px] ${
                isDragActive
                  ? "border-[#C8922A] bg-[#C8922A]/5"
                  : previewUrl
                  ? "border-[#7A8C5C]/50 bg-[#7A8C5C]/5"
                  : "border-[#C8922A]/20 bg-[#F5F0E8]/50 hover:border-[#C8922A]/40"
              }`}
              onClick={previewUrl ? undefined : triggerFileInput}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleChange}
              />

              {previewUrl ? (
                <div className="w-full relative flex flex-col items-center">
                  <img
                    src={previewUrl}
                    alt="Receipt Preview"
                    className="max-h-56 max-w-full rounded-2xl object-contain border border-[#C8922A]/10 mb-4 shadow-sm"
                  />
                  <div className="flex gap-3 text-xs font-['Lato']">
                    <button
                      type="button"
                      onClick={triggerFileInput}
                      className="px-4 py-2 border border-[#C8922A] text-[#C8922A] rounded-full hover:bg-[#C8922A] hover:text-white transition-colors cursor-pointer"
                    >
                      Replace Image
                    </button>
                    <button
                      type="button"
                      onClick={removeImage}
                      className="px-4 py-2 border border-[#C4541A] text-[#C4541A] rounded-full hover:bg-[#C4541A] hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <X size={12} /> Remove Image
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="w-14 h-14 rounded-full bg-[#C8922A]/10 flex items-center justify-center mb-4">
                    <Upload size={22} className="text-[#C8922A]" />
                  </div>
                  <p className="font-medium text-[#2C1810] font-['Lato'] text-sm sm:text-base">
                    Drag and drop your payment receipt here
                  </p>
                  <p className="text-xs text-[#2C1810]/50 font-['Lato'] mt-1">
                    Accept ONLY: JPG, PNG, and WEBP (max 5 MB)
                  </p>
                  <button
                    type="button"
                    className="mt-4 px-5 py-2 bg-[#C8922A]/10 border border-[#C8922A]/30 text-[#C8922A] rounded-full font-['Lato'] text-xs hover:bg-[#C8922A]/20 transition-colors cursor-pointer"
                  >
                    Select File
                  </button>
                </div>
              )}
            </div>

            {errorMsg && (
              <p className="text-xs text-[#C4541A] font-['Lato'] mt-2 text-center font-medium">
                {errorMsg}
              </p>
            )}

            {/* Upload Button */}
            <div className="mt-8 flex gap-4">
              <Link
                to="/dashboard"
                className="flex-1 py-3 text-center border border-[#C8922A]/30 text-[#2C1810]/60 rounded-full text-sm font-['Lato'] hover:border-[#C8922A] hover:text-[#C8922A] transition-colors"
              >
                Go to My Bookings
              </Link>
              <button
                type="button"
                onClick={handleUpload}
                disabled={!file || isUploading}
                className="flex-1 py-3 bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] rounded-full text-sm font-['Lato'] hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md cursor-pointer"
              >
                {isUploading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Uploading Receipt...
                  </>
                ) : (
                  "Upload Receipt"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
