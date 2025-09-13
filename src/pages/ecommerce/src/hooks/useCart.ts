import { useContext } from 'react';
import { CartContext } from '../context/CartContext';
import { CartItem } from '../types';

const useCart = () => {
    const { cartItems, addItem, removeItem, updateItemQuantity } = useContext(CartContext);

    const addToCart = (item: CartItem) => {
        addItem(item);
    };

    const removeFromCart = (itemId: string) => {
        removeItem(itemId);
    };

    const updateQuantity = (itemId: string, quantity: number) => {
        updateItemQuantity(itemId, quantity);
    };

    return {
        cartItems,
        addToCart,
        removeFromCart,
        updateQuantity,
    };
};

export default useCart;