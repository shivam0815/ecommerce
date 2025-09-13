import React from 'react';
import Layout from '../components/Layout/Layout';

const Home: React.FC = () => {
    return (
        <Layout>
            <div className="home">
                <h1>Welcome to Our E-Commerce Store</h1>
                <p>Discover amazing products at unbeatable prices!</p>
                <div className="featured-products">
                    {/* Featured products will be displayed here */}
                </div>
            </div>
        </Layout>
    );
};

export default Home;