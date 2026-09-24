// Salva l'ultimo codice ordine generato nel browser (localStorage), così se
// il cliente chiude per sbaglio la schermata di conferma o ricarica la
// pagina, il codice non è perso per sempre: resta recuperabile da questo
// stesso dispositivo/browser finché la cassa non conferma il pagamento
// (a quel punto Home.jsx lo toglie da solo, vedi il controllo su Supabase),
// oppure finché il cliente non lo chiude volontariamente.
// Nessun account, nessun login: è lo stesso meccanismo già usato per
// salvare il carrello (sagra_cart).
const KEY = 'sagra_last_order_code';

export function savePendingOrderCode({ code, table_number, total, customer_name }) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      code, table_number, total, customer_name,
      saved_at: Date.now(),
    }));
  } catch (e) {
    // storage non disponibile (es. modalità privata): nessun problema,
    // semplicemente non potremo recuperarlo dopo.
  }
}

export function getPendingOrderCode() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function clearPendingOrderCode() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {
    // ignora
  }
}


// Ordine (già inviato, non ancora pagato) che il cliente sta modificando.
// Salvato per non perderlo se la pagina viene ricaricata durante la modifica:
// così, al momento di rigenerare il codice, aggiorniamo lo STESSO ordine
// invece di crearne uno nuovo.
const EDIT_KEY = 'sagra_editing_order';

export function saveEditingOrder({ id, code }) {
  try { localStorage.setItem(EDIT_KEY, JSON.stringify({ id, code })); } catch (e) { /* ignora */ }
}

export function getEditingOrder() {
  try {
    const raw = localStorage.getItem(EDIT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function clearEditingOrder() {
  try { localStorage.removeItem(EDIT_KEY); } catch (e) { /* ignora */ }
}
