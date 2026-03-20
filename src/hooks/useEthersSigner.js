/**
 * useEthersSigner.js
 * React hook that bridges thirdweb v5 wallet state to an ethers.js v6 Signer.
 *
 * KEY FIX: ethers6Adapter.signer.toEthers() returns a signer with NO provider
 * attached. Ethers v6 requires a provider on the signer to send transactions —
 * without it every write call throws:
 *   "contract runner does not support sending transactions (UNSUPPORTED_OPERATION)"
 *
 * We fix this by calling .connect(provider) on the returned signer to attach
 * the Arc Testnet JsonRpcProvider before returning it to the caller.
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

  /**
   * Resolves to a fully-connected ethers v6 Signer on Arc Testnet.
   * The signer is connected to a JsonRpcProvider so it can send transactions.
   */
  const getSigner = useCallback(async () => {
    if (!wallet) {
      throw new Error("No wallet connected. Please connect a wallet first.");
    }
    if (!account) {
      throw new Error("Wallet account not ready. Please wait a moment and try again.");
    }

    // Get the raw signer from the thirdweb adapter
    const rawSigner = await ethers6Adapter.signer.toEthers({
      client,
      chain: arcTestnet,
      account,
    });

    // Attach a provider — required by ethers v6 to send transactions
    const provider = new ethers.JsonRpcProvider(ARC_RPC_URL);
    return rawSigner.connect(provider);
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
