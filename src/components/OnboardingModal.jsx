/**
 * OnboardingModal.jsx
 *
 * Post-wallet-connect onboarding flow. Renders immediately after the user
 * signs the encryption message. Handles two paths:
 *
 *   1. Existing clone found  → "Contract verified" → Proceed to Dashboard
 *   2. No clone found        → Deploy button → deploying → success → Proceed
 *
 * This modal is NOT dismissible — the user must complete the flow.
 * All contract interactions use the employer address explicitly (no signer.getAddress).
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Spinner,
  CheckCircle,
  Rocket,
  Warning,
  ArrowRight,
} from "@phosphor-icons/react";
import { useApp } from "../context/AppContext.jsx";
import {
  getUserPayrolls,
  getOrDeployPayrollClone,
} from "../utils/contracts.js";

// States the modal can be in
const STATE = {
  CHECKING:  "checking",   // fetching getUserPayrolls
  FOUND:     "found",      // clone exists
  NOT_FOUND: "not_found",  // no clone
  DEPLOYING: "deploying",  // deploying contract
  SUCCESS:   "success",    // deploy complete
  ERROR:     "error",      // unrecoverable error
};

/**
 * @param {object}   props
 * @param {string}   props.employerAddress        - Connected wallet address
 * @param {Function} props.getSigner              - async () => ethers.Signer
 * @param {Function} props.onProceedToDashboard   - async (clones: string[]) => void
 */
export default function OnboardingModal({
  employerAddress,
  getSigner,
  onProceedToDashboard,
}) {
  const { dispatch, addToast } = useApp();

  const [phase, setPhase]             = useState(STATE.CHECKING);
  const [deployStatus, setDeployStatus] = useState("");
  const [errorMsg, setErrorMsg]       = useState("");
  const [clones, setClones]           = useState([]);
  const hasChecked                    = useRef(false);

  // ── Check for existing clone on mount ──────────────────────────────────────

  const checkForClone = useCallback(async () => {
    try {
      const existing = await getUserPayrolls(employerAddress);
      if (existing.length > 0) {
        dispatch({ type: "SET_CLONE_ADDRESSES", payload: existing });
        setClones(existing);
        setPhase(STATE.FOUND);
      } else {
        setPhase(STATE.NOT_FOUND);
      }
    } catch (err) {
      setErrorMsg("Failed to check on-chain status: " + err.message);
      setPhase(STATE.ERROR);
    }
  }, [employerAddress, dispatch]);

  useEffect(() => {
    if (hasChecked.current) return;
    hasChecked.current = true;
    checkForClone();
  }, [checkForClone]);

  // ── Deploy handler ──────────────────────────────────────────────────────────

  const handleDeploy = useCallback(async () => {
    setPhase(STATE.DEPLOYING);
    setDeployStatus("Preparing deployment…");
    try {
      const signer = await getSigner();
      const cloneAddress = await getOrDeployPayrollClone(
        signer,
        employerAddress,
        (msg) => setDeployStatus(msg)
      );
      const updated = await getUserPayrolls(employerAddress);
      dispatch({ type: "SET_CLONE_ADDRESSES", payload: updated });
      dispatch({ type: "SET_ACTIVE_CLONE",    payload: cloneAddress });
      setClones(updated);
      setPhase(STATE.SUCCESS);
      addToast("Payroll contract deployed successfully!", "success", 5000);
    } catch (err) {
      setErrorMsg(err.message || "Deployment failed. Please try again.");
      setPhase(STATE.ERROR);
    }
  }, [getSigner, employerAddress, dispatch, addToast]);

  // ── Proceed handler ─────────────────────────────────────────────────────────

  const handleProceed = useCallback(() => {
    onProceedToDashboard(clones);
  }, [onProceedToDashboard, clones]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-[8500] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Payroll onboarding"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

      {/* Card */}
      <div className="relative bg-salden-surface border border-salden-border rounded-2xl w-full max-w-sm shadow-2xl px-8 py-10 flex flex-col items-center text-center">

        {/* ── CHECKING ─────────────────────────────────────────────────────── */}
        {phase === STATE.CHECKING && (
          <>
            <div className="w-16 h-16 rounded-full bg-salden-blue/10 border border-salden-blue/30 flex items-center justify-center mb-5">
              <Spinner size={28} className="animate-spin text-salden-blue" />
            </div>
            <h2 className="text-lg font-bold text-salden-text-primary mb-2">
              Verifying On-Chain Status
            </h2>
            <p className="text-sm text-salden-text-muted">
              Checking the blockchain for an existing payroll contract associated with your wallet…
            </p>
          </>
        )}

        {/* ── FOUND ────────────────────────────────────────────────────────── */}
        {phase === STATE.FOUND && (
          <>
            <div
              className="w-16 h-16 rounded-full border-2 border-salden-glow-green flex items-center justify-center mb-5"
              style={{ boxShadow: "0 0 20px #00FF8760" }}
            >
              <CheckCircle size={32} weight="fill" className="text-salden-glow-green" />
            </div>
            <h2 className="text-lg font-bold text-salden-text-primary mb-2">
              Payroll Contract Verified
            </h2>
            <p className="text-sm text-salden-text-muted mb-6">
              An existing payroll contract was found for this wallet. Your data will load automatically.
            </p>
            <button
              onClick={handleProceed}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-salden-blue to-salden-violet hover:opacity-90 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-900/30"
            >
              Proceed to Dashboard
              <ArrowRight size={16} />
            </button>
          </>
        )}

        {/* ── NOT FOUND ─────────────────────────────────────────────────────── */}
        {phase === STATE.NOT_FOUND && (
          <>
            <div className="w-16 h-16 rounded-full bg-salden-hover border border-salden-border flex items-center justify-center mb-5">
              <Rocket size={28} className="text-salden-blue" />
            </div>
            <h2 className="text-lg font-bold text-salden-text-primary mb-2">
              No Payroll Contract Detected
            </h2>
            <p className="text-sm text-salden-text-muted mb-6">
              This wallet does not yet have a payroll contract on Arc Network. Deploy one to get started — it takes under a minute.
            </p>
            <button
              onClick={handleDeploy}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-salden-blue to-salden-violet hover:opacity-90 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-900/30"
            >
              <Rocket size={16} />
              Deploy Payroll Contract
            </button>
          </>
        )}

        {/* ── DEPLOYING ─────────────────────────────────────────────────────── */}
        {phase === STATE.DEPLOYING && (
          <>
            <div className="w-16 h-16 rounded-full bg-salden-blue/10 border border-salden-blue/30 flex items-center justify-center mb-5">
              <Spinner size={28} className="animate-spin text-salden-blue" />
            </div>
            <h2 className="text-lg font-bold text-salden-text-primary mb-2">
              Deploying Your Payroll Contract
            </h2>
            <p className="text-sm text-salden-text-muted mb-4">
              Please confirm the transaction in your wallet and wait for on-chain confirmation.
            </p>
            {deployStatus && (
              <div className="w-full bg-salden-hover rounded-xl px-4 py-3 text-xs text-salden-text-muted flex items-center gap-2">
                <Spinner size={12} className="animate-spin text-salden-blue flex-shrink-0" />
                {deployStatus}
              </div>
            )}
          </>
        )}

        {/* ── SUCCESS ───────────────────────────────────────────────────────── */}
        {phase === STATE.SUCCESS && (
          <>
            <div
              className="w-16 h-16 rounded-full border-2 border-salden-glow-green flex items-center justify-center mb-5"
              style={{ boxShadow: "0 0 20px #00FF8760" }}
            >
              <CheckCircle size={32} weight="fill" className="text-salden-glow-green" />
            </div>
            <h2 className="text-xl font-bold text-salden-text-primary mb-1">
              🎉 Congratulations!
            </h2>
            <p className="text-salden-glow-green font-semibold text-sm mb-2">
              Payroll Contract Created Successfully
            </p>
            <p className="text-sm text-salden-text-muted mb-6">
              Your personal payroll contract is live on Arc Network. Head to the dashboard to configure your organisation and employees.
            </p>
            <button
              onClick={handleProceed}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-salden-blue to-salden-violet hover:opacity-90 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-900/30"
            >
              Proceed to Dashboard
              <ArrowRight size={16} />
            </button>
          </>
        )}

        {/* ── ERROR ─────────────────────────────────────────────────────────── */}
        {phase === STATE.ERROR && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-950/30 border border-red-800/50 flex items-center justify-center mb-5">
              <Warning size={28} weight="fill" className="text-red-400" />
            </div>
            <h2 className="text-lg font-bold text-salden-text-primary mb-2">
              Something Went Wrong
            </h2>
            <p className="text-sm text-red-400 mb-6 break-words">
              {errorMsg}
            </p>
            <button
              onClick={() => {
                setPhase(STATE.CHECKING);
                hasChecked.current = false;
                setErrorMsg("");
                checkForClone();
              }}
              className="w-full py-3 rounded-xl border border-salden-border text-salden-text-secondary hover:border-salden-blue/50 hover:text-salden-blue transition-all text-sm font-medium"
            >
              Try Again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
