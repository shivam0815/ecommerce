import React, { useContext, useState } from 'react';
import { CartContext } from '../context/CartContext';
import { useCart } from '../hooks/useCart';
import Layout from '../components/Layout/Layout';

const Checkout: React.FC = () => {
    const { cartItems, totalAmount } = useContext(CartContext);
    const { clearCart } = useCart();
    const [shippingInfo, setShippingInfo] = useState({
        name: '',
        address: '',
        city: '',
        postalCode: '',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setShippingInfo({ ...shippingInfo, [name]: value });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Process payment and shipping information here
        clearCart();
        alert('Checkout successful!');
    };

    return (
        <Layout>
            <h1>Checkout</h1>
            <h2>Your Cart Items</h2>
            <ul>
                {cartItems.map(item => (
                    <li key={item.id}>
                        {item.name} - ${item.price} x {item.quantity}
                    </li>
                ))}
            </ul>
            <h3>Total Amount: ${totalAmount}</h3>
            <form onSubmit={handleSubmit}>
                <h2>Shipping Information</h2>
                <input
                    type="text"
                    name="name"
                    placeholder="Full Name"
                    value={shippingInfo.name}
                    onChange={handleChange}
                    required
                />
                <input
                    type="text"
                    name="address"
                    placeholder="Address"
                    value={shippingInfo.address}
                    onChange={handleChange}
                    required
                />
                <input
                    type="text"
                    name="city"
                    placeholder="City"
                    value={shippingInfo.city}
                    onChange={handleChange}
                    required
                />
                <input
                    type="text"
                    name="postalCode"
                    placeholder="Postal Code"
                    value={shippingInfo.postalCode}
                    onChange={handleChange}
                    required
                />
                <button type="submit">Complete Checkout</button>
            </form>
        </Layout>
    );
};

export default Checkout;