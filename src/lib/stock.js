// Utility condivise per gestire i prodotti esauriti.
// Usate dalla cassa (ordine manuale e ordine da codice QR) e dal cliente.

// Un prodotto è "esaurito" se l'admin lo ha disattivato oppure se ha il
// tracciamento scorte attivo e le scorte sono finite.
export function isSoldOut(product) {
  return !product || product.available === false || (!!product.stock_enabled && (product.stock_quantity ?? 0) <= 0);
}

export function itemsTotal(items) {
  return (items || []).reduce((s, i) => s + (Number(i.price) || 0) * (i.quantity || 1), 0);
}

export function optionsMatch(a, b) {
  const aKeys = Object.keys(a || {});
  const bKeys = Object.keys(b || {});
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(k => a[k] === b[k]);
}

// Confronta le righe di un ordine con lo stato attuale dei prodotti.
//  - prodotto esaurito / disattivato  -> riga tolta
//  - scorte inferiori alla quantità   -> quantità ridotta a quanto resta
// Le righe dei menu fissi e i prodotti non presenti nell'elenco non vengono toccati.
// Restituisce { items, removed } dove removed = [{ item, reason, from?, to? }].
export function reconcileItems(items, products) {
  if (!Array.isArray(items) || !Array.isArray(products) || products.length === 0) {
    return { items: items || [], removed: [] };
  }
  const byId = new Map(products.map(p => [p.id, p]));
  const remaining = new Map();
  const kept = [];
  const removed = [];

  for (const item of items) {
    const p = item.type === 'fixed_menu' || !item.product_id ? null : byId.get(item.product_id);
    if (!p) { kept.push(item); continue; }

    if (p.available === false) {
      removed.push({ item, reason: 'soldout' });
      continue;
    }
    if (p.stock_enabled) {
      const left = remaining.has(p.id) ? remaining.get(p.id) : (p.stock_quantity ?? 0);
      const qty = item.quantity || 1;
      if (left <= 0) {
        removed.push({ item, reason: 'soldout' });
        continue;
      }
      if (qty > left) {
        kept.push({ ...item, quantity: left });
        removed.push({ item, reason: 'reduced', from: qty, to: left });
        remaining.set(p.id, 0);
        continue;
      }
      remaining.set(p.id, left - qty);
    }
    kept.push(item);
  }
  return { items: kept, removed };
}

export function describeRemoved(removed, { t, tn }) {
  return removed.map(r => {
    const name = tn(r.item.name_it, r.item.name_en) || r.item.name_it || r.item.name || '?';
    if (r.reason === 'reduced') {
      return `${name} (${t('reducedFromTo').replace('{from}', r.from).replace('{to}', r.to)})`;
    }
    return `${r.item.quantity || 1}× ${name}`;
  }).join(', ');
}
