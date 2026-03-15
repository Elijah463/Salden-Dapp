/**
 * useEthersSigner.js
 * React hook that bridges thirdweb v5 wallet state to an ethers.js v6 Signer
 * via the official thirdweb ethers6 adapter.
 *
 * STABILITY: getSigner and signMessage are wrapped in useCallback so they
 * maintain stable references across renders. This allows consuming effects
 * to list them in dependency arrays without triggering infinite re-runs.
 */

import { useCallback } from "react";
import { useActiveWallet, useActiveAccount } from "thirdweb/react";
import { ethers6Adapter } from "thirdweb/adapters/ethers6";
import { client } from "../lib/client.js";
import { arcTestnet } from "../lib/chains.js";

/**
 * Returns two stable async functions:
 *   getSigner()      — resolves to an ethers v6 Signer on Arc Testnet
 *   signMessage(msg) — signs a plain string with the active account
 *
 * Both functions throw a clear error if called before a wallet is connected.
 */
export function useEthersSigner() {
  const wallet = useActiveWallet();
  const account = useActiveAccount();

  /**
   * Resolves to an ethers v6 Signer via thirdweb's official ethers6 adapter.
   * Works for ALL wallet types: MetaMask, Coinbase, Rainbow, Zerion, Rabby,
   * and any WalletConnect-based wallet that does not inject window.ethereum.
   * @returns {Promise<import("ethers").Signer>}
   */
  const getSigner = useCallback(async () => {
    if (!wallet) throw new Error("No wallet connected. Please connect a wallet first.");
    return ethers6Adapter.signer.toEthers({ client, chain: arcTestnet, wallet });
  }, [wallet]);

  /**
   * Signs a plain text message using the active thirdweb account.
   * @param {string} message
   * @returns {Promise<string>} Hex-encoded signature
   */
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
