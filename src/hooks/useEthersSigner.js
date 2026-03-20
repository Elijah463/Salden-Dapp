/**
 * useEthersSigner.js
 * React hook that bridges thirdweb v5 wallet state to an ethers.js v6 Signer
 * via the official thirdweb ethers6 adapter.
 *
 * IMPORTANT: ethers6Adapter.signer.toEthers() requires the `account` object
 * (from useActiveAccount), NOT the `wallet` object (from useActiveWallet).
 * The account object holds the .address property the adapter reads internally.
 * Passing `wallet` instead of `account` causes:
 *   "Cannot read properties of undefined (reading 'address')"
 */

import { useCallback } from "react";
import { useActiveWallet, useActiveAccount } from "thirdweb/react";
import { ethers6Adapter } from "thirdweb/adapters/ethers6";
import { client } from "../lib/client.js";
import { arcTestnet } from "../lib/chains.js";

export function useEthersSigner() {
  const wallet = useActiveWallet();
  const account = useActiveAccount();

  /**
   * Resolves to an ethers v6 Signer.
   * Uses `account` (not `wallet`) as required by the thirdweb ethers6 adapter.
   */
  const getSigner = useCallback(async () => {
    if (!wallet) {
      throw new Error("No wallet connected. Please connect a wallet first.");
    }
    if (!account) {
      throw new Error("Wallet account not ready. Please wait a moment and try again.");
    }
    return ethers6Adapter.signer.toEthers({ client, chain: arcTestnet, account });
  }, [wallet, account]);

  /**
   * Signs a plain text message using the active thirdweb account.
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
