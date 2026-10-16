import { useState } from 'react';
import { apiFetch } from '../api/apiFetch';
import { useAuth } from '../auth/AuthContext';
import type { Booking } from '../api/bookingApi';

export function PricingBaselineReview({ booking }: { booking: Booking }) {
  const { accessToken } = useAuth();
  const [base, setBase] = useState('');
  const [type, setType] = useState('none');
  const [discount, setDiscount] = useState('0');
  const [surcharges, setSurcharges] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  let summary;
  try { summary = typeof booking.booking_summary === 'string' ? JSON.parse(booking.booking_summary) : booking.booking_summary; } catch { summary = null; }
  if (summary?.pricing_snapshot || saved || !['Reserved', 'Confirmed', 'Pending'].includes(booking.booking_status)) return null;
  const items = booking.menu_selections || [];
  const inputClass = 'w-full rounded border border-[#C8922A]/30 bg-white p-2 text-sm';
  return <details className="mt-4 rounded-xl border border-[#C8922A]/30 p-3 text-sm">
    <summary className="cursor-pointer font-semibold">Review original booking prices</summary>
    <p className="my-2">This older booking needs its agreed prices recorded before menu changes. Check the original agreement. The total must equal ₱{Number(booking.total_price).toLocaleString('en-PH')}.</p>
    <div className="space-y-2">
      <label className="block">Agreed package base price<input className={inputClass} type="number" min="0" step="0.01" value={base} onChange={e => setBase(e.target.value)} /></label>
      {items.map(item => <label className="block" key={item.item_name}>Original surcharge: {item.item_name}
        <input className={inputClass} type="number" min="0" step="0.01" value={surcharges[item.item_name] ?? ''}
          onChange={e => setSurcharges({ ...surcharges, [item.item_name]: e.target.value })} />
      </label>)}
      <label className="block">Original discount<select className={inputClass} value={type} onChange={e => setType(e.target.value)}>
        <option value="none">None</option><option value="fixed">Fixed amount</option><option value="percentage">Percentage</option>
      </select></label>
      {type !== 'none' && <label className="block">Discount value<input className={inputClass} type="number" min="0" step="0.01" value={discount} onChange={e => setDiscount(e.target.value)} /></label>}
      <label className="block">Source checked / review note<textarea className={inputClass} value={note} onChange={e => setNote(e.target.value)} /></label>
      <button type="button" className="rounded-full bg-[#2C1810] px-4 py-2 text-white disabled:opacity-50" disabled={busy || !accessToken}
        onClick={async () => {
          setBusy(true); setMessage('');
          try {
            const baseUrl = (import.meta.env as { VITE_API_BASE_URL?: string }).VITE_API_BASE_URL ?? '';
            const response = await apiFetch(`${baseUrl}/api/admin/bookings/${booking.booking_id}/pricing-baseline`, {
              method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ base_price: base, discount_type: type, discount_value: type === 'none' ? 0 : discount,
                items: items.map(item => ({ item_name: item.item_name, additional_price: surcharges[item.item_name] ?? '' })), review_note: note }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error?.message || 'Unable to save prices.');
            setSaved(true);
          } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save prices.'); }
          finally { setBusy(false); }
        }}>{busy ? 'Saving…' : 'Save reviewed prices'}</button>
      {message && <p role="alert">{message}</p>}
    </div>
  </details>;
}
