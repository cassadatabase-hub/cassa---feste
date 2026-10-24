import { base44 } from '@/api/base44Client';

export const PAYMENT_METHODS = ['cash', 'pos'];

// Salva il metodo di pagamento sull'ordine appena registrato dalla cassa.
// Restituisce l'ordine aggiornato (per scontrino e stampe).
export async function savePaymentMethod(order, method) {
  if (!order?.id || !PAYMENT_METHODS.includes(method)) return order;
  const updated = await base44.entities.CashierOrder.update(order.id, { payment_method: method });
  return { ...order, ...(updated || {}), payment_method: method };
}
