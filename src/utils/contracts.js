/**
 * contracts.js
 * All blockchain interaction logic using ethers.js v6.
 *
 * ARCHITECTURE: Every function that mutates on-chain state accepts an ethers
 * Signer as its first parameter. Callers obtain the signer via useEthersSigner.
 * Read-only operations use a JsonRpcProvider and require no signer.
 *
 * Tested against ethers v6 API — notably, EventLog objects returned by
 * queryFilter() do NOT have a .getBlock() method (removed from v5).
 * Block data is fetched via provider.getBlock(event.blockNumber).
 */

import { ethers } from "ethers";
import {
  ADDRESSES,
  PAYROLL_FACTORY_ABI,
  PAYROLL_CLONE_ABI,
  REGISTRY_FACTORY_ABI,
  REGISTRY_ABI,
  USDC_ABI,
} from "../lib/abis.js";
import { ARC_RPC_URL, ARC_EXPLORER_URL } from "../lib/chains.js";

// ─── Read-only provider ───────────────────────────────────────────────────────

function getReadProvider() {
  return new ethers.JsonRpcProvider(ARC_RPC_URL);
}

// ─── Onboarding ──────────────────────────────────────────────────────────────

/**
 * Idempotent: returns the existing clone if one exists, otherwise approves
 * the deployment fee and deploys a new SaldenPayroll clone.
 *
 * @param {ethers.Signer} signer
 * @param {Function} onStatus - (message: string) => void
 * @returns {Promise<string>} Clone address
 */
export async function getOrDeployPayrollClone(signer, employerAddress, onStatus = () => {}) {
  const factory = new ethers.Contract(
    ADDRESSES.PAYROLL_FACTORY,
    PAYROLL_FACTORY_ABI,
    signer
  );

  onStatus("Checking for existing payroll contract…");
  const existing = await factory.getUserPayrolls(employerAddress);
  if (existing.length > 0) {
    onStatus("Existing payroll contract found.");
    return existing[existing.length - 1];
  }

  onStatus("No contract found. Preparing deployment…");

  // Attempt to read the deployment fee. Some factory versions are free to use
  // and do not expose usdc() or FEE() — in that case skip the approval step.
  // If a fee IS required, deployPayroll() itself will revert with a clear message.
  try {
    const usdcAddress = await factory.usdc();
    const fee = await factory.deployFee();
    if (fee > 0n && usdcAddress && usdcAddress !== ethers.ZeroAddress) {
      const usdc = new ethers.Contract(usdcAddress, USDC_ABI, signer);
      const currentAllowance = await usdc.allowance(employerAddress, ADDRESSES.PAYROLL_FACTORY);
      if (currentAllowance < fee) {
        onStatus("Approving deployment fee in your wallet…");
        const txApprove = await usdc.approve(ADDRESSES.PAYROLL_FACTORY, fee);
        onStatus("Waiting for fee approval confirmation…");
        await txApprove.wait(1);
      }
    }
  } catch {
    // Factory does not expose fee functions — proceeding without approval
    onStatus("No deployment fee required. Proceeding…");
  }

  onStatus("Deploying your personal payroll contract…");
  const txDeploy = await factory.deployPayroll();
  onStatus("Waiting for deployment confirmation…");
  await txDeploy.wait(1);

  const updated = await factory.getUserPayrolls(employerAddress);
  if (!updated.length) throw new Error("Deployment succeeded but no clone address returned.");
  onStatus("Payroll contract deployed successfully.");
  return updated[updated.length - 1];
}

/**
 * Returns all payroll clone addresses owned by a given employer.
 * @param {string} employerAddress
 * @returns {Promise<string[]>}
 */
export async function getUserPayrolls(employerAddress) {
  const provider = getReadProvider();
  const factory = new ethers.Contract(
    ADDRESSES.PAYROLL_FACTORY,
    PAYROLL_FACTORY_ABI,
    provider
  );
  return factory.getUserPayrolls(employerAddress);
}

// ─── Batch Payroll Execution ──────────────────────────────────────────────────

/**
 * Executes batch payroll. Splits into batches of 1,000 if needed.
 * Approves the exact USDC total before submitting.
 *
 * @param {ethers.Signer} signer
 * @param {string} cloneAddress
 * @param {Array<{walletAddress: string, salaryAmount: number|string}>} employees
 * @param {Function} onStatus
 * @param {Function} onProgress - (current: number, total: number) => void
 * @returns {Promise<ethers.TransactionReceipt[]>}
 */
export async function executePayroll(
  signer,
  cloneAddress,
  employees,
  onStatus = () => {},
  onProgress = () => {},
  employerAddress
) {
  const BATCH_SIZE = 1000;

  const payrollContract = new ethers.Contract(cloneAddress, PAYROLL_CLONE_ABI, signer);
  const usdcAddress = await payrollContract.usdc();
  const usdc = new ethers.Contract(usdcAddress, USDC_ABI, signer);
  const decimals = 6; // Arc testnet USDC: 6 decimals for contract interactions

  // Format amounts and compute total
  let totalWei = 0n;
  const formatted = employees.map((emp) => {
    const amountWei = ethers.parseUnits(String(emp.salaryAmount), decimals);
    totalWei += amountWei;
    return { address: emp.walletAddress, amountWei };
  });

  onStatus(`Total payroll: ${ethers.formatUnits(totalWei, decimals)} USDC`);

  // Approve if current allowance is insufficient
  const currentAllowance = await usdc.allowance(employerAddress, cloneAddress);
  if (currentAllowance < totalWei) {
    onStatus("Approving USDC spend in your wallet…");
    const txApprove = await usdc.approve(cloneAddress, totalWei);
    onStatus("Waiting for approval confirmation…");
    await txApprove.wait(1);
  }

  const receipts = [];
  const totalBatches = Math.ceil(employees.length / BATCH_SIZE);

  for (let i = 0; i < totalBatches; i++) {
    const batchStart = i * BATCH_SIZE;
    const batch = formatted.slice(batchStart, batchStart + BATCH_SIZE);
    const batchAddresses = batch.map((e) => e.address);
    const batchAmounts = batch.map((e) => e.amountWei);

    onStatus(`Executing batch ${i + 1} of ${totalBatches} (${batch.length} employees)…`);
    onProgress(i + 1, totalBatches);

    const tx = await payrollContract.batchPay(batchAddresses, batchAmounts);
    onStatus(`Batch ${i + 1} submitted. Waiting for confirmation…`);
    const receipt = await tx.wait(1);
    receipts.push(receipt);
  }

  onStatus("All payroll batches executed successfully.");
  return receipts;
}

// ─── Payroll History ──────────────────────────────────────────────────────────

/**
 * Fetches on-chain BatchPaid event history for an employer.
 *
 * NOTE: ethers v6 EventLog objects do NOT have a .getBlock() method.
 * Block data is fetched via provider.getBlock(event.blockNumber).
 *
 * @param {string} cloneAddress
 * @param {string} employerAddress
 * @returns {Promise<Array>} Sorted newest-first
 */
/**
 * @param {string}  cloneAddress
 * @param {string}  employerAddress
 * @param {number}  [fromBlock=null] - If provided, skip binary search and query from this block.
 *                                     Pass the lastIndexedBlock+1 for incremental updates.
 * @returns {Promise<{events: Array, lastBlock: number}>}
 */
export async function getPayrollHistory(cloneAddress, employerAddress, fromBlock = null) {
  const provider = getReadProvider();
  const payrollContract = new ethers.Contract(cloneAddress, PAYROLL_CLONE_ABI, provider);
  const usdcAddress = await payrollContract.usdc();
  const usdc = new ethers.Contract(usdcAddress, USDC_ABI, provider);
  const decimals = 18; // Arc testnet USDC: 18 decimals for display

  // Arc testnet limits eth_getLogs to a 10,000 block range per request.
  // Arc is at 33M+ blocks so querying from 0 would require 3,300+ RPC calls.
  //
  // Strategy: get the block the clone contract was DEPLOYED at by fetching
  // the transaction that created it. Every contract has a deployTransaction
  // accessible via provider.getCode and the contract's creation tx.
  // We use getHistory on the contract address to find its creation block,
  // then paginate only from that block forward — typically a very small range.
  const latestBlock = await provider.getBlockNumber();
  const CHUNK = 9999;
  const filter = payrollContract.filters.BatchPaid(employerAddress);
  const events = [];

  // Find the deployment block by binary-searching for when contract code appeared.
  // This is efficient: O(log N) RPC calls instead of O(N/9999).
  // If fromBlock is provided (incremental update), skip binary search entirely.
  // Otherwise binary-search for the contract deployment block so we don't
  // scan 33M+ blocks from genesis.
  let startBlock = fromBlock;

  if (startBlock === null) {
    // Binary search: find exact block where contract code first appeared.
    // O(log 33M) ≈ 25 RPC calls — far better than 3,300 brute-force chunks.
    try {
      let lo = 0;
      let hi = latestBlock;
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        const code = await provider.getCode(cloneAddress, mid);
        if (code && code !== "0x") {
          hi = mid;
        } else {
          lo = mid + 1;
        }
      }
      startBlock = lo;
    } catch {
      // Fallback: last 50,000 blocks (~5 RPC calls, covers ~2 weeks on Arc)
      startBlock = Math.max(0, latestBlock - 50000);
    }
  }

  // Paginate from startBlock to latest in 9,999-block chunks
  for (let from = startBlock; from <= latestBlock; from += CHUNK) {
    const to = Math.min(from + CHUNK - 1, latestBlock);
    const chunk = await payrollContract.queryFilter(filter, from, to);
    events.push(...chunk);
  }

  const history = await Promise.all(
    events.map(async (event) => {
      // ethers v6: use provider.getBlock(), not event.getBlock()
      const block = await provider.getBlock(event.blockNumber);
      return {
        date: new Date(block.timestamp * 1000).toLocaleString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        employeesPaid: event.args[1].toString(),
        totalAmountPaid: Number(
          ethers.formatUnits(event.args[2], decimals)
        ).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
        transactionHash: event.transactionHash,
        explorerLink: `${ARC_EXPLORER_URL}/tx/${event.transactionHash}`,
        blockNumber: block.number,
        timestamp: block.timestamp,
        employer: employerAddress,
        cloneAddress,
      };
    })
  );

  return {
    events: history.sort((a, b) => b.timestamp - a.timestamp),
    lastBlock: latestBlock,
  };
}

/**
 * Decodes calldata from a batchPay transaction to extract per-employee amounts.
 *
 * @param {string} txHash
 * @param {string} cloneAddress
 * @returns {Promise<Array<{employee: string, amount: string}>>}
 */
export async function decodeBatchPayCalldata(txHash, cloneAddress) {
  const provider = getReadProvider();
  const tx = await provider.getTransaction(txHash);
  if (!tx) throw new Error("Transaction not found on-chain.");

  const iface = new ethers.Interface([
    "function batchPay(address[] calldata employees, uint256[] calldata amounts) external",
  ]);

  const decoded = iface.parseTransaction({ data: tx.data, value: tx.value });
  if (!decoded || decoded.name !== "batchPay") {
    throw new Error("Could not decode transaction as a batchPay call.");
  }

  const payrollContract = new ethers.Contract(cloneAddress, PAYROLL_CLONE_ABI, provider);
  const usdcAddress = await payrollContract.usdc();
  const usdc = new ethers.Contract(usdcAddress, USDC_ABI, provider);
  const decimals = 18; // Arc testnet USDC: 18 decimals for display

  return decoded.args[0].map((address, i) => ({
    employee: address,
    amount: Number(
      ethers.formatUnits(decoded.args[1][i], decimals)
    ).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
  }));
}

// ─── Registry (IPFS CID Management) ──────────────────────────────────────────

/**
 * Returns the user's registry contract address, or null if not yet deployed.
 * @param {string} userAddress
 * @returns {Promise<string|null>}
 */
export async function getUserRegistry(userAddress) {
  const provider = getReadProvider();
  const factory = new ethers.Contract(
    ADDRESSES.REGISTRY_FACTORY,
    REGISTRY_FACTORY_ABI,
    provider
  );
  const registryAddress = await factory.getRegistry(userAddress);
  if (registryAddress === ethers.ZeroAddress) return null;
  return registryAddress;
}

/**
 * Deploys a personal SaldenRegistry for the connected wallet if one
 * does not already exist. Idempotent.
 *
 * @param {ethers.Signer} signer
 * @param {Function} onStatus
 * @returns {Promise<string>} Registry address
 */
export async function createUserRegistry(signer, employerAddress, onStatus = () => {}) {
  const existing = await getUserRegistry(employerAddress);
  if (existing) return existing;

  const factory = new ethers.Contract(
    ADDRESSES.REGISTRY_FACTORY,
    REGISTRY_FACTORY_ABI,
    signer
  );

  onStatus("Creating your personal data registry on-chain…");
  const tx = await factory.createRegistry();
  onStatus("Waiting for registry deployment…");
  const receipt = await tx.wait(1);

  // Query the registry address from the factory after deployment
  const newRegistry = await getUserRegistry(employerAddress);
  if (!newRegistry || newRegistry === ethers.ZeroAddress) {
    throw new Error("Registry deployment failed. Please try again.");
  }
  onStatus("Registry created.");
  return newRegistry;
}

/**
 * Reads the latest IPFS CID from a registry contract.
 * @param {string} registryAddress
 * @returns {Promise<string>}
 */
export async function readCIDFromRegistry(registryAddress) {
  const provider = getReadProvider();
  const registry = new ethers.Contract(registryAddress, REGISTRY_ABI, provider);
  const cid = await registry.getCID();
  return cid ?? "";
}

/**
 * Writes a new CID to the registry contract on-chain.
 * @param {ethers.Signer} signer
 * @param {string} registryAddress
 * @param {string} cid
 * @param {Function} onStatus
 */
export async function writeCIDToRegistry(signer, registryAddress, cid, onStatus = () => {}) {
  const registry = new ethers.Contract(registryAddress, REGISTRY_ABI, signer);
  onStatus("Saving data pointer to blockchain…");
  const tx = await registry.setCID(cid);
  onStatus("Waiting for confirmation…");
  await tx.wait(1);
  onStatus("Data synchronised on-chain.");
}

// ─── Contract Settings ────────────────────────────────────────────────────────

/** Drains all USDC from the clone to the owner. */
export async function emergencyWithdraw(signer, cloneAddress) {
  // The SaldenPayroll clone's emergencyWithdraw(address token) requires
  // the token address — we always pass USDC since that's what it holds.
  const contract = new ethers.Contract(cloneAddress, PAYROLL_CLONE_ABI, signer);
  const usdcAddress = await contract.usdc();
  const tx = await contract.emergencyWithdraw(usdcAddress);
  return tx.wait(1);
}

/** Pauses the clone, disabling batch payments. */
export async function pauseContract(signer, cloneAddress) {
  const contract = new ethers.Contract(cloneAddress, PAYROLL_CLONE_ABI, signer);
  const tx = await contract.pause();
  return tx.wait(1);
}

/** Unpauses the clone. */
export async function unpauseContract(signer, cloneAddress) {
  const contract = new ethers.Contract(cloneAddress, PAYROLL_CLONE_ABI, signer);
  const tx = await contract.unpause();
  return tx.wait(1);
}

/**
 * Transfers a specific USDC amount from the clone to the owner.
 * @param {ethers.Signer} signer
 * @param {string} cloneAddress
 * @param {string} amountUSDC - Human-readable e.g. "500"
 */
export async function withdrawFunds(signer, cloneAddress) {
  // The SaldenPayroll clone's withdraw() takes no arguments —
  // it transfers the entire USDC balance to the owner wallet.
  const contract = new ethers.Contract(cloneAddress, PAYROLL_CLONE_ABI, signer);
  const tx = await contract.withdraw();
  return tx.wait(1);
}

/** Returns whether the clone is currently paused. */
export async function isContractPaused(cloneAddress) {
  const provider = getReadProvider();
  const contract = new ethers.Contract(cloneAddress, PAYROLL_CLONE_ABI, provider);
  return contract.paused();
}

/** Returns the USDC balance held by the clone contract. */
export async function getCloneUSDCBalance(cloneAddress) {
  const provider = getReadProvider();
  const contract = new ethers.Contract(cloneAddress, PAYROLL_CLONE_ABI, provider);
  const usdcAddress = await contract.usdc();
  const usdc = new ethers.Contract(usdcAddress, USDC_ABI, provider);
  const decimals = 18; // Arc testnet USDC: 18 decimals for display
  const balance = await usdc.balanceOf(cloneAddress);
  return ethers.formatUnits(balance, decimals);
}
