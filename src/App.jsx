/**
 * App.jsx
 * Root application component.
 * Wires the thirdweb v5 wallet layer to AppContext via the useEthersSigner hook,
 * manages routing, and drives the onboarding flow.
 */

import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useActiveAccount, useActiveWallet } from "thirdweb/react";
import { useApp } from "./context/AppContext.jsx";
import { useEthersSigner } from "./hooks/useEthersSigner.js";
import { getUserPayrolls } from "./utils/contracts.js";
import Layout from "./components/Layout.jsx";
import ToastContainer from "./components/Toast.jsx";
import SetupModal from "./components/SetupModal.jsx";
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
  const wallet = useActiveWallet();
  const navigate = useNavigate();
  const { state, dispatch, addToast, deriveEncryptionKey, setSignerGetter, loadData } = useApp();
  const { getSigner, signMessage } = useEthersSigner();

  const [showSetupModal, setShowSetupModal] = useState(false);

  // Wire the signer getter into AppContext whenever the wallet changes.
  // getSigner is stable (useCallback on wallet) so this only fires on real
  // wallet connect/disconnect events, not spurious re-renders.
  useEffect(() => {
    if (wallet) {
      setSignerGetter(() => getSigner);
    } else {
      setSignerGetter(null);
    }
  }, [wallet, getSigner, setSignerGetter]);

  // On wallet connect: sign → derive key → check for clone → load data.
  //
  // Dep array rationale:
  //   account?.address  — primary trigger: fires only when wallet address changes
  //   state.hasSignedMessage — prevents re-init if component re-renders while
  //                            already initialised (guard inside is idempotent)
  //   All other deps (dispatch, navigate, addToast, deriveEncryptionKey,
  //   signMessage, loadData, setShowSetupModal) are stable: they come from
  //   useReducer, react-router, or useCallback with stable inner deps.
  //   Adding them satisfies exhaustive-deps without changing behaviour.
  useEffect(() => {
    if (!account || state.hasSignedMessage) return;
    let cancelled = false;

    const initialize = async () => {
      try {
        dispatch({ type: "SET_ACCOUNT", payload: account.address });

        const cryptoKey = await deriveEncryptionKey(account.address, signMessage);
        if (cancelled) return;

        const clones = await getUserPayrolls(account.address);
        if (cancelled) return;

        dispatch({ type: "SET_CLONE_ADDRESSES", payload: clones });

        if (clones.length > 0) {
          await loadData(account.address, cryptoKey);
          navigate("/dashboard", { replace: true });
        } else {
          setShowSetupModal(true);
        }
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
    navigate,
    addToast,
    deriveEncryptionKey,
    signMessage,
    loadData,
  ]);

  // On wallet disconnect: reset all state and return to landing.
  //
  // Dep array rationale:
  //   wallet    — primary trigger: fires only when wallet connects/disconnects
  //   dispatch  — stable ref from useReducer
  //   navigate  — stable ref from react-router
  //   state.isWalletConnected was previously read here as a guard, but RESET
  //   is fully idempotent (resetting already-reset state is a no-op), so the
  //   guard is unnecessary and removed. This lets us keep a complete dep array.
  useEffect(() => {
    if (!wallet) {
      dispatch({ type: "RESET" });
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
                if (state.hasPayrollClone) navigate("/dashboard");
                else if (account) setShowSetupModal(true);
              }}
            />
          }
        />
        <Route path="/dashboard" element={<RequireWallet><Layout><HRDashboard /></Layout></RequireWallet>} />
        <Route path="/attendance" element={<RequireWallet><Layout><Attendance /></Layout></RequireWallet>} />
        <Route path="/compliance" element={<RequireWallet><Layout><Compliance /></Layout></RequireWallet>} />
        <Route path="/settings" element={<RequireWallet><Layout><Settings /></Layout></RequireWallet>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <SetupModal
        isOpen={showSetupModal}
        onClose={() => setShowSetupModal(false)}
        onDeployed={() => {
          setShowSetupModal(false);
          navigate("/dashboard", { replace: true });
        }}
      />

      <ToastContainer />
    </>
  );
}
