/**
 * useEthersSigner.js
 * Bridges thirdweb v5 wallet to an ethers v6 Signer via the official adapter.
 *
 * NOTE: signer.getAddress() is intentionally never called on the returned signer.
 * The employer address is passed explicitly to all contract functions that need it
 * (via the employerAddress parameter added to getOrDeployPayrollClone,
 * executePayroll, and createUserRegistry in contracts.js).
 */

import { useCallback } from "react";
import { useActiveWallet, useActiveAccount } from "thirdweb/react";
import { ethers6Adapter } from "thirdweb/adapters/ethers6";
import { client } from "../lib/client.js";
import { arcTestnet } from "../lib/chains.js";

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
