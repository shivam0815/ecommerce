# Nakoda Mobile E-commerce Platform

A full-stack e-commerce platform for mobile accessories built with React, TypeScript, Node.js, Express, and MongoDB.

## Features

### Frontend
- **Modern React Application** with TypeScript and Tailwind CSS
- **Responsive Design** optimized for all devices
- **Product Catalog** with advanced filtering and search
- **Shopping Cart** with real-time updates
- **User Authentication** with JWT tokens
- **OEM Services** page for bulk inquiries
- **Smooth Animations** using Framer Motion
- **Toast Notifications** for user feedback

### Backend
- **RESTful API** built with Node.js and Express
- **MongoDB Database** with Mongoose ODM
- **JWT Authentication** with bcrypt password hashing
- **File Upload** support with Cloudinary integration
- **Email Notifications** using Nodemailer
- **Payment Integration** ready for Razorpay/Stripe
- **Rate Limiting** and security middleware
- **Comprehensive Error Handling**

## Tech Stack

### Frontend
- React 18 with TypeScript
- Tailwind CSS for styling
- Framer Motion for animations
- React Router DOM for navigation
- Axios for API calls
- React Hot Toast for notifications
- Lucide React for icons

### Backend
- Node.js with Express
- MongoDB with Mongoose
- JWT for authentication
- Bcrypt for password hashing
- Cloudinary for image storage
- Nodemailer for emails
- Helmet for security
- Morgan for logging
- Express Rate Limit

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or Atlas)
- Cloudinary account (for image uploads)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd nakoda-mobile
   ```

2. **Install frontend dependencies**
   ```bash
   npm install
   ```

3. **Install backend dependencies**
   ```bash
   cd server
   npm install
   ```

4. **Environment Setup**
   
   **Frontend (.env)**
   ```env
   VITE_API_URL=http://localhost:5000/api
   VITE_APP_NAME=Nakoda Mobile
   VITE_RAZORPAY_KEY_ID=your-razorpay-key-id
   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-publishable-key
   ```

   **Backend (server/.env)**
   ```env
   PORT=5000
   NODE_ENV=development
   MONGODB_URI=mongodb://localhost:27017/nakoda-mobile
   JWT_SECRET=your-super-secret-jwt-key
   
   # Cloudinary
   CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
   CLOUDINARY_API_KEY=your-cloudinary-api-key
   CLOUDINARY_API_SECRET=your-cloudinary-api-secret
   
   # Email
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   
   # Payment Gateways
   RAZORPAY_KEY_ID=your-razorpay-key-id
   RAZORPAY_KEY_SECRET=your-razorpay-key-secret
   STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
   
   FRONTEND_URL=http://localhost:5173
   ```

5. **Start the development servers**
   
   **Backend (Terminal 1)**
   ```bash
   cd server
   npm run dev
   ```
   
   **Frontend (Terminal 2)**
   ```bash
   npm run dev
   ```

   **Or run both simultaneously**
   ```bash
   npm run dev:full
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile

### Products
- `GET /api/products` - Get all products (with filters)
- `GET /api/products/:id` - Get single product
- `GET /api/products/categories` - Get product categories
- `POST /api/products` - Create product (Admin)
- `PUT /api/products/:id` - Update product (Admin)
- `DELETE /api/products/:id` - Delete product (Admin)

### Cart
- `GET /api/cart` - Get user cart
- `POST /api/cart/add` - Add item to cart
- `PUT /api/cart/update` - Update cart item
- `DELETE /api/cart/remove/:productId` - Remove item from cart
- `DELETE /api/cart/clear` - Clear cart

### Orders
- `POST /api/orders` - Create order
- `GET /api/orders` - Get user orders
- `GET /api/orders/:id` - Get single order
- `GET /api/orders/admin/all` - Get all orders (Admin)
- `PUT /api/orders/:id/status` - Update order status (Admin)

### OEM Inquiries
- `POST /api/oem` - Create OEM inquiry
- `GET /api/oem` - Get all inquiries (Admin)
- `PUT /api/oem/:id` - Update inquiry status (Admin)

## Database Schema

### User
- name, email, password, phone, role, address, isVerified

### Product
- name, description, price, originalPrice, category, images, rating, reviews, inStock, stockQuantity, features, specifications, tags

### Cart
- userId, items (productId, quantity, price), totalAmount

### Order
- userId, orderNumber, items, totalAmount, shippingAddress, paymentMethod, paymentStatus, orderStatus, trackingNumber

### OEMInquiry
- companyName, contactPerson, email, phone, productCategory, quantity, customization, message, status

### Review
- userId, productId, rating, comment, isVerified

## Deployment

### Frontend (Vercel/Netlify)
1. Build the project: `npm run build`
2. Deploy the `dist` folder
3. Set environment variables in deployment platform

### Backend (Render/Railway/Heroku)
1. Push code to Git repository
2. Connect to deployment platform
3. Set environment variables
4. Deploy with build command: `npm run build`
5. Start command: `npm start`

### Database (MongoDB Atlas)
1. Create MongoDB Atlas cluster
2. Update `MONGODB_URI` in environment variables
3. Whitelist deployment server IPs

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support, email support@nakodamobile.com or create an issue in the repository.