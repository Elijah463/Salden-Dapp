// ─── Contract Addresses ─────────────────────────────────────────────────────
export const ADDRESSES = {
  PAYROLL_FACTORY: import.meta.env.VITE_PAYROLL_FACTORY_ADDRESS,
  REGISTRY_FACTORY: import.meta.env.VITE_REGISTRY_FACTORY_ADDRESS,
  USDC: import.meta.env.VITE_USDC_ADDRESS,
};

// ─── SaldenPayrollFactory ABI ────────────────────────────────────────────────
// Factory contract that deploys individual SaldenPayroll clones per employer.
export const PAYROLL_FACTORY_ABI = [
  "function getUserPayrolls(address user) view returns (address[])",
  "function deployPayroll() external returns (address)",
  "function FEE() view returns (uint256)",
  "function usdc() view returns (address)",
  "event PayrollDeployed(address indexed employer, address indexed clone)",
];

// ─── SaldenPayroll Clone ABI ─────────────────────────────────────────────────
// Each employer's private payroll contract instance.
export const PAYROLL_CLONE_ABI = [
  "function batchPay(address[] calldata employees, uint256[] calldata amounts) external",
  "function emergencyWithdraw() external",
  "function pause() external",
  "function unpause() external",
  "function withdraw(uint256 amount) external",
  "function paused() view returns (bool)",
  "function usdc() view returns (address)",
  "function owner() view returns (address)",
  "event BatchPaid(address indexed employer, uint256 totalEmployees, uint256 totalAmount)",
];

// ─── SaldenRegistryFactory ABI ───────────────────────────────────────────────
// Factory that creates a personal registry contract per wallet for IPFS CID storage.
export const REGISTRY_FACTORY_ABI = [
  "function getRegistry(address user) view returns (address)",
  "function createRegistry() external",
  "event RegistryCreated(address indexed owner, address indexed registry)",
];

// ─── SaldenRegistry (Personal) ABI ──────────────────────────────────────────
// Each user's personal on-chain registry that stores their encrypted IPFS CID.
export const REGISTRY_ABI = [
  "function getCID() view returns (string)",
  "function setCID(string calldata cid) external",
  "function owner() view returns (address)",
];

// ─── USDC Token ABI ──────────────────────────────────────────────────────────
export const USDC_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address account) view returns (uint256)",
  "function symbol() view returns (string)",
];
