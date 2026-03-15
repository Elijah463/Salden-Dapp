/**
 * Settings.jsx
 * Contract settings and control panel.
 * Exposes all admin functions on the employer's payroll clone:
 *   emergencyWithdraw(), pause(), unpause(), withdraw()
 */

import { useState, useEffect, useCallback } from "react";
import {
  GearSix,
  Pause,
  Play,
  Warning,
  Download,
  Spinner,
  ShieldWarning,
  Lock,
  LockOpen,
  CurrencyDollar,
  CheckCircle,
} from "@phosphor-icons/react";
import { useApp } from "../context/AppContext.jsx";
import { useEthersSigner } from "../hooks/useEthersSigner.js";
import { SettingsSkeleton } from "../components/SkeletonLoader.jsx";
import {
  emergencyWithdraw,
  pauseContract,
  unpauseContract,
  withdrawFunds,
  isContractPaused,
  getCloneUSDCBalance,
} from "../utils/contracts.js";

function ConfirmModal({ title, message, confirmLabel, confirmClass, onConfirm, onClose, isDestructive }) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-salden-surface border border-salden-border rounded-2xl w-full max-w-sm shadow-2xl p-6">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${isDestructive ? "bg-red-950/50 border border-red-800/40" : "bg-salden-blue/10 border border-salden-blue/20"}`}>
          <Warning size={22} weight="fill" className={isDestructive ? "text-red-400" : "text-salden-blue"} />
        </div>
        <h3 className="text-center font-bold text-salden-text-primary mb-2">{title}</h3>
        <p className="text-center text-sm text-salden-text-secondary mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-salden-border text-salden-text-secondary hover:bg-salden-hover transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-semibold transition-colors disabled:opacity-60 ${confirmClass}`}
          >
            {loading ? <Spinner size={14} className="animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const { state, addToast } = useApp();
  const { getSigner } = useEthersSigner();
  const { activeCloneAddress, isSyncing } = state;

  const [isPaused, setIsPaused] = useState(null);
  const [balance, setBalance] = useState(null);
  const [loadingState, setLoadingState] = useState(true);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawError, setWithdrawError] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [actionLoading, setActionLoading] = useState({});

  const setActionState = (key, val) =>
    setActionLoading((p) => ({ ...p, [key]: val }));

  const loadContractState = useCallback(async () => {
    if (!activeCloneAddress) return;
    setLoadingState(true);
    try {
      const [paused, bal] = await Promise.all([
        isContractPaused(activeCloneAddress),
        getCloneUSDCBalance(activeCloneAddress),
      ]);
      setIsPaused(paused);
      setBalance(bal);
    } catch (err) {
      console.error("Failed to load contract state:", err.message);
    } finally {
      setLoadingState(false);
    }
  }, [activeCloneAddress]);

  useEffect(() => {
    loadContractState();
  }, [loadContractState]);

  const handlePause = async () => {
    setActionState("pause", true);
    try {
      const signer = await getSigner();
      await pauseContract(signer, activeCloneAddress);
      setIsPaused(true);
      addToast("Payroll contract paused successfully.", "success");
    } catch (err) {
      addToast("Pause failed: " + err.message, "error");
    } finally {
      setActionState("pause", false);
    }
  };

  const handleUnpause = async () => {
    setActionState("unpause", true);
    try {
      const signer = await getSigner();
      await unpauseContract(signer, activeCloneAddress);
      setIsPaused(false);
      addToast("Payroll contract unpaused.", "success");
    } catch (err) {
      addToast("Unpause failed: " + err.message, "error");
    } finally {
      setActionState("unpause", false);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      setWithdrawError("Enter a valid positive USDC amount.");
      return;
    }
    if (balance !== null && amount > parseFloat(balance)) {
      setWithdrawError("Amount exceeds available contract balance.");
      return;
    }
    setWithdrawError("");
    setConfirm({
      title: "Confirm Withdrawal",
      message: `This will transfer ${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} USDC from your payroll contract to your wallet. Confirm to proceed.`,
      confirmLabel: "Withdraw",
      confirmClass: "bg-salden-blue hover:bg-salden-blue-dark",
      isDestructive: false,
      action: async () => {
        setActionState("withdraw", true);
        try {
          const signer = await getSigner();
          await withdrawFunds(signer, activeCloneAddress, withdrawAmount);
          addToast(`${amount} USDC withdrawn successfully.`, "success");
          setWithdrawAmount("");
          await loadContractState();
        } catch (err) {
          addToast("Withdrawal failed: " + err.message, "error");
        } finally {
          setActionState("withdraw", false);
        }
      },
    });
  };

  const handleEmergencyWithdraw = () => {
    setConfirm({
      title: "Emergency Withdrawal",
      message: "This will withdraw ALL USDC funds from your payroll contract immediately. This is an emergency action and is irreversible. Proceed only if absolutely necessary.",
      confirmLabel: "Emergency Withdraw",
      confirmClass: "bg-red-700 hover:bg-red-800",
      isDestructive: true,
      action: async () => {
        setActionState("emergency", true);
        try {
          const signer = await getSigner();
          await emergencyWithdraw(signer, activeCloneAddress);
          addToast("Emergency withdrawal executed successfully.", "success");
          await loadContractState();
        } catch (err) {
          addToast("Emergency withdrawal failed: " + err.message, "error");
        } finally {
          setActionState("emergency", false);
        }
      },
    });
  };

  // Show skeleton while the initial contract state fetch is in progress.
  // Note: we check loadingState alone — not isSyncing from AppContext — because
  // the global sync may already be complete by the time the user navigates here.
  if (loadingState) return <SettingsSkeleton />;

  if (!activeCloneAddress) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
        <GearSix size={40} className="text-salden-text-muted mb-3 opacity-40" />
        <p className="text-salden-text-muted text-sm">
          No payroll contract found. Deploy a payroll contract first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-salden-text-primary">Settings</h1>
        <p className="text-salden-text-muted text-sm mt-0.5">
          Contract controls for your active payroll instance
        </p>
      </div>

      {/* Contract info */}
      <div className="bg-salden-surface border border-salden-border rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs text-salden-text-muted mb-0.5">Active Contract</p>
          <p className="font-mono text-sm text-salden-blue">{activeCloneAddress}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-salden-text-muted mb-0.5">USDC Balance</p>
          <p className="text-lg font-bold text-salden-text-primary">
            {balance !== null ? `${parseFloat(balance).toLocaleString("en-US", { minimumFractionDigits: 2 })} USDC` : "—"}
          </p>
        </div>
      </div>

      {/* Contract status */}
      <div className="bg-salden-surface border border-salden-border rounded-2xl p-5 flex items-center justify-between">
        <div>
          <p className="font-semibold text-salden-text-primary mb-0.5">Contract Status</p>
          <p className="text-sm text-salden-text-secondary">
            {isPaused === null
              ? "Loading status..."
              : isPaused
              ? "The payroll contract is currently paused. Batch payments are disabled."
              : "The payroll contract is active. Batch payments can be executed normally."}
          </p>
        </div>
        {isPaused !== null && (
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold flex-shrink-0 ${isPaused ? "bg-amber-950/40 text-amber-300 border border-amber-700/30" : "bg-emerald-950/40 text-emerald-300 border border-emerald-700/30"}`}>
            {isPaused ? <Lock size={11} /> : <CheckCircle size={11} weight="fill" />}
            {isPaused ? "Paused" : "Active"}
          </div>
        )}
      </div>

      {/* Pause / Unpause */}
      <div className="bg-salden-surface border border-salden-border rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {isPaused ? <LockOpen size={15} className="text-salden-blue" /> : <Pause size={15} className="text-salden-warning" />}
            <p className="font-semibold text-salden-text-primary">
              {isPaused ? "Unpause Contract" : "Pause Contract"}
            </p>
          </div>
          <p className="text-sm text-salden-text-secondary">
            {isPaused
              ? "Resume normal payroll operations. Batch payments will be re-enabled."
              : "Temporarily halt all payroll activity. No payments can be executed while paused."}
          </p>
        </div>
        <button
          onClick={isPaused ? handleUnpause : handlePause}
          disabled={!!(actionLoading.pause || actionLoading.unpause || isPaused === null)}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 ${isPaused ? "bg-salden-blue hover:bg-salden-blue-dark text-white" : "bg-amber-700/80 hover:bg-amber-700 text-white"}`}
        >
          {actionLoading.pause || actionLoading.unpause ? (
            <Spinner size={14} className="animate-spin" />
          ) : isPaused ? (
            <Play size={14} weight="fill" />
          ) : (
            <Pause size={14} weight="fill" />
          )}
          {isPaused ? "Unpause" : "Pause"}
        </button>
      </div>

      {/* Withdraw funds */}
      <div className="bg-salden-surface border border-salden-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Download size={15} className="text-salden-blue" />
          <p className="font-semibold text-salden-text-primary">Withdraw USDC</p>
        </div>
        <p className="text-sm text-salden-text-secondary">
          Transfer a specific amount of USDC from the payroll contract back to your connected wallet.
        </p>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <CurrencyDollar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-salden-text-muted pointer-events-none" />
            <input
              type="number"
              value={withdrawAmount}
              onChange={(e) => { setWithdrawAmount(e.target.value); setWithdrawError(""); }}
              placeholder="Amount in USDC"
              min={0}
              step="0.01"
              className="w-full bg-salden-card border border-salden-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-salden-text-primary placeholder-salden-text-muted focus:outline-none focus:border-salden-blue/60 transition-colors"
            />
          </div>
          <button
            onClick={handleWithdraw}
            disabled={!!actionLoading.withdraw || !withdrawAmount}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-salden-blue hover:bg-salden-blue-dark text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {actionLoading.withdraw ? <Spinner size={14} className="animate-spin" /> : <Download size={14} />}
            Withdraw
          </button>
        </div>
        {withdrawError && (
          <p className="text-xs text-salden-error flex items-center gap-1.5">
            <Warning size={12} /> {withdrawError}
          </p>
        )}
      </div>

      {/* Emergency Withdraw */}
      <div className="bg-red-950/20 border border-red-800/40 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldWarning size={15} className="text-red-400" />
            <p className="font-semibold text-red-300">Emergency Withdrawal</p>
          </div>
          <p className="text-sm text-red-400/80">
            Withdraws all remaining USDC from the contract immediately. Use only in an emergency. This action is irreversible.
          </p>
        </div>
        <button
          onClick={handleEmergencyWithdraw}
          disabled={!!actionLoading.emergency}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
        >
          {actionLoading.emergency ? <Spinner size={14} className="animate-spin" /> : <Warning size={14} weight="fill" />}
          Emergency Withdraw
        </button>
      </div>

      {/* Confirmation modal */}
      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          confirmClass={confirm.confirmClass}
          isDestructive={confirm.isDestructive}
          onConfirm={confirm.action}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
