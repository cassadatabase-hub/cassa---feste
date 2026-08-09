import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const CartContext = createContext();

const STORAGE_KEY = 'sagra_cart';
const TABLE_KEY = 'sagra_table';

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [tableNumber, setTableNumber] = useState(() => {
    return localStorage.getItem(TABLE_KEY) || '';
  });

  const [customerName, setCustomerName] = useState(() => {
    return localStorage.getItem('sagra_customer_name') || '';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    if (items.length > 0) {
      localStorage.setItem('sagra_pending_order', '1');
    } else {
      localStorage.removeItem('sagra_pending_order');
    }
  }, [items]);

  useEffect(() => {
    localStorage.setItem(TABLE_KEY, tableNumber);
  }, [tableNumber]);

  useEffect(() => {
    localStorage.setItem('sagra_customer_name', customerName);
  }, [customerName]);

  const addItem = useCallback((item) => {
    setItems(prev => {
      // For à la carte items, merge by product_id
      // For fixed menus, always add as new line
      if (item.type === 'fixed_menu') {
        return [...prev, { ...item, uid: Date.now() + Math.random() }];
      }
      const existing = prev.find(i => i.product_id === item.product_id && i.type === item.type && i.lactose_free === item.lactose_free);
      if (existing) {
        return prev.map(i =>
          i.product_id === item.product_id && i.type === item.type && i.lactose_free === item.lactose_free
            ? { ...i, quantity: i.quantity + (item.quantity || 1) }
            : i
        );
      }
      return [...prev, { ...item, uid: Date.now() + Math.random(), quantity: item.quantity || 1 }];
    });
  }, []);

  const updateQuantity = useCallback((uid, delta) => {
    setItems(prev =>
      prev
        .map(i =>
          i.uid === uid ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i
        )
        .filter(i => i.quantity > 0)
    );
  }, []);

  const removeItem = useCallback((uid) => {
    setItems(prev => prev.filter(i => i.uid !== uid));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const alaCarteItems = items.filter(i => i.type === 'ala_carte');
  const fixedMenuItems = items.filter(i => i.type === 'fixed_menu');
  const drinkItems = items.filter(i => i.type === 'drink' || i.type === 'extra_drink');

  const hasPendingOrder = items.length > 0;

  return (
    <CartContext.Provider value={{
      items, addItem, updateQuantity, removeItem, clearCart,
      tableNumber, setTableNumber, customerName, setCustomerName,
      total, alaCarteItems, fixedMenuItems, drinkItems, hasPendingOrder
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}