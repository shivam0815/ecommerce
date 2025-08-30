import React, { createContext, useContext } from "react";
import { useWishlist } from "../hooks/useWishlist";

type WishlistCtx = ReturnType<typeof useWishlist>;
const WishlistContext = createContext<WishlistCtx | null>(null);

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const wishlist = useWishlist();
  return (
    <WishlistContext.Provider value={wishlist}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlistContext = () => {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlistContext must be used inside <WishlistProvider>");
  return ctx;
};
