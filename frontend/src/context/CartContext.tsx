import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type CartItem = {
  product_id: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
};

type CartCtx = {
  items: CartItem[];
  add: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  update: (product_id: string, qty: number) => void;
  remove: (product_id: string) => void;
  clear: () => void;
  count: number;
  subtotal: number;
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = "garlic_cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v) try { setItems(JSON.parse(v)); } catch {}
    });
  }, []);

  const persist = useCallback((next: CartItem[]) => {
    setItems(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next));
  }, []);

  const add: CartCtx["add"] = (item, qty = 1) => {
    const existing = items.find((i) => i.product_id === item.product_id);
    let next: CartItem[];
    if (existing) {
      next = items.map((i) =>
        i.product_id === item.product_id ? { ...i, quantity: i.quantity + qty } : i
      );
    } else {
      next = [...items, { ...item, quantity: qty }];
    }
    persist(next);
  };

  const update: CartCtx["update"] = (pid, qty) => {
    if (qty <= 0) return remove(pid);
    persist(items.map((i) => (i.product_id === pid ? { ...i, quantity: qty } : i)));
  };

  const remove: CartCtx["remove"] = (pid) => {
    persist(items.filter((i) => i.product_id !== pid));
  };

  const clear = () => persist([]);

  const count = items.reduce((s, i) => s + i.quantity, 0);
  const subtotal = items.reduce((s, i) => s + i.quantity * i.price, 0);

  return (
    <Ctx.Provider value={{ items, add, update, remove, clear, count, subtotal }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart outside CartProvider");
  return c;
}
