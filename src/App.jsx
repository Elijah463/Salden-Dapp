/**
 * App.jsx
 * Root application component.
 *
 * ONBOARDING FLOW:
 *   1. Wallet connects → useEthersSigner wires the signer getter into AppContext
 *   2. initialize() fires → derives encryption key → shows OnboardingModal
 *   3. OnboardingModal checks for existing clone on-chain
 *      a. Found     → user clicks "Proceed to Dashboard" → loadData → navigate
 *      b. Not found → user deploys → success screen → "Proceed to Dashboard" → navigate
 *   4. Dashboard shows. If no employee data: "Configure Payroll Data" button available.
 *
 * KEY FIX: setSignerGetter(getSigner) — not setSignerGetter(() => getSigner).
 * Storing the wrapper function caused signerGetterRef.current() to return the
 * getSigner function itself rather than calling it, resulting in UNSUPPORTED_OPERATION
 * errors on every contract write.
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useActiveAccount, useActiveWallet } from "thirdweb/react";
import { useApp } from "./context/AppContext.jsx";
import { useEthersSigner } from "./hooks/useEthersSigner.js";
import Layout from "./components/Layout.jsx";
import ToastContainer from "./components/Toast.jsx";
import OnboardingModal from "./components/OnboardingModal.jsx";
import Landing from "./pages/Landing.jsx";
import HRDashboard from "./pages/HRDashboard.jsx";
import Attendance from "./pages/Attendance.jsx";
import Compliance from "./pages/Compliance.jsx";
import Settings from "./pages/Settings.jsx";

function RequireWallet({ children }) {
  const account = useActiveAccount();
  const location = useLocation();
  if (!account) return <Navigate to="/" state={{ from: location }} replace />;
  return children;
}

export default function App() {
  const account = useActiveAccount();
  const wallet  = useActiveWallet();
  const navigate = useNavigate();

  const {
    state,
    dispatch,
    addToast,
    deriveEncryptionKey,
    setSignerGetter,
    loadData,
  } = useApp();

  const { getSigner, signMessage } = useEthersSigner();

  const [showOnboarding, setShowOnboarding] = useState(false);

  // Store the derived CryptoKey in a ref so the proceed callback can access it
  // without being listed as an effect dependency (it never changes the flow).
  const cryptoKeyRef = useRef(null);

  // ── Wire the signer getter into AppContext ─────────────────────────────────
  // getSigner is stable (useCallback) so this only fires on real connect/disconnect.
  // IMPORTANT: pass getSigner directly, not () => getSigner.
  // Wrapping it causes signerGetterRef.current() to return the function instead
  // of calling it, so every contract write throws UNSUPPORTED_OPERATION.
  useEffect(() => {
    if (wallet) {
      setSignerGetter(getSigner);
    } else {
      setSignerGetter(null);
    }
  }, [wallet, getSigner, setSignerGetter]);

  // ── On wallet connect: sign → derive key → show onboarding ─────────────────
  useEffect(() => {
    if (!account || state.hasSignedMessage) return;
    let cancelled = false;

    const initialize = async () => {
      try {
        dispatch({ type: "SET_ACCOUNT", payload: account.address });
        const cryptoKey = await deriveEncryptionKey(account.address, signMessage);
        if (cancelled) return;
        cryptoKeyRef.current = cryptoKey;
        setShowOnboarding(true);
      } catch (err) {
        if (!cancelled) {
          addToast("Wallet initialization failed: " + err.message, "error");
        }
      }
    };

    initialize();
    return () => { cancelled = true; };
  }, [
    account?.address,
    state.hasSignedMessage,
    dispatch,
    addToast,
    deriveEncryptionKey,
    signMessage,
  ]);

  // ── Proceed to dashboard ────────────────────────────────────────────────────
  // Called by OnboardingModal when the user clicks "Proceed to Dashboard".
  // Loads IPFS data if a clone exists, then navigates.
  const handleProceedToDashboard = useCallback(async (clones) => {
    setShowOnboarding(false);
    try {
      if (clones.length > 0 && cryptoKeyRef.current && account) {
        await loadData(account.address, cryptoKeyRef.current);
      }
    } catch {
      // loadData failure is non-fatal — user lands on dashboard with empty state
    }
    navigate("/dashboard", { replace: true });
  }, [account, loadData, navigate]);

  // ── On wallet disconnect: reset and return to landing ──────────────────────
  useEffect(() => {
    if (!wallet) {
      dispatch({ type: "RESET" });
      setShowOnboarding(false);
      cryptoKeyRef.current = null;
      navigate("/", { replace: true });
    }
  }, [wallet, dispatch, navigate]);

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            <Landing
              onConnected={() => {
                // Already fully initialised — go straight to dashboard
                if (state.hasPayrollClone && state.hasSignedMessage) {
                  navigate("/dashboard");
                  return;
                }
                // Signed but no clone yet — show onboarding
                if (state.hasSignedMessage && !state.hasPayrollClone) {
                  setShowOnboarding(true);
                  return;
                }
                // Not yet signed — the initialize() effect will fire automatically
                // after the wallet connects and show onboarding. Nothing to do here.
              }}
            />
          }
        />
        <Route path="/dashboard"   element={<RequireWallet><Layout><HRDashboard /></Layout></RequireWallet>} />
        <Route path="/attendance"  element={<RequireWallet><Layout><Attendance  /></Layout></RequireWallet>} />
        <Route path="/compliance"  element={<RequireWallet><Layout><Compliance  /></Layout></RequireWallet>} />
        <Route path="/settings"    element={<RequireWallet><Layout><Settings    /></Layout></RequireWallet>} />
        <Route path="*"            element={<Navigate to="/" replace />} />
      </Routes>

      {/* Onboarding modal — shown after sign, before dashboard */}
      {showOnboarding && account && (
        <OnboardingModal
          employerAddress={account.address}
          getSigner={getSigner}
          onProceedToDashboard={handleProceedToDashboard}
        />
      )}

      <ToastContainer />
    </>
  );
}
