// Client — src/utils/guestCart.ts
const LS_KEY = "guest_cart_v1";

export type GuestItem = { productId: string; qty: number };

export function getGuestCart(): GuestItem[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
}

export function setGuestCart(items: GuestItem[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(items));
}

export function addToGuestCart(productId: string, qty = 1) {
  const items = getGuestCart();
  const i = items.findIndex(x => x.productId === productId);
  if (i >= 0) items[i].qty += qty;
  else items.push({ productId, qty });
  setGuestCart(items);
}

export function clearGuestCart() {
  setGuestCart([]);
}
