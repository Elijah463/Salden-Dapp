/**
 * useEthersSigner.js
 *
 * Builds a proper ethers v6 AbstractSigner by wrapping the thirdweb account
 * directly — no adapter involved.
 *
 * WHY NOT THE ADAPTER:
 * ethers6Adapter.signer.toEthers() returns a signer whose sendTransaction()
 * method routes through thirdweb's internal pipeline, which requires thirdweb
 * chain objects and does not satisfy ethers v6 contract runner expectations.
 * Even calling .connect(provider) does not fix this because the adapter's
 * sendTransaction override ignores the attached provider.
 *
 * THE FIX:
 * We extend ethers.AbstractSigner and implement all required methods using
 * the thirdweb account object directly:
 *   - getAddress()       → account.address
 *   - signMessage()      → account.signMessage()
 *   - signTransaction()  → account.signTransaction()
 *   - sendTransaction()  → build tx, sign it, broadcast via JsonRpcProvider
 *   - connect()          → return new instance with new provider
 */

import { useCallback } from "react";
import { useActiveWallet, useActiveAccount } from "thirdweb/react";
import { ethers } from "ethers";
import { ARC_RPC_URL } from "../lib/chains.js";

/**
 * Custom ethers v6 Signer that wraps a thirdweb account.
 * The provider is a standard JsonRpcProvider connected to Arc Testnet.
 */
class ThirdwebEthersSigner extends ethers.AbstractSigner {
  constructor(account, provider) {
    super(provider);
    this._account = account;
  }

  async getAddress() {
    return this._account.address;
  }

  async signMessage(message) {
    const msg = typeof message === "string" ? message : ethers.toUtf8String(message);
    return this._account.signMessage({ message: msg });
  }

  async signTransaction(tx) {
    const populated = await this.populateTransaction(tx);
    const serialized = ethers.Transaction.from(populated).serialized;
    const signed = await this._account.signTransaction({
      chainId: populated.chainId,
      data: populated.data || "0x",
      gasLimit: populated.gasLimit,
      gasPrice: populated.gasPrice,
      maxFeePerGas: populated.maxFeePerGas,
      maxPriorityFeePerGas: populated.maxPriorityFeePerGas,
      nonce: populated.nonce,
      to: populated.to,
      value: populated.value || 0n,
    });
    return signed;
  }

  async sendTransaction(tx) {
    const provider = this.provider;
    if (!provider) throw new Error("No provider attached to signer.");

    // Populate missing fields
    const populated = await this.populateTransaction(tx);

    // Sign the transaction
    const signedTx = await this.signTransaction(populated);

    // Broadcast via the attached JsonRpcProvider
    return provider.broadcastTransaction(signedTx);
  }

  connect(provider) {
    return new ThirdwebEthersSigner(this._account, provider);
  }

  // Required by AbstractSigner
  async signTypedData(domain, types, value) {
    return this._account.signTypedData({ domain, types, message: value });
  }
}

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

    const provider = new ethers.JsonRpcProvider(ARC_RPC_URL);
    return new ThirdwebEthersSigner(account, provider);
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
