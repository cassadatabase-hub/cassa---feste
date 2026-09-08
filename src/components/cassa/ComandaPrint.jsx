import React from 'react';
import { formatTime } from '@/lib/codeGen';

const FONT_FAMILY_MAP = {
  'monospace': 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  'sans-serif': 'ui-sans-serif, system-ui, -apple-system, sans-serif',
  'serif': 'ui-serif, Georgia, Cambria, "Times New Roman", serif',
};

export default function ComandaPrint({ order, categories, templates, singleMode, productOptions = [] }) {
  // Group items by category
  const itemsByCategory = {};
  (order.items || []).forEach(item => {
    const catId = item.category_id || item.product_category_id;
    if (!itemsByCategory[catId]) itemsByCategory[catId] = [];
    itemsByCategory[catId].push(item);
  });

  const getOption = (id) => productOptions.find(o => o.id === id);

  const itemDisplayName = (item) => {
    const parts = [];
    parts.push(item.name_it || item.name);
    if (item.lactose_free) parts.push('(SENZA LATTOSIO)');
    if (item.selected_options) {
      Object.entries(item.selected_options).forEach(([oid, v]) => {
        if (v) {
          const o = getOption(oid);
          if (o) parts.push(`(+ ${o.name_it || o.name_en})`);
        }
      });
    }
    return parts.join(' ');
  };

  // Determine which comandas to print
  let comandas = [];
  if (singleMode || !templates || templates.length === 0) {
    comandas = [{
      title: 'COMANDA COMPLETA',
      categoryIds: Object.keys(itemsByCategory),
      paperSize: '80mm',
      font_family: 'monospace',
      font_size: 12,
      title_font_size: 16,
      header_text: '',
      header_font_size: 20,
      header_bold: true,
      header_align: 'center',
    }];
  } else {
    comandas = templates.filter(t => t.active).map(tpl => ({
      title: tpl.title,
      categoryIds: tpl.category_ids || [],
      paperSize: tpl.paper_size,
      font_family: tpl.font_family || 'monospace',
      font_size: tpl.font_size || 12,
      title_font_size: tpl.title_font_size || 16,
      header_text: tpl.header_text || '',
      header_font_size: tpl.header_font_size || 20,
      header_bold: tpl.header_bold !== false,
      header_align: tpl.header_align || 'center',
    })).filter(c => c.categoryIds.some(cid => itemsByCategory[cid]));
  }

  const getWidth = (size) => {
    if (size === '58mm') return '58mm';
    if (size === 'A4') return '210mm';
    return '80mm';
  };

  return (
    <div>
      {comandas.map((comanda, idx) => {
        const comandaItems = comanda.categoryIds.flatMap(cid => {
          const cat = categories.find(c => c.id === cid);
          const items = itemsByCategory[cid] || [];
          return items.map(item => ({
            name: itemDisplayName(item),
            quantity: item.quantity || 1,
            categoryName: cat ? cat.name_it : '',
          }));
        }).filter(i => i.name);

        if (comandaItems.length === 0) return null;

        const fontFamily = FONT_FAMILY_MAP[comanda.font_family] || FONT_FAMILY_MAP['monospace'];
        const baseFontSize = `${comanda.font_size}pt`;
        const titleFontSize = `${comanda.title_font_size}pt`;

        return (
          <div
            key={idx}
            className="comanda-page border border-dashed border-gray-400 p-4 mb-4"
            style={{
              maxWidth: getWidth(comanda.paperSize),
              fontFamily,
              fontSize: baseFontSize,
              lineHeight: 1.4,
            }}
          >
            {comanda.header_text && (
              <div
                className="pb-2 mb-2 border-b-2 border-dashed border-black"
                style={{ textAlign: comanda.header_align || 'center' }}
              >
                <p
                  style={{
                    fontSize: `${comanda.header_font_size || 20}pt`,
                    fontWeight: comanda.header_bold !== false ? 'bold' : 'normal',
                    textTransform: 'uppercase',
                  }}
                >
                  {comanda.header_text}
                </p>
              </div>
            )}
            <div className="text-center border-b-2 border-dashed border-black pb-2 mb-2">
              <p className="font-bold uppercase" style={{ fontSize: titleFontSize }}>{comanda.title}</p>
            </div>
            <div className="flex justify-between mb-1">
              <span><strong>{'Tavolo:'}</strong> {order.table_number}</span>
              <span><strong>{'N.'}</strong> {order.order_number || '-'}</span>
            </div>
            <div className="flex justify-between mb-1 pb-1">
              <span><strong>{'Ora:'}</strong> {formatTime(order.created_date || new Date())}</span>
              {order.customer_name && <span><strong>{'Cliente:'}</strong> {order.customer_name}</span>}
            </div>
            <div style={{ borderTop: '2px dashed #000', marginTop: '4px', marginBottom: '6px' }} />
            <div className="space-y-1">
              {comandaItems.map((item, i) => (
                <div key={i} className="flex justify-between">
                  <span className="font-bold">{item.quantity}x</span>
                  <span className="flex-1 ml-2">{item.name}</span>
                </div>
              ))}
            </div>
            {order.note && (
              <div className="mt-2 pt-2 border-t border-dashed">
                <strong>{'Nota:'}</strong> {order.note}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}