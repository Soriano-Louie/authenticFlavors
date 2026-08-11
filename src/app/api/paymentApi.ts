export interface Payment {
  payment_id: number;
  booking_id: number;
  payment_type: "Reservation" | "DownPayment" | "FinalPayment";
  amount: number;
  due_date: string;
  paymongo_checkout_id: string | null;
  paymongo_payment_id: string | null;
  payment_reference: string | null;
  payment_method: string | null;
  payment_status:
    | "Pending"
    | "For_Verification"
    | "Paid"
    | "Failed"
    | "Cancelled"
    | "Rejected"
    | "Overdue";
  overdue_days?: number;
  paid_at: string | null;
  receipt_url: string | null;
  receipt_public_id: string | null;
  receipt_uploaded_at: string | null;
  verified_by: number | null;
  verified_at: string | null;
  admin_remarks: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentInstruction {
  instruction_id: number;
  payment_type: "Reservation" | "DownPayment" | "FinalPayment";
  instruction_text: string;
  account_details: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const API_BASE_URL =
  (import.meta.env as { VITE_API_BASE_URL?: string }).VITE_API_BASE_URL ??
  "";

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: { message?: string; code?: string };
  };

  if (!response.ok) {
    const message = payload.error?.message ?? "Request failed.";
    throw new Error(message);
  }

  return payload;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  return parseResponse<T>(response);
}

// Get payment instructions for a booking
export function getPaymentInstructions(
  accessToken: string,
  bookingId: number,
): Promise<{ instructions: PaymentInstruction[] }> {
  return request<{ instructions: PaymentInstruction[] }>(
    `/api/payments/instructions/${bookingId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
}

// Upload payment receipt (direct URL — for frontend Cloudinary upload)
export function uploadReceipt(
  accessToken: string,
  paymentId: number,
  receiptUrl: string,
  receiptPublicId?: string,
): Promise<{ message: string; payment_status: string }> {
  return request<{ message: string; payment_status: string }>(
    "/api/payments/upload-receipt",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        payment_id: paymentId,
        receipt_url: receiptUrl,
        receipt_public_id: receiptPublicId,
      }),
    },
  );
}

// Upload payment receipt file (multer + server-side Cloudinary upload)
export function uploadReceiptFile(
  accessToken: string,
  paymentId: number,
  file: File,
): Promise<{
  message: string;
  payment_status: string;
  receipt_url: string;
  receipt_public_id: string;
}> {
  const formData = new FormData();
  formData.append("receipt", file);
  formData.append("payment_id", String(paymentId));

  const API_BASE_URL =
    (import.meta.env as { VITE_API_BASE_URL?: string }).VITE_API_BASE_URL ??
    "";

  return fetch(`${API_BASE_URL}/api/payments/upload-receipt-file`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  }).then(async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error?.message ?? "Failed to upload receipt.");
    }
    return payload;
  });
}

// Get payment status
export function getPaymentStatus(
  accessToken: string,
  paymentId: number,
): Promise<{
  payment_status:
    | "Pending"
    | "For_Verification"
    | "Paid"
    | "Failed"
    | "Cancelled"
    | "Rejected";
  paid_at: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  receipt_url: string | null;
  receipt_uploaded_at: string | null;
  verified_by: number | null;
  verified_at: string | null;
  admin_remarks: string | null;
}> {
  return request<{
    payment_status:
      | "Pending"
      | "For_Verification"
      | "Paid"
      | "Failed"
      | "Cancelled"
      | "Rejected";
    paid_at: string | null;
    payment_method: string | null;
    payment_reference: string | null;
    receipt_url: string | null;
    receipt_uploaded_at: string | null;
    verified_by: number | null;
    verified_at: string | null;
    admin_remarks: string | null;
  }>(`/api/payments/status/${paymentId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

// Get all payments for a booking
export function getBookingPayments(
  accessToken: string,
  bookingId: number,
): Promise<{ payments: Payment[] }> {
  return request<{ payments: Payment[] }>(
    `/api/payments/booking/${bookingId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
}

// Admin: Get all payments
export function getAllPayments(
  accessToken: string,
): Promise<{ payments: Payment[] }> {
  return request<{ payments: Payment[] }>("/api/payments/admin/all", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

// Admin: Verify (approve/reject) a receipt
export function verifyReceipt(
  accessToken: string,
  paymentId: number,
  action: "approve" | "reject",
  adminRemarks?: string,
): Promise<{
  message: string;
  payment_status: string;
  booking_status?: string;
  amount_paid?: number;
  remaining_balance?: number;
}> {
  return request<{
    message: string;
    payment_status: string;
    booking_status?: string;
    amount_paid?: number;
    remaining_balance?: number;
  }>(`/api/payments/admin/verify/${paymentId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ action, admin_remarks: adminRemarks }),
  });
}

// Admin: Update payment instructions
export function updatePaymentInstructions(
  accessToken: string,
  instructionId: number,
  data: {
    instruction_text?: string;
    account_details?: string;
    is_active?: boolean;
  },
): Promise<{ message: string }> {
  return request<{ message: string }>("/api/payments/admin/instructions", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ instruction_id: instructionId, ...data }),
  });
}

// Admin: Get overdue payments
export function getOverduePayments(
  accessToken: string,
): Promise<{ payments: Payment[] }> {
  return request<{ payments: Payment[] }>("/api/payments/admin/overdue", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

// Admin: Send payment reminder email
export function sendPaymentReminder(
  accessToken: string,
  paymentId: number,
): Promise<{ message: string }> {
  return request<{ message: string }>(
    `/api/payments/admin/overdue/remind/${paymentId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
}

// Admin: Cancel booking for overdue payment
export function cancelBookingForOverdue(
  accessToken: string,
  paymentId: number,
): Promise<{ message: string; booking_status: string }> {
  return request<{ message: string; booking_status: string }>(
    `/api/payments/admin/overdue/cancel/${paymentId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
}
