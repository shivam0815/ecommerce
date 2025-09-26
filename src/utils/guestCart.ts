// Simple & robust guest cart storage
const LS_KEY = "guest_cart_v1";

export type GuestItem = { productId: string; qty: number };

export const getGuestCart = (): GuestItem[] => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); }
  catch { return []; }
};

export const setGuestCart = (items: GuestItem[]) =>
  localStorage.setItem(LS_KEY, JSON.stringify(items));

export const addToGuestCart = (productId: string, qty = 1) => {
  const items = getGuestCart();
  const i = items.findIndex(x => x.productId === productId);
  if (i >= 0) items[i].qty += qty; else items.push({ productId, qty });
  setGuestCart(items);
};

export const removeFromGuestCart = (productId: string) => {
  setGuestCart(getGuestCart().filter(i => i.productId !== productId));
};

export const updateGuestQty = (productId: string, qty: number) => {
  const items = getGuestCart();
  const i = items.findIndex(x => x.productId === productId);
  if (i >= 0) {
    if (qty <= 0) items.splice(i, 1);
    else items[i].qty = qty;
  }
  setGuestCart(items);
};

export const clearGuestCart = () => setGuestCart([]);
