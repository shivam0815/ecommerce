// src/utils/cartGuest.ts
export type GuestItem = { productId: string; variantId?: string; qty: number };

const KEY = "guestCart";

/* Get all guest cart items from localStorage */
export function getGuestCart(): GuestItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

/* Save updated guest cart to localStorage */
export function setGuestCart(items: GuestItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

/* Clear guest cart (used after login merge) */
export function clearGuestCart() {
  localStorage.removeItem(KEY);
}
