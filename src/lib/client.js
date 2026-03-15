import { createThirdwebClient } from "thirdweb";
import { createWallet } from "thirdweb/wallets";

if (!import.meta.env.VITE_THIRDWEB_CLIENT_ID) {
  throw new Error("VITE_THIRDWEB_CLIENT_ID is not defined in .env");
}

export const client = createThirdwebClient({
  clientId: import.meta.env.VITE_THIRDWEB_CLIENT_ID,
});

export const supportedWallets = [
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("me.rainbow"),
  createWallet("io.rabby"),
  createWallet("io.zerion.wallet"),
];
