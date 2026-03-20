/**
 * useEthersSigner.js
 *
 * Gets an ethers v6 Signer that can both sign AND send transactions.
 *
 * STRATEGY:
 * 1. If window.ethereum is available (MetaMask, Coinbase injected, Rabby, etc.)
 *    use ethers.BrowserProvider directly — this is the gold standard for
 *    injected wallets and always works for transaction sending.
 *
 * 2. If no injected provider (WalletConnect, etc.) fall back to the thirdweb
 *    ethers6 adapter which routes through thirdweb's internal pipeline.
 *
 * WHY NOT JUST THE ADAPTER:
 * ethers6Adapter.signer.toEthers() returns a signer whose sendTransaction
 * implementation does not satisfy ethers v6's contract runner interface on
 * custom chains like Arc Testnet — resulting in UNSUPPORTED_OPERATION errors
 * on every state-changing contract call.
 */

import { useCallback } from "react";
import { useActiveWallet, useActiveAccount } from "thirdweb/react";
import { ethers6Adapter } from "thirdweb/adapters/ethers6";
import { ethers } from "ethers";
import { client } from "../lib/client.js";
import { arcTestnet, ARC_RPC_URL } from "../lib/chains.js";

export function useEthersSigner() {
  const wallet = useActiveWallet();
  const account = useActiveAccount();

  const getSigner = useCallback(async () => {
    if (!wallet) {
      throw new Error("No wallet connected. Please connect a wallet first.");
    }
    if (!account) {
      throw new Error("Wallet account not ready. Please wait a moment and try again.");
    }

    // ── Path 1: Injected wallet (MetaMask, Rabby, Coinbase, etc.) ────────────
    // BrowserProvider wraps window.ethereum directly and gives a fully
    // functional signer that can sign + send transactions on any chain.
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        // Switch to Arc Testnet if not already on it
        const network = await provider.getNetwork();
        const arcChainId = BigInt(import.meta.env.VITE_ARC_CHAIN_ID);
        if (network.chainId !== arcChainId) {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x" + arcChainId.toString(16) }],
          });
        }
        return await provider.getSigner();
      } catch (switchErr) {
        // If chain switch fails, try adding it then retry
        if (switchErr.code === 4902 || switchErr.code === -32603) {
          try {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [{
                chainId: "0x" + BigInt(import.meta.env.VITE_ARC_CHAIN_ID).toString(16),
                chainName: "ARC Testnet",
                nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 6 },
                rpcUrls: [ARC_RPC_URL],
                blockExplorerUrls: [import.meta.env.VITE_ARC_EXPLORER_URL],
              }],
            });
            const provider = new ethers.BrowserProvider(window.ethereum);
            return await provider.getSigner();
          } catch {
            // Fall through to adapter
          }
        }
        // Any other error — fall through to adapter
      }
    }

    // ── Path 2: Non-injected wallet (WalletConnect, etc.) ────────────────────
    return ethers6Adapter.signer.toEthers({ client, chain: arcTestnet, account });
  }, [wallet, account]);

  const signMessage = useCallback(async (message) => {
    if (!account) throw new Error("No account connected.");
    return account.signMessage({ message });
  }, [account]);

  return {
    getSigner,
    signMessage,
    isConnected: !!account && !!wallet,
  };
}
