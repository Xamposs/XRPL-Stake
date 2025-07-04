# XRP-FLR Staking Application

A web application for staking XRP and earning rewards in Flare tokens. This application connects to both XRP and Flare networks using Xaman (XUMM) and MetaMask wallets.

## Project Structure

```
├── src/
│   ├── components/      # React components
│   ├── context/         # React context providers
│   ├── services/        # Service modules for API interactions
│   ├── hooks/           # Custom React hooks
│   ├── config/          # Configuration files
│   ├── App.jsx          # Main application component
│   ├── main.jsx         # Application entry point
│   └── index.css        # Global styles (Tailwind)
├── server/              # Backend server for handling wallet interactions
│   ├── server.js        # Express server
│   ├── package.json     # Server dependencies
│   └── .env.example     # Environment variables template
├── public/              # Static assets
├── index.html           # HTML template
├── vite.config.js       # Vite configuration
├── tailwind.config.js   # Tailwind configuration
└── package.json         # Frontend dependencies
```

## Setup Instructions

### Frontend Setup

1. Install dependencies:
   ```
   pnpm install
   ```

2. Create a `.env` file in the root directory with your Xaman (XUMM) API credentials:
   ```
   VITE_XAMAN_API_KEY=your_xaman_api_key
   VITE_XAMAN_API_SECRET=your_xaman_api_secret
   ```

3. Start the development server:
   ```
   pnpm run dev
   ```

### Backend Setup

1. Navigate to the server directory:
   ```
   cd server
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file based on the `.env.example` file:
   ```
   cp .env.example .env
   ```

4. Update the `.env` file with your Xaman (XUMM) API credentials:
   ```
   XAMAN_API_KEY=your_xaman_api_key
   XAMAN_API_SECRET=your_xaman_api_secret
   ```

5. Start the server:
   ```
   npm run dev
   ```

## Available Scripts

### Frontend
- `pnpm install` - Install dependencies
- `pnpm run dev` - Start development server
- `pnpm run build` - Build for production
- `pnpm run lint` - Lint source files

### Backend
- `npm install` - Install dependencies
- `npm run dev` - Start development server with hot-reload
- `npm start` - Start production server

## Tech Stack

### Frontend
- React
- Vite
- TailwindCSS
- Material UI
- XummSDK

### Backend
- Node.js
- Express
- XummSDK
