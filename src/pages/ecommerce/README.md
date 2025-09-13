# eCommerce Application

## Overview
This eCommerce application is built using React and TypeScript. It provides a seamless shopping experience with features such as product browsing, cart management, and a checkout process.

## Project Structure
The project is organized into the following main directories:

- **src/**: Contains the source code for the React application.
  - **components/**: Reusable UI components and layout structure.
  - **pages/**: Individual page components for routing.
  - **hooks/**: Custom hooks for managing state and side effects.
  - **context/**: Context API for managing global state.
  - **services/**: Functions for handling API calls and business logic.
  - **types/**: TypeScript type definitions and interfaces.

- **server/**: Contains the server-side code for handling API requests and serving the application.

## Features
- **Product Browsing**: Users can view a list of products and their details.
- **Shopping Cart**: Users can add products to their cart, update quantities, and remove items.
- **Checkout Process**: Users can enter shipping information and process payments.

## Getting Started
To run the application locally, follow these steps:

1. Clone the repository:
   ```
   git clone <repository-url>
   ```

2. Navigate to the project directory:
   ```
   cd ecommerce
   ```

3. Install dependencies for both client and server:
   ```
   npm install
   cd server
   npm install
   ```

4. Start the server:
   ```
   npm start
   ```

5. In a new terminal, start the client application:
   ```
   cd ..
   npm start
   ```

## Technologies Used
- React
- TypeScript
- Tailwind CSS
- Node.js
- Express

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

## License
This project is licensed under the MIT License.