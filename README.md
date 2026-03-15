# Salden — Decentralized Payroll Platform

Salden is a fully decentralized, on-chain payroll platform built on Arc Network. It enables organizations to pay employees directly through private smart contracts using USDC, with no intermediaries, no legacy banking infrastructure, and no delays. Every payment is cryptographically verifiable, every employer owns their isolated payroll contract, and all payroll data is encrypted end-to-end before leaving the browser.

---

## Architecture Overview

The platform is composed of three layers:

**Frontend** — A React and Vite single-page application with Tailwind CSS. All cryptographic operations (AES-256-GCM encryption/decryption) are performed in the browser using the Web Crypto API. The application has no backend server.

**Smart Contracts on Arc Testnet** — The `SaldenPayrollFactory` deploys a unique, isolated `SaldenPayroll` clone for each employer. The `SaldenRegistryFactory` deploys a personal `SaldenRegistry` contract per wallet, which stores an IPFS CID pointing to that employer's encrypted payroll data.

**IPFS via Pinata** — Encrypted payroll data (employee records, compliance results, setup state) is stored on IPFS. The CID is updated in the employer's on-chain registry after each save, making the data fully portable across devices and browsers.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend Framework | React 18, Vite 5 |
| Styling | Tailwind CSS 3 |
| Animations | Framer Motion 11 |
| Wallet Connectivity | Thirdweb v5 |
| Blockchain Interaction | Ethers.js v6 |
| Icons | Phosphor Icons |
| Local Storage | IndexedDB (via `idb`) |
| IPFS Storage | Pinata |
| Encryption | Web Crypto API — AES-256-GCM, PBKDF2 |
| PDF Generation | jsPDF + jspdf-autotable |
| CSV Parsing | PapaParse |
| AML/CTF Compliance | Scorechain Free API |
| Network | Arc Testnet (Chain ID: 5042002) |
| Deployment | Vercel |

---

## Features

**Payroll Setup and Deployment**
On first connection, an employer completes a setup form providing their name, organization, and employee data (via CSV/JSON upload or manual entry). After accepting the Terms of Service, the application deploys a private `SaldenPayroll` clone on Arc Testnet. A one-time USDC deployment fee is charged by the factory contract and approved automatically during setup.

**HR Dashboard**
A full-featured employee table displaying serial number, full name, department, wallet address (truncated), and salary amount. Includes advanced search by name or department, inline add/edit/delete with confirmation guards, and a gross total payroll display. Long-pressing or right-clicking any row opens a context menu for quick row actions.

**Batch Payroll Execution**
The Execute Payments button triggers the `batchPay()` function on the employer's clone. The frontend automatically splits payrolls larger than 1,000 employees into sequential batches and displays a live progress bar. Duplicate wallet addresses are detected and flagged before any transaction is submitted.

**Payment History and PDF Receipts**
The Payment History panel queries on-chain `BatchPaid` events for the connected wallet. Each receipt shows employer address, number of employees paid, total USDC, transaction hash (linked to the block explorer), and date. A Download Full Receipt button decodes the `batchPay()` calldata to extract per-employee payment details and generates a formatted PDF receipt with the Salden logo.

**Cross-Device Data Sync**
Payroll data is encrypted using an AES-256-GCM key derived from a wallet signature (PBKDF2, 100,000 iterations). The encrypted blob is uploaded to IPFS via Pinata. The resulting CID is written to the employer's personal `SaldenRegistry` contract. On any subsequent device, connecting the same wallet and signing once causes the application to read the CID, fetch the IPFS blob, and decrypt it — restoring the complete dashboard with no manual re-entry.

**AML and CTF Compliance**
The Compliance page uses the Scorechain Free Sanctions Screening API to verify each employee wallet address against global sanctions databases. Scanning runs automatically in the background when the employer first loads the compliance page or when the last scan is older than ten days. A non-blocking progress bar shows real-time progress. Results display as a glowing green GOOD badge (all clear) or a glowing red CRITICAL badge (flagged wallets). All verified results are persisted to IPFS alongside payroll data.

**Contract Settings**
The Settings page exposes all administrative functions of the employer's payroll clone: pause, unpause, withdraw (specific amount), and emergency withdrawal. Each action requires confirmation and triggers a wallet transaction.

**Security**
- All sensitive keys and contract addresses are stored exclusively in `.env` — never hardcoded
- Client-side rate limiting on all API operations (Pinata, Scorechain, payroll execution, registry writes)
- Input sanitization on every user-facing form field
- File validation by byte signature, not extension
- Duplicate wallet detection before payroll execution
- Security headers enforced via `vercel.json` (CSP, HSTS, X-Frame-Options, Referrer-Policy)
- AES-256-GCM encryption with PBKDF2 key derivation (100,000 iterations)
- Zero plaintext exposure to any storage provider

---

## Getting Started

### Prerequisites

- Node.js 20 or later
- A wallet with Arc Testnet USDC (for deploying and executing payroll)
- MetaMask or any EIP-1193 compatible wallet

### Installation

Clone or extract the project directory, then install dependencies:

```bash
npm install
```

### Environment Configuration

Copy the environment template and fill in the values:

```bash
cp .env.example .env
```

All required values are documented in `.env.example`. The `.env` file is listed in `.gitignore` and must never be committed to version control.

### Development Server

```bash
npm run dev
```

The application will start at `http://localhost:5173`.

### Production Build

```bash
npm run build
```

The compiled output is placed in the `dist/` directory, ready for deployment.

### Deployment to Vercel

The project includes a `vercel.json` with all required security headers, SPA rewrite rules, and build configuration. Connect the repository to Vercel and add the environment variables from `.env` in the Vercel project settings. Vercel will handle the rest.

---

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_THIRDWEB_CLIENT_ID` | Thirdweb dashboard client ID |
| `VITE_PINATA_JWT` | Pinata scoped JWT for IPFS uploads |
| `VITE_SCORECHAIN_API_KEY` | Scorechain Free Tier API key |
| `VITE_SCORECHAIN_BASE_URL` | Scorechain API base URL |
| `VITE_ARC_CHAIN_ID` | Arc Testnet chain ID (5042002) |
| `VITE_ARC_RPC_URL` | Arc Testnet RPC endpoint |
| `VITE_ARC_EXPLORER_URL` | Arc Testnet block explorer base URL |
| `VITE_PAYROLL_FACTORY_ADDRESS` | Deployed `SaldenPayrollFactory` contract address |
| `VITE_REGISTRY_FACTORY_ADDRESS` | Deployed `SaldenRegistryFactory` contract address |
| `VITE_USDC_ADDRESS` | USDC token contract address on Arc Testnet |
| `VITE_CLOCKIFY_API_KEY` | Clockify API key (reserved for Attendance Sheet feature) |
| `VITE_TWITTER_COMPANY_URL` | Company X (Twitter) profile URL |
| `VITE_TWITTER_DEV_URL` | Developer X (Twitter) profile URL |

---

## Project Structure

```
salden-dapp/
├── .env                        # Environment variables (never commit)
├── .env.example                # Safe environment template
├── .gitignore
├── index.html                  # HTML shell with font imports and security meta tags
├── package.json
├── vite.config.js              # Vite configuration with security headers and code splitting
├── tailwind.config.js          # Custom design tokens and animations
├── postcss.config.js
├── vercel.json                 # Deployment configuration with CSP and HSTS headers
├── public/
│   └── favicon.jpg             # Salden favicon
└── src/
    ├── main.jsx                # Entry point with providers
    ├── App.jsx                 # Root router and wallet orchestration
    ├── index.css               # Global styles and Tailwind directives
    ├── assets/                 # Logo, favicon, and brand images
    ├── lib/
    │   ├── chains.js           # Arc Testnet chain definition
    │   ├── client.js           # Thirdweb client and wallet list
    │   └── abis.js             # All contract ABIs and addresses
    ├── utils/
    │   ├── contracts.js        # All blockchain interactions (ethers v6)
    │   ├── encryption.js       # AES-256-GCM client-side encryption
    │   ├── indexeddb.js        # IndexedDB CRUD operations
    │   ├── ipfs.js             # Pinata IPFS upload and fetch
    │   ├── pdf.js              # PDF receipt generation
    │   ├── rateLimiter.js      # Client-side rate limiting
    │   └── validation.js       # Input sanitization and validation
    ├── context/
    │   └── AppContext.jsx      # Global state, data sync, encryption key management
    ├── components/
    │   ├── Layout.jsx          # Authenticated page wrapper with header and footer
    │   ├── Sidebar.jsx         # Collapsible navigation sidebar
    │   ├── Toast.jsx           # Toast notification system
    │   ├── SkeletonLoader.jsx  # Layout-mirroring skeleton screens
    │   ├── TermsModal.jsx      # Scrollable ToS modal with gated acceptance
    │   └── SetupModal.jsx      # Payroll setup and deployment modal
    └── pages/
        ├── Landing.jsx         # Public landing page with animated sections
        ├── HRDashboard.jsx     # Employee table, payroll execution, history
        ├── Attendance.jsx      # Clockify integration (coming soon)
        ├── Compliance.jsx      # AML/CTF screening with Scorechain
        └── Settings.jsx        # Contract controls (pause, withdraw, emergency)
```

---

## Network Details

Arc Testnet is the deployment target for all smart contract interactions.

| Parameter | Value |
|---|---|
| Network Name | ARC Testnet |
| RPC URL | https://rpc.testnet.arc.network |
| Chain ID | 5042002 |
| Currency Symbol | USDC |
| Block Explorer | https://testnet.arcscan.app |

---

## Security Considerations

This application follows OWASP input validation guidelines, applies defense-in-depth for client-side security, and is designed for production deployment. All keys are stored exclusively in environment variables. Data stored on IPFS is always ciphertext. The Web Crypto API is used for all cryptographic operations — no third-party crypto library handles private key material.

Rate limiting is applied at the client level as a UX safeguard. Production deployments should also enforce server-side rate limiting at the Vercel Edge or equivalent layer for comprehensive DDoS protection.

---

## License

Copyright © Salden Limited 2026. All rights reserved.
