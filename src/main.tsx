// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { HelmetProvider } from 'react-helmet-async';
import { CartProvider } from "./context/CartContext";
import './index.css';
import './i18n';

import { WishlistProvider } from "./context/WishlistContext";

const rootEl = document.getElementById('root') as HTMLElement;

createRoot(rootEl).render(
  <StrictMode>
    <HelmetProvider>
      <AuthProvider>
        <CartProvider>
       <WishlistProvider>  {/* 👈 wrap here */}
            <App />
          </WishlistProvider>
    </CartProvider>
      </AuthProvider>
    </HelmetProvider>
  </StrictMode>
);
