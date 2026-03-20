// ─── Contract Addresses ─────────────────────────────────────────────────────
export const ADDRESSES = {
  PAYROLL_FACTORY: import.meta.env.VITE_PAYROLL_FACTORY_ADDRESS,
  REGISTRY_FACTORY: import.meta.env.VITE_REGISTRY_FACTORY_ADDRESS,
  USDC: import.meta.env.VITE_USDC_ADDRESS,
};

// ─── PayrollFactory ABI ──────────────────────────────────────────────────────
// Factory contract that deploys individual SaldenPayroll clones per employer.
// NOTE: The fee is stored as `deployFee` (public state var), not `FEE()`.
//       withdraw() on the clone takes NO arguments — it drains the full balance.
//       emergencyWithdraw(address token) on the clone requires a token address.
export const PAYROLL_FACTORY_ABI = [
  "function getUserPayrolls(address user) view returns (address[])",
  "function getUserPayrollCount(address user) view returns (uint256)",
  "function getUserPayrollsPaginated(address user, uint256 offset, uint256 limit) view returns (address[])",
  "function deployPayroll() external returns (address)",
  "function deployFee() view returns (uint256)",
  "function cooldown() view returns (uint256)",
  "function cooldownRemaining(address user) view returns (uint256)",
  "function lastDeployTime(address user) view returns (uint256)",
  "function usdc() view returns (address)",
  "function implementation() view returns (address)",
  "event NewPayrollCreated(address indexed owner, address indexed payrollAddress, uint256 feePaid)",
];

// ─── SaldenPayroll Clone ABI ─────────────────────────────────────────────────
// Each employer's private payroll contract instance.
// withdraw()               — no args, drains full USDC balance to owner
// emergencyWithdraw(token) — recovers any ERC-20 token by address
export const PAYROLL_CLONE_ABI = [
  "function batchPay(address[] calldata employees, uint256[] calldata amounts) external",
  "function emergencyWithdraw(address token) external",
  "function pause() external",
  "function unpause() external",
  "function withdraw() external",
  "function paused() view returns (bool)",
  "function usdc() view returns (address)",
  "function owner() view returns (address)",
  "event BatchPaid(address indexed employer, uint256 indexed totalEmployees, uint256 totalAmount)",
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
