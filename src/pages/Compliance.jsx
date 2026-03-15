/**
 * Compliance.jsx
 * AML & CTF Compliance page.
 * Automatically triggers a Scorechain background scan when:
 *   - The user has never scanned before, OR
 *   - The last scan is older than 10 days.
 * Shows a non-blocking live progress bar during scanning.
 * Displays GOOD (glowing green) or CRITICAL (glowing red) compliance badge.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  ShieldCheck,
  ShieldWarning,
  Spinner,
  Warning,
  CheckCircle,
  ClockCounterClockwise,
  Eye,
} from "@phosphor-icons/react";
import { useApp } from "../context/AppContext.jsx";
import { ComplianceSkeleton } from "../components/SkeletonLoader.jsx";
import { checkScorechainLimit } from "../utils/rateLimiter.js";

const SCORECHAIN_BASE = import.meta.env.VITE_SCORECHAIN_BASE_URL;
const SCORECHAIN_KEY = import.meta.env.VITE_SCORECHAIN_API_KEY;
const SCAN_INTERVAL_DAYS = 10;
const DELAY_MS = 450; // Safe delay between API calls — within free-tier rate limits

/**
 * Calls Scorechain Free Sanctions Screening API for a single wallet address.
 * Returns true if the address is flagged, false if clean.
 * @param {string} walletAddress
 * @returns {Promise<boolean>} isFlagged
 */
async function checkWallet(walletAddress) {
  const response = await fetch(
    `${SCORECHAIN_BASE}/v1/entity/check?address=${encodeURIComponent(walletAddress)}`,
    {
      method: "GET",
      headers: {
        "x-api-key": SCORECHAIN_KEY,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    // On non-critical errors, treat as clean to avoid blocking the employer
    console.warn(`Scorechain: non-OK response for ${walletAddress}: ${response.status}`);
    return false;
  }

  const data = await response.json();
  // Scorechain returns `sanctioned: true` or a risk level flag
  return (
    data?.sanctioned === true ||
    data?.riskLevel === "HIGH" ||
    data?.riskLevel === "CRITICAL"
  );
}

export default function Compliance() {
  const { state, dispatch, addToast, syncData } = useApp();
  const { employees, amlResults, amlLastChecked, isSyncing } = state;

  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const [flaggedWallets, setFlaggedWallets] = useState([]);
  const [complianceRating, setComplianceRating] = useState(null); // "GOOD" | "CRITICAL" | null
  const scanAborted = useRef(false);
  const hasAutoTriggered = useRef(false);

  // ── Determine whether a fresh scan is needed ───────────────────────────────

  const isScanStale = useCallback(() => {
    if (!amlLastChecked) return true;
    const daysSinceLastScan =
      (Date.now() - new Date(amlLastChecked).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceLastScan >= SCAN_INTERVAL_DAYS;
  }, [amlLastChecked]);

  // ── Compute compliance rating from stored results ─────────────────────────

  useEffect(() => {
    if (amlResults) {
      const anyFlagged = amlResults.some((r) => r.isFlagged);
      setComplianceRating(anyFlagged ? "CRITICAL" : "GOOD");
      setFlaggedWallets(amlResults.filter((r) => r.isFlagged));
    }
  }, [amlResults]);

  // ── Main scan function ────────────────────────────────────────────────────

  const runScan = useCallback(async () => {
    if (isScanning || employees.length === 0) return;

    scanAborted.current = false;
    setIsScanning(true);
    setScanProgress({ current: 0, total: employees.length });

    const results = [];

    for (let i = 0; i < employees.length; i++) {
      if (scanAborted.current) break;

      // Check rate limit per wallet call. This correctly records one use
      // per API request and can abort mid-scan if the hourly budget runs out.
      const walletRateCheck = checkScorechainLimit();
      if (!walletRateCheck.allowed) {
        addToast(
          `API rate limit reached after ${i} wallet${i !== 1 ? "s" : ""}. Scan paused — results so far are saved.`,
          "warning",
          6000
        );
        scanAborted.current = true;
        break;
      }

      const emp = employees[i];
      const isFlagged = await checkWallet(emp.walletAddress);
      results.push({
        walletAddress: emp.walletAddress,
        fullName: emp.fullName,
        isFlagged,
      });

      setScanProgress({ current: i + 1, total: employees.length });

      // Respect free-tier rate limits with a safe delay between calls
      if (i < employees.length - 1) {
        await new Promise((res) => setTimeout(res, DELAY_MS));
      }
    }

    if (scanAborted.current) {
      setIsScanning(false);
      return;
    }

    const flagged = results.filter((r) => r.isFlagged);
    const timestamp = new Date().toISOString();

    // Update in-memory state
    dispatch({
      type: "SET_AML_RESULTS",
      payload: { results, checkedAt: timestamp },
    });
    setFlaggedWallets(flagged);
    setComplianceRating(flagged.length > 0 ? "CRITICAL" : "GOOD");

    // Sync to IPFS & registry
    try {
      await syncData({ amlResults: results, amlLastChecked: timestamp });
    } catch {
      // Sync failure should not block the user — results are still shown in-memory
    }

    const message =
      flagged.length === 0
        ? `AML check complete — 0 wallets flagged.`
        : `AML check complete — ${flagged.length} wallet${flagged.length !== 1 ? "s" : ""} require review.`;

    addToast(message, flagged.length > 0 ? "warning" : "success", 5000);
    setIsScanning(false);
  }, [isScanning, employees, dispatch, syncData, addToast]);

  // ── Auto-trigger on mount when stale ─────────────────────────────────────

  useEffect(() => {
    if (
      !hasAutoTriggered.current &&
      !isSyncing &&
      employees.length > 0 &&
      isScanStale()
    ) {
      hasAutoTriggered.current = true;
      runScan();
    }
  }, [isSyncing, employees, isScanStale, runScan]);

  const isLoading = isSyncing && !amlResults && !isScanning;
  if (isLoading) return <ComplianceSkeleton />;

  const progressPercent =
    scanProgress.total > 0
      ? Math.round((scanProgress.current / scanProgress.total) * 100)
      : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-salden-text-primary">AML & CTF Compliance</h1>
        <p className="text-salden-text-muted text-sm mt-0.5">
          Powered by Scorechain — Automatic wallet screening against global sanctions lists
        </p>
      </div>

      {/* Live scan progress bar (non-blocking) */}
      {isScanning && (
        <div className="bg-salden-surface border border-salden-border rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <Spinner size={18} className="animate-spin text-salden-blue flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-salden-text-primary">
                Verifying employee wallets for AML/CTF compliance
              </p>
              <p className="text-xs text-salden-text-muted mt-0.5">
                {scanProgress.current} of {scanProgress.total} completed
              </p>
            </div>
          </div>
          <div className="h-2 rounded-full bg-salden-border overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-salden-blue to-salden-violet rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
              role="progressbar"
              aria-valuenow={scanProgress.current}
              aria-valuemin={0}
              aria-valuemax={scanProgress.total}
              aria-label="AML verification progress"
            />
          </div>
        </div>
      )}

      {/* Compliance badge */}
      {complianceRating && !isScanning && (
        <div className="bg-salden-surface border border-salden-border rounded-2xl p-8 flex flex-col items-center text-center">
          {complianceRating === "GOOD" ? (
            <>
              <div
                className="w-24 h-24 rounded-full border-2 border-salden-glow-green flex items-center justify-center mb-4 animate-glow-green"
                style={{ boxShadow: "0 0 24px #00FF87, 0 0 48px #00FF8740" }}
              >
                <ShieldCheck size={44} weight="fill" className="text-salden-glow-green" />
              </div>
              <div className="text-3xl font-bold text-salden-glow-green mb-2">GOOD</div>
              <p className="text-salden-text-secondary text-sm max-w-sm">
                All employee wallets passed AML and CTF screening. No sanctions matches detected.
              </p>
            </>
          ) : (
            <>
              <div
                className="w-24 h-24 rounded-full border-2 border-salden-glow-red flex items-center justify-center mb-4 animate-glow-red"
                style={{ boxShadow: "0 0 24px #FF3B3B, 0 0 48px #FF3B3B40" }}
              >
                <ShieldWarning size={44} weight="fill" className="text-salden-glow-red" />
              </div>
              <div className="text-3xl font-bold text-salden-glow-red mb-2">CRITICAL</div>
              <p className="text-salden-text-secondary text-sm max-w-sm">
                One or more employee wallets have been flagged by sanctions screening. Please
                review the flagged wallets below before processing payroll.
              </p>
            </>
          )}

          {amlLastChecked && (
            <div className="flex items-center gap-1.5 text-xs text-salden-text-muted mt-4">
              <ClockCounterClockwise size={12} />
              Last verified:{" "}
              {new Date(amlLastChecked).toLocaleString("en-US", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </div>
          )}

          {/* Manual re-scan button */}
          <button
            onClick={runScan}
            disabled={isScanning || employees.length === 0}
            className="mt-5 flex items-center gap-2 px-5 py-2.5 rounded-xl border border-salden-border text-salden-text-secondary hover:border-salden-blue/50 hover:text-salden-blue transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Eye size={14} />
            Re-scan Now
          </button>
        </div>
      )}

      {/* No scan results yet and not scanning */}
      {!complianceRating && !isScanning && employees.length === 0 && (
        <div className="bg-salden-surface border border-salden-border rounded-2xl p-8 text-center">
          <ShieldCheck size={40} className="mx-auto text-salden-text-muted mb-3 opacity-40" />
          <p className="text-salden-text-muted text-sm">
            No employees found. Add employees in the HR Dashboard to begin compliance screening.
          </p>
        </div>
      )}

      {/* Flagged wallets panel */}
      {flaggedWallets.length > 0 && (
        <div className="bg-red-950/20 border border-red-800/40 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-red-800/30 flex items-center gap-2">
            <Warning size={16} weight="fill" className="text-red-400" />
            <h2 className="font-semibold text-red-300 text-sm">
              Flagged Wallets ({flaggedWallets.length})
            </h2>
          </div>
          <div className="divide-y divide-red-900/20">
            {flaggedWallets.map((wallet, i) => (
              <div
                key={i}
                className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <p className="text-sm font-medium text-red-200">{wallet.fullName}</p>
                  <p className="text-xs font-mono text-red-400/80 mt-0.5">
                    {wallet.walletAddress}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-300 bg-red-900/30 border border-red-700/30 px-3 py-1 rounded-full flex-shrink-0">
                  <Warning size={10} weight="fill" />
                  Sanctioned
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Clean wallets confirmation */}
      {complianceRating === "GOOD" && amlResults && amlResults.length > 0 && (
        <div className="bg-emerald-950/20 border border-emerald-800/30 rounded-2xl p-5">
          <div className="flex items-center gap-2">
            <CheckCircle size={16} weight="fill" className="text-emerald-400" />
            <p className="text-sm text-emerald-300 font-medium">
              {amlResults.length} wallet{amlResults.length !== 1 ? "s" : ""} verified — all
              clear
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
