import React, { useContext } from 'react';
import { CartContext } from '../context/CartContext';
import { useCart } from '../hooks/useCart';
import Layout from '../components/Layout/Layout';
import { Link } from 'react-router-dom';

const Cart = () => {
    const { cartItems, removeFromCart, updateQuantity } = useCart();

    const handleRemove = (id) => {
        removeFromCart(id);
    };

    const handleQuantityChange = (id, quantity) => {
        updateQuantity(id, quantity);
    };

    return (
        <Layout>
            <div className="cart-container">
                <h1>Your Shopping Cart</h1>
                {cartItems.length === 0 ? (
                    <p>Your cart is empty. <Link to="/">Continue Shopping</Link></p>
                ) : (
                    <ul>
                        {cartItems.map(item => (
                            <li key={item.id}>
                                <img src={item.image} alt={item.name} />
                                <div>
                                    <h2>{item.name}</h2>
                                    <p>Price: ${item.price}</p>
                                    <input
                                        type="number"
                                        value={item.quantity}
                                        onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                                        min="1"
                                    />
                                    <button onClick={() => handleRemove(item.id)}>Remove</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
                <Link to="/checkout" className="checkout-button">Proceed to Checkout</Link>
            </div>
        </Layout>
    );
};

export default Cart;