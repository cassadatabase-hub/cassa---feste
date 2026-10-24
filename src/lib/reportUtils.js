import * as XLSX from 'xlsx';
import { base44 } from '@/api/base44Client';
import { formatTime } from '@/lib/codeGen';

export function getDayKey(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function computeReport(orders, categories) {
  const byDay = {};
  orders.forEach(order => {
    const dayKey = getDayKey(order.created_date);
    if (!byDay[dayKey]) {
      byDay[dayKey] = {
        date: dayKey, orders: [], total: 0, products: {}, categories: {}, gifts: {},
        payments: { cash: { count: 0, total: 0 }, pos: { count: 0, total: 0 }, unknown: { count: 0, total: 0 } },
      };
    }
    byDay[dayKey].orders.push(order);
    byDay[dayKey].total += order.total || 0;
    // Incasso per metodo di pagamento (gli ordini tutti in omaggio, a totale 0, non contano)
    const method = order.payment_method === 'cash' || order.payment_method === 'pos' ? order.payment_method : 'unknown';
    if (method !== 'unknown' || (order.total || 0) > 0) {
      byDay[dayKey].payments[method].count += 1;
      byDay[dayKey].payments[method].total += order.total || 0;
    }
    (order.items || []).forEach(item => {
      const name = item.name_it || item.name || 'N/D';
      const cat = categories.find(c => c.id === item.category_id);
      const catName = cat ? cat.name_it : 'Senza reparto';
      const catOrder = cat ? (cat.sort_order ?? 999) : 999;
      const qty = item.quantity || 1;
      // Omaggi: scalano dalle scorte ma non sono vendite; vanno nella loro tabella
      if (item.gifted) {
        const gifts = byDay[dayKey].gifts;
        if (!gifts[name]) gifts[name] = { quantity: 0, category: catName, catOrder };
        gifts[name].quantity += qty;
        return;
      }
      const rev = (item.price || 0) * qty;
      if (!byDay[dayKey].products[name]) byDay[dayKey].products[name] = { quantity: 0, revenue: 0, category: catName, catOrder };
      byDay[dayKey].products[name].quantity += qty;
      byDay[dayKey].products[name].revenue += rev;
      if (!byDay[dayKey].categories[catName]) byDay[dayKey].categories[catName] = { quantity: 0, revenue: 0, catOrder };
      byDay[dayKey].categories[catName].quantity += qty;
      byDay[dayKey].categories[catName].revenue += rev;
    });
  });
  const days = Object.keys(byDay).sort((a, b) => b.localeCompare(a));
  const grandTotal = days.reduce((s, d) => s + byDay[d].total, 0);
  const totalOrders = days.reduce((s, d) => s + byDay[d].orders.length, 0);

  const payments = { cash: { count: 0, total: 0 }, pos: { count: 0, total: 0 }, unknown: { count: 0, total: 0 } };
  const gifts = {};
  days.forEach(d => {
    ['cash', 'pos', 'unknown'].forEach(m => {
      payments[m].count += byDay[d].payments[m].count;
      payments[m].total += byDay[d].payments[m].total;
    });
    Object.entries(byDay[d].gifts).forEach(([name, g]) => {
      if (!gifts[name]) gifts[name] = { quantity: 0, category: g.category, catOrder: g.catOrder };
      gifts[name].quantity += g.quantity;
    });
  });
  const giftsQuantity = Object.values(gifts).reduce((s, g) => s + g.quantity, 0);
  // ordini vecchi (senza metodo di pagamento): mostriamo la colonna "non indicato" solo se serve
  const hasUnknownPayment = payments.unknown.count > 0;
  return { byDay, days, grandTotal, totalOrders, payments, gifts, giftsQuantity, hasUnknownPayment };
}

// Formato numerico italiano: virgola per i decimali, punto per le migliaia, simbolo €.
// La formattazione la applica Excel stesso in base al valore NUMERICO reale della cella
// (non più testo con il punto) — così funzionano anche somme e calcoli fatti in Excel.
const EURO_FORMAT = '#,##0.00" €"';

function setColumnEuroFormat(ws, colIndex, rowCount) {
  for (let r = 0; r < rowCount; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: colIndex });
    const cell = ws[addr];
    if (cell && cell.t === 'n') {
      cell.z = EURO_FORMAT;
    }
  }
}

export function buildWorkbook(report, t) {
  const { byDay, days, grandTotal, totalOrders, payments, gifts, giftsQuantity, hasUnknownPayment } = report;
  const wb = XLSX.utils.book_new();

  // --- Riepilogo giornaliero ---
  // Incasso diviso per metodo di pagamento (contanti / POS)
  const paymentCols = (p) => [p.cash.total, p.pos.total, ...(hasUnknownPayment ? [p.unknown.total] : [])];
  const summaryRows = [
    [
      t('date'), t('orderCount'), t('revenue') + ' (€)',
      t('paymentCash') + ' (€)', t('paymentPos') + ' (€)',
      ...(hasUnknownPayment ? [t('paymentUnknown') + ' (€)'] : []),
    ],
    ...days.map(d => [d, byDay[d].orders.length, byDay[d].total, ...paymentCols(byDay[d].payments)]),
    [],
    [t('grandTotal'), totalOrders, grandTotal, ...paymentCols(payments)],
  ];
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
  for (let c = 2; c < summaryRows[0].length; c++) setColumnEuroFormat(summaryWs, c, summaryRows.length);
  XLSX.utils.book_append_sheet(wb, summaryWs, t('dailyReport'));

  // --- Per prodotto: raggruppato per reparto, un blocco sotto l'altro ---
  // Struttura:
  //   Giorno: 2026-09-06
  //   BAR
  //   - Bibita              20      50,00 €
  //   - Amaro                3       9,00 €
  //   CUCINA
  //   - Pasta al pomodoro    8      56,00 €
  // --- Per prodotto: raggruppato per reparto, un blocco per reparto UNA SOLA VOLTA
  // (sommato su tutto il periodo, non ripetuto giorno per giorno) così tutti gli
  // elementi dello stesso reparto restano sempre consecutivi.
  //   BAR
  //   - Bibita              120     300,00 €
  //   - Amaro                15      45,00 €
  //   CUCINA
  //   - Pasta al pomodoro    40     280,00 €
  const allProducts = {};
  days.forEach(d => {
    Object.entries(byDay[d].products).forEach(([name, p]) => {
      if (!allProducts[name]) allProducts[name] = { quantity: 0, revenue: 0, category: p.category, catOrder: p.catOrder };
      allProducts[name].quantity += p.quantity;
      allProducts[name].revenue += p.revenue;
    });
  });
  const productRows = [[t('product'), t('quantity'), t('revenue') + ' (€)']];
  const sortedProducts = Object.entries(allProducts)
    .sort(([, a], [, b]) => (a.catOrder - b.catOrder) || a.category.localeCompare(b.category, 'it') || b.quantity - a.quantity);
  let currentCategory = null;
  sortedProducts.forEach(([name, p]) => {
    if (p.category !== currentCategory) {
      currentCategory = p.category;
      productRows.push([currentCategory.toUpperCase(), '', '']);
    }
    productRows.push([`- ${name}`, p.quantity, p.revenue]);
  });
  const productsWs = XLSX.utils.aoa_to_sheet(productRows);
  setColumnEuroFormat(productsWs, 2, productRows.length);
  XLSX.utils.book_append_sheet(wb, productsWs, t('perProduct'));

  // --- Per reparto ---
  const catRows = [[t('date'), t('category'), t('quantity'), t('revenue') + ' (€)']];
  days.forEach(d => {
    const dayCats = Object.entries(byDay[d].categories).sort(([nameA, a], [nameB, b]) => (a.catOrder - b.catOrder) || nameA.localeCompare(nameB, 'it'));
    dayCats.forEach(([name, c]) => {
      catRows.push([d, name, c.quantity, c.revenue]);
    });
  });
  const catsWs = XLSX.utils.aoa_to_sheet(catRows);
  setColumnEuroFormat(catsWs, 3, catRows.length);
  XLSX.utils.book_append_sheet(wb, catsWs, t('perCategory'));

  // --- Omaggi: prodotto e quanti sono stati dati in omaggio ---
  if (giftsQuantity > 0) {
    const giftRows = [[t('product'), t('quantity')]];
    Object.entries(gifts)
      .sort(([, a], [, b]) => (a.catOrder - b.catOrder) || b.quantity - a.quantity)
      .forEach(([name, g]) => giftRows.push([name, g.quantity]));
    giftRows.push([]);
    giftRows.push([t('giftsTotal'), giftsQuantity]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(giftRows), t('giftsReport'));
  }

  // --- Dettaglio ordini ---
  const detailRows = [[t('date'), t('time'), t('orderNumber'), t('tableNumber2'), t('note'), t('total') + ' (€)', t('paymentMethod')]];
  days.forEach(d => {
    byDay[d].orders.forEach(o => {
      detailRows.push([
        d,
        formatTime(o.created_date),
        o.order_number || '',
        o.table_number || '',
        o.note || '',
        o.total || 0,
        o.payment_method === 'pos' ? t('paymentPos') : o.payment_method === 'cash' ? t('paymentCash') : '',
      ]);
    });
  });
  const detailsWs = XLSX.utils.aoa_to_sheet(detailRows);
  setColumnEuroFormat(detailsWs, 5, detailRows.length);
  XLSX.utils.book_append_sheet(wb, detailsWs, t('orderDetails'));


  return wb;
}

export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function getReportFileName(festaName, formatDateFn) {
  const date = (formatDateFn || (() => new Date().toISOString().slice(0, 10)))().replace(/\//g, '-');
  const festa = (festaName || 'Report').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `Report_${festa}_${date}.xlsx`;
}

/**
 * Fetches paid orders for a festa, builds the Excel report, and uploads to Google Drive.
 * @param {string} festaId
 * @param {string} festaName - folder name on Drive
 * @param {array} categories
 * @param {function} t - translation function
 * @returns {Promise<{success: boolean, fileUrl?: string, error?: string, orderCount: number}>}
 */
export async function generateAndUploadFestaReport(festaId, festaName, categories, t) {
  const all = await base44.entities.CashierOrder.listAll('-created_date');
  const orders = (all || []).filter(o => o.status === 'paid' && o.festa_id === festaId);

  if (orders.length === 0) {
    return { success: false, error: 'no_orders', orderCount: 0 };
  }

  const report = computeReport(orders, categories);
  const wb = buildWorkbook(report, t);
  const arrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const fileBase64 = arrayBufferToBase64(arrayBuffer);

  const fileName = getReportFileName(festaName);
  const res = await base44.functions.invoke('uploadToGoogleDrive', {
    fileBase64,
    fileName,
    folderName: festaName || '',
  });

  return {
    success: res.data?.success || false,
    fileUrl: res.data?.fileUrl,
    error: res.data?.error,
    orderCount: orders.length,
  };
}
