/**
 * Layout.jsx
 * Authenticated layout wrapper with sidebar, header bar, and footer.
 * Wraps all post-login pages.
 */

import { GithubLogo, DiscordLogo } from "@phosphor-icons/react";
import { XLogo } from "@phosphor-icons/react";
import Sidebar from "./Sidebar.jsx";
import { useApp } from "../context/AppContext.jsx";
import { ConnectButton, darkTheme } from "thirdweb/react";
import { client, supportedWallets } from "../lib/client.js";
import { arcTestnet } from "../lib/chains.js";

function truncateAddress(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function Layout({ children }) {
  const { state } = useApp();

  return (
    <div className="min-h-screen bg-salden-bg flex flex-col">
      {/* Sidebar (only visible when wallet connected) */}
      {state.isWalletConnected && <Sidebar />}

      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 bg-salden-bg/80 backdrop-blur-md border-b border-salden-border">
        <div className="flex items-center justify-between px-6 py-4 pl-20">
          {/* Logo area (sidebar trigger is absolutely positioned top-left) */}
          <div className="flex items-center gap-3">
          </div>

          {/* Wallet Connect Button */}
          <div className="flex items-center gap-3">
            {state.isSyncing && (
              <span className="text-xs text-salden-text-muted flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-salden-blue rounded-full animate-pulse" />
                Syncing...
              </span>
            )}
            <ConnectButton
              client={client}
              wallets={supportedWallets}
              chain={arcTestnet}
              connectButton={{ label: "Connect Wallet" }}
              connectModal={{
                size: "compact",
                title: "Sign in to use Salden",
              }}
              theme={darkTheme({
                colors: {
                  skeletonBg: "hsl(245, 91%, 9%)",
                  tertiaryBg: "hsl(244, 84%, 10%)",
                  modalBg: "hsl(248, 78%, 11%)",
                  accentText: "hsl(246, 89%, 11%)",
                  borderColor: "hsl(249, 92%, 11%)",
                  separatorLine: "hsl(250, 88%, 12%)",
                  connectedButtonBgHover: "hsl(240, 86%, 9%)",
                  connectedButtonBg: "hsl(242, 87%, 9%)",
                },
              })}
              supportedTokens={{
                5042002: [
                  {
                    address: "0x3600000000000000000000000000000000000000",
                    name: "USD Coin",
                    symbol: "USDC",
                    icon: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png",
                    decimals: 18,
                  },
                ],
              }}
            />
          </div>
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto w-full">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-salden-border bg-salden-surface/50 mt-auto">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Contacts section */}
            <div className="flex items-center gap-2">
              <span className="text-salden-text-muted text-sm font-medium mr-2">Contacts:</span>

              <a
                href={import.meta.env.VITE_TWITTER_COMPANY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-salden-text-muted hover:text-salden-text-primary transition-colors group"
                aria-label="Salden on X (Twitter)"
              >
                <XLogo size={16} weight="fill" className="group-hover:text-salden-blue transition-colors" />
                <span className="text-xs hidden sm:inline">X</span>
              </a>

              <a
                href="#"
                className="flex items-center gap-1.5 text-salden-text-muted hover:text-salden-text-primary transition-colors group"
                aria-label="Salden Discord"
              >
                <DiscordLogo size={16} weight="fill" className="group-hover:text-violet-400 transition-colors" />
                <span className="text-xs hidden sm:inline">Discord</span>
              </a>

              <a
                href="https://github.com/Elijah463/Salden-Dapp"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-salden-text-muted hover:text-salden-text-primary transition-colors group"
                aria-label="Salden on GitHub"
              >
                <GithubLogo size={16} weight="fill" className="group-hover:text-salden-text-primary transition-colors" />
                <span className="text-xs hidden sm:inline">GitHub</span>
              </a>

              <span className="text-salden-border mx-2">|</span>

              <a
                href={import.meta.env.VITE_TWITTER_DEV_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-salden-text-muted hover:text-salden-blue transition-colors"
              >
                Contact Developer
              </a>
            </div>

            <p className="text-xs text-salden-text-muted">
              Copyright © Salden Limited 2026
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
