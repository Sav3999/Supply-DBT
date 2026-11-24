"use client";

export type CartLine = { itemId: number; quantity: number };

const KEY = "borrow-cart";

export function readCart(): CartLine[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(
      (l): l is CartLine => !!l && Number.isSafeInteger(l.itemId) && l.itemId > 0 && Number.isInteger(l.quantity) && l.quantity >= 1,
    );
  } catch {
    return [];
  }
}

export function writeCart(lines: CartLine[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    // storage unavailable: ignore
  }
}

export function addToCart(itemId: number, quantity: number): void {
  const lines = readCart();
  const existing = lines.find((l) => l.itemId === itemId);
  if (existing) existing.quantity += quantity;
  else lines.push({ itemId, quantity });
  writeCart(lines);
}

export function clearCart(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
