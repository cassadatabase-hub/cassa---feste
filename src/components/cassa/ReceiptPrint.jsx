import React from 'react';
import { formatTime, formatDate, formatPrice } from '@/lib/codeGen';

export default function ReceiptPrint({ order, festaName, productOptions = [] }) {
  const items = order.items || [];
  const total = order.total || 0;

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

  return (
    <div
      className="comanda-page border border-dashed border-gray-400 p-4 mb-4"
      style={{
        maxWidth: '80mm',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: '11pt',
        lineHeight: 1.5,
      }}
    >
      {festaName && (
        <div className="text-center" style={{ paddingBottom: '4px' }}>
          <p style={{ fontSize: '14pt', fontWeight: 'bold', textTransform: 'uppercase' }}>
            {festaName}
          </p>
        </div>
      )}
      <div
        className="text-center"
        style={{ paddingBottom: '6px', borderBottom: '2px dashed #000' }}
      >
        <p style={{ fontSize: '13pt', fontWeight: 'bold', textTransform: 'uppercase' }}>
          Scontrino
        </p>
      </div>

      <div className="flex justify-between" style={{ marginTop: '4px', marginBottom: '2px' }}>
        <span><strong>N.</strong> {order.order_number || '-'}</span>
        <span><strong>Tavolo:</strong> {order.table_number}</span>
      </div>
      <div className="flex justify-between" style={{ marginBottom: '2px' }}>
        <span><strong>Data:</strong> {formatDate(order.created_date || new Date())}</span>
        <span><strong>Ora:</strong> {formatTime(order.created_date || new Date())}</span>
      </div>
      {order.customer_name && (
        <div style={{ marginBottom: '2px' }}>
          <strong>Cliente:</strong> {order.customer_name}
        </div>
      )}

      <div style={{ borderTop: '2px dashed #000', marginTop: '4px', marginBottom: '4px' }} />

      <div>
        {items.map((item, i) => (
          <div key={i} className="flex justify-between" style={{ marginBottom: '1px' }}>
            <span className="flex-1">{item.quantity}x {itemDisplayName(item)}</span>
            <span className="ml-2" style={{ fontWeight: '500' }}>
              {formatPrice((item.price || 0) * (item.quantity || 1))}
            </span>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '2px dashed #000', marginTop: '4px', paddingTop: '4px' }}>
        <div className="flex justify-between" style={{ fontSize: '14pt', fontWeight: 'bold' }}>
          <span>TOTALE</span>
          <span>{formatPrice(total)}</span>
        </div>
      </div>

      <div
        className="text-center"
        style={{ marginTop: '8px', paddingTop: '4px', borderTop: '1px dashed #000', fontSize: '10pt' }}
      >
        <p>Grazie e arrivederci!</p>
      </div>
    </div>
  );
}