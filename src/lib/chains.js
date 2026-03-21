import { defineChain } from "thirdweb/chains";

export const arcTestnet = defineChain({
  id: Number(import.meta.env.VITE_ARC_CHAIN_ID),
  name: "ARC Testnet",
  nativeCurrency: {
    name: "USD Coin",
    symbol: "USDC",
    decimals: 18,
  },
  rpc: import.meta.env.VITE_ARC_RPC_URL,
  blockExplorers: [
    {
      name: "ArcScan",
      url: import.meta.env.VITE_ARC_EXPLORER_URL,
      apiUrl: `${import.meta.env.VITE_ARC_EXPLORER_URL}/api`,
    },
  ],
  testnet: true,
});

export const ARC_CHAIN_ID = Number(import.meta.env.VITE_ARC_CHAIN_ID);
export const ARC_RPC_URL = import.meta.env.VITE_ARC_RPC_URL;
export const ARC_EXPLORER_URL = import.meta.env.VITE_ARC_EXPLORER_URL;
