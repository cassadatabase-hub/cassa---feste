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
      byDay[dayKey] = { date: dayKey, orders: [], total: 0, products: {}, categories: {} };
    }
    byDay[dayKey].orders.push(order);
    byDay[dayKey].total += order.total || 0;
    (order.items || []).forEach(item => {
      const name = item.name_it || item.name || 'N/D';
      const cat = categories.find(c => c.id === item.category_id);
      const catName = cat ? cat.name_it : 'Senza reparto';
      const qty = item.quantity || 1;
      const rev = (item.price || 0) * qty;
      if (!byDay[dayKey].products[name]) byDay[dayKey].products[name] = { quantity: 0, revenue: 0 };
      byDay[dayKey].products[name].quantity += qty;
      byDay[dayKey].products[name].revenue += rev;
      if (!byDay[dayKey].categories[catName]) byDay[dayKey].categories[catName] = { quantity: 0, revenue: 0 };
      byDay[dayKey].categories[catName].quantity += qty;
      byDay[dayKey].categories[catName].revenue += rev;
    });
  });
  const days = Object.keys(byDay).sort((a, b) => b.localeCompare(a));
  const grandTotal = days.reduce((s, d) => s + byDay[d].total, 0);
  const totalOrders = days.reduce((s, d) => s + byDay[d].orders.length, 0);
  return { byDay, days, grandTotal, totalOrders };
}

export function buildWorkbook(report, t) {
  const { byDay, days, grandTotal, totalOrders } = report;
  const wb = XLSX.utils.book_new();

  const summary = [
    [t('date'), t('orderCount'), t('revenue') + ' (€)'],
    ...days.map(d => [d, byDay[d].orders.length, byDay[d].total.toFixed(2)]),
    ['', '', ''],
    [t('grandTotal'), totalOrders, grandTotal.toFixed(2)],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), t('dailyReport'));

  const products = [[t('date'), t('product'), t('quantity'), t('revenue') + ' (€)']];
  days.forEach(d => {
    Object.entries(byDay[d].products).forEach(([name, p]) => {
      products.push([d, name, p.quantity, p.revenue.toFixed(2)]);
    });
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(products), t('perProduct'));

  const cats = [[t('date'), t('category'), t('quantity'), t('revenue') + ' (€)']];
  days.forEach(d => {
    Object.entries(byDay[d].categories).forEach(([name, c]) => {
      cats.push([d, name, c.quantity, c.revenue.toFixed(2)]);
    });
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cats), t('perCategory'));

  const details = [[t('date'), t('time'), t('orderNumber'), t('tableNumber2'), t('note'), t('total') + ' (€)']];
  days.forEach(d => {
    byDay[d].orders.forEach(o => {
      details.push([
        d,
        formatTime(o.created_date),
        o.order_number || '',
        o.table_number || '',
        o.note || '',
        (o.total || 0).toFixed(2),
      ]);
    });
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(details), t('orderDetails'));

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
  const all = await base44.entities.CashierOrder.list('-created_date', 500);
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