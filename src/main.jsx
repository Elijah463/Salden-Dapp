/**
 * main.jsx
 * Application entry point.
 * Wraps the app in ThirdwebProvider for wallet connectivity and React Router
 * for client-side navigation.
 */

import { Buffer } from "buffer";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThirdwebProvider } from "thirdweb/react";
import { AppProvider } from "./context/AppContext.jsx";
import App from "./App.jsx";
import "./index.css";

// Polyfill Buffer for browser (required by ethers.js v6 in Vite builds)
globalThis.Buffer = Buffer;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThirdwebProvider>
        <AppProvider>
          <App />
        </AppProvider>
      </ThirdwebProvider>
    </BrowserRouter>
  </React.StrictMode>
);
