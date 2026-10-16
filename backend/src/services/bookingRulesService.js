import { httpError } from '../utils/httpError.js';

export const money = (value) => Math.round(Number(value) * 100) / 100;

export function validateMenuSelection(items, requiredCategories, selections) {
  if (!Array.isArray(selections) || !selections.length || selections.some(s => typeof s !== 'string' || !s.trim())) {
    throw httpError(400, 'VALIDATION_ERROR', 'Select one menu item from every required category.');
  }
  const names = new Set();
  const categories = new Set();
  const resolved = selections.map(name => {
    const key = name.trim().toLowerCase();
    const item = items.find(i => i.item_name.trim().toLowerCase() === key);
    if (!item || names.has(key) || categories.has(Number(item.category_id))) {
      throw httpError(400, 'VALIDATION_ERROR', 'Choose available package items, with exactly one item per category.');
    }
    names.add(key);
    categories.add(Number(item.category_id));
    return item;
  });
  if (requiredCategories.length === 0 || categories.size !== requiredCategories.length ||
      requiredCategories.some(id => !categories.has(Number(id)))) {
    throw httpError(400, 'VALIDATION_ERROR', 'Complete all required menu categories.');
  }
  return resolved;
}

export async function resolveMenu(db, packageId, selections) {
  const [inclusions] = await db.query('SELECT menu_item_id FROM package_menu_inclusions WHERE package_id = ?', [packageId]);
  const [rows] = await db.query(`SELECT mi.menu_item_id, mi.item_name, mi.category_id, mi.additional_price,
      mi.availability_status, mc.status AS category_status
    FROM menu_items mi JOIN menu_categories mc ON mc.category_id = mi.category_id
    WHERE mc.status = 'Active'`);
  const included = new Set(inclusions.map(i => Number(i.menu_item_id)));
  const packageItems = rows.filter(i => included.size === 0 || included.has(Number(i.menu_item_id)));
  const required = [...new Set(packageItems.map(i => Number(i.category_id)))];
  const available = packageItems.filter(i => i.availability_status === 'Active');
  return validateMenuSelection(available, required, selections);
}

export function assertPaymentOrder(payment, payments, bookingStatus) {
  if (['Cancelled', 'Rejected'].includes(bookingStatus)) {
    throw httpError(409, 'INVALID_STATE', 'This booking no longer accepts payments.');
  }
  const required = payment.payment_type === 'DownPayment' ? ['Reservation']
    : payment.payment_type === 'FinalPayment' ? ['Reservation', 'DownPayment'] : [];
  for (const type of required) {
    const rows = payments.filter(p => p.payment_type === type);
    if (!rows.length || rows.some(p => Number(p.amount) > 0 && p.payment_status !== 'Paid')) {
      throw httpError(409, 'PREVIOUS_PAYMENTS_REQUIRED', 'Previous payment stages must be verified before this payment.');
    }
  }
}

export async function checkPaymentOrder(db, payment, bookingStatus) {
  const [rows] = await db.query('SELECT payment_type, payment_status, amount FROM payments WHERE booking_id = ? FOR UPDATE', [payment.booking_id]);
  assertPaymentOrder(payment, rows, bookingStatus);
}

export function repriceMenu(snapshot, selections) {
  if (!snapshot || !Number.isFinite(snapshot.base_price) || !snapshot.items) {
    throw httpError(409, 'PRICING_REVIEW_REQUIRED', 'This older booking needs an administrator-reviewed pricing baseline before its menu can be changed.');
  }
  const items = Object.fromEntries(selections.map(item => [item.menu_item_id,
    snapshot.items[item.menu_item_id] ?? Number(item.additional_price || 0)]));
  const original = money(snapshot.base_price + Object.values(items).reduce((sum, value) => sum + value, 0));
  const discount = snapshot.discount;
  const reduction = !discount ? 0 : discount.type === 'percentage'
    ? money(original * discount.value / 100) : Math.min(original, discount.value);
  return { total: money(Math.max(0, original - reduction)), original, reduction,
    snapshot: { ...snapshot, items } };
}

// Rebuild only unsettled invoices; a receipt under review must be resolved first.
export function reconcileInstallments(payments, total) {
  if (payments.some(p => p.payment_status === 'For_Verification')) {
    throw httpError(409, 'PAYMENT_REVIEW_REQUIRED', 'Verify or reject pending receipts before changing the menu price.');
  }
  const paid = money(payments.filter(p => p.payment_status === 'Paid').reduce((n, p) => n + Number(p.amount), 0));
  const remaining = money(Math.max(0, total - paid));
  let unallocated = remaining;
  const changes = [];
  const open = payments.filter(p => ['Pending', 'Overdue', 'Rejected', 'Failed'].includes(p.payment_status));
  for (const payment of open.filter(p => p.payment_type !== 'FinalPayment')) {
    const amount = money(Math.min(unallocated, Number(payment.amount)));
    unallocated = money(unallocated - amount);
    changes.push({ payment_id: payment.payment_id, amount });
  }
  const finals = open.filter(p => p.payment_type === 'FinalPayment');
  finals.forEach((p, index) => changes.push({ payment_id: p.payment_id, amount: index === 0 ? unallocated : 0 }));
  return { paid, remaining, credit: money(Math.max(0, paid - total)), changes,
    newFinal: finals.length ? 0 : unallocated };
}
