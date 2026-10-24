import { optionsMatch } from '@/lib/stock';

// Omaggi: una riga dell'ordine con gifted = true e prezzo 0 (il prezzo
// originale resta in original_price). Resta una normale riga prodotto, quindi
// le scorte scalano come per ogni altro prodotto, il totale non la conta e il
// report la mette nella tabella "Omaggi".

const newUid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const sameVariant = (a, b) =>
  a.product_id === b.product_id &&
  (a.type || 'ala_carte') === (b.type || 'ala_carte') &&
  !!a.lactose_free === !!b.lactose_free &&
  optionsMatch(a.selected_options, b.selected_options);

export const canGift = (item) => item.type !== 'fixed_menu' && !!item.product_id;

// Sposta UNA unità della riga in omaggio (es. 3 pizze → 2 a pagamento + 1 omaggio)
export function giftOne(items, uid) {
  const src = items.find(i => i.uid === uid);
  if (!src || src.gifted || !canGift(src)) return items;
  const existingGift = items.find(i => i.gifted && sameVariant(i, src));
  let next = items.map(i => (i.uid === uid ? { ...i, quantity: (i.quantity || 1) - 1 } : i));
  if (existingGift) {
    next = next.map(i => (i.uid === existingGift.uid ? { ...i, quantity: (i.quantity || 1) + 1 } : i));
  } else {
    next = [...next, { ...src, uid: newUid(), quantity: 1, gifted: true, original_price: src.price, price: 0 }];
  }
  return next.filter(i => (i.quantity || 0) > 0);
}

// Rimette a pagamento UNA unità di una riga omaggio
export function ungiftOne(items, uid) {
  const src = items.find(i => i.uid === uid);
  if (!src || !src.gifted) return items;
  const price = src.original_price ?? 0;
  const paid = items.find(i => !i.gifted && sameVariant(i, src));
  let next = items.map(i => (i.uid === uid ? { ...i, quantity: (i.quantity || 1) - 1 } : i));
  if (paid) {
    next = next.map(i => (i.uid === paid.uid ? { ...i, quantity: (i.quantity || 1) + 1 } : i));
  } else {
    const { gifted, original_price, ...rest } = src;
    next = [...next, { ...rest, uid: newUid(), quantity: 1, price }];
  }
  return next.filter(i => (i.quantity || 0) > 0);
}
