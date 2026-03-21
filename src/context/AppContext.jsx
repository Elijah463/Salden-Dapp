/**
 * AppContext.jsx
 * Global application state and data-sync logic.
 *
 * SIGNER ARCHITECTURE:
 * This context stores a signerGetterRef — a mutable ref holding an async
 * function that returns an ethers v6 Signer. App.jsx sets this ref via
 * setSignerGetter() immediately after the wallet connects (using the
 * useEthersSigner hook). All contract write operations inside this context
 * (registry creation, CID writes) call signerGetterRef.current() to obtain
 * a fresh signer on demand. This avoids any dependency on window.ethereum
 * and works correctly for all thirdweb-supported wallet types.
 */

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useRef,
} from "react";
import { ethers } from "ethers";
import {
  getPayrollData,
  savePayrollData,
  setMeta,
  getMeta,
} from "../utils/indexeddb.js";
import {
  deriveKeyFromSignature,
  encryptData,
  decryptData,
  getSigningMessage,
} from "../utils/encryption.js";
import { uploadToIPFS, fetchFromIPFS } from "../utils/ipfs.js";
import {
  getUserRegistry,
  createUserRegistry,
  readCIDFromRegistry,
  writeCIDToRegistry,
} from "../utils/contracts.js";
import {
  checkPinataUploadLimit,
  checkRegistryWriteLimit,
} from "../utils/rateLimiter.js";

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState = {
  account: null,
  isWalletConnected: false,
  encryptionKey: null,
  hasSignedMessage: false,
  hasPayrollClone: false,
  cloneAddresses: [],
  activeCloneAddress: null,
  registryAddress: null,
  payrollSetup: null,
  employees: [],
  amlResults: null,
  amlLastChecked: null,
  isSyncing: false,
  syncError: null,
  lastSyncedAt: null,
  toasts: [],
  isMobileWarningDismissed: false,
};

// ─── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state, action) {
  switch (action.type) {
    case "SET_ACCOUNT":
      return { ...state, account: action.payload, isWalletConnected: !!action.payload };
    case "SET_ENCRYPTION_KEY":
      return { ...state, encryptionKey: action.payload, hasSignedMessage: true };
    case "SET_CLONE_ADDRESSES":
      return {
        ...state,
        cloneAddresses: action.payload,
        hasPayrollClone: action.payload.length > 0,
        activeCloneAddress: action.payload[action.payload.length - 1] || null,
      };
    case "SET_ACTIVE_CLONE":
      return { ...state, activeCloneAddress: action.payload };
    case "SET_REGISTRY":
      return { ...state, registryAddress: action.payload };
    case "SET_PAYROLL_DATA":
      return {
        ...state,
        payrollSetup: action.payload.setup ?? state.payrollSetup,
        employees: action.payload.employees ?? state.employees,
        amlResults: action.payload.amlResults ?? state.amlResults,
        amlLastChecked: action.payload.amlLastChecked ?? state.amlLastChecked,
      };
    case "SET_EMPLOYEES":
      return { ...state, employees: action.payload };
    case "SET_AML_RESULTS":
      return {
        ...state,
        amlResults: action.payload.results,
        amlLastChecked: action.payload.checkedAt,
      };
    case "SET_SYNCING":
      return { ...state, isSyncing: action.payload };
    case "SET_SYNC_ERROR":
      return { ...state, syncError: action.payload };
    case "SET_LAST_SYNCED":
      return { ...state, lastSyncedAt: action.payload };
    case "ADD_TOAST":
      return { ...state, toasts: [...state.toasts, action.payload] };
    case "REMOVE_TOAST":
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.payload) };
    case "DISMISS_MOBILE_WARNING":
      return { ...state, isMobileWarningDismissed: true };
    case "RESET":
      return { ...initialState };
    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Refs — hold current values without triggering re-renders
  const signerGetterRef = useRef(null);   // async () => ethers.Signer
  const syncInProgress = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;              // always reflects latest state in callbacks

  // ── Wire up the signer getter from the wallet layer ────────────────────────

  /**
   * Called by App.jsx after wallet connects.
   * Stores an async function that resolves to an ethers v6 Signer.
   * @param {Function} fn - async () => ethers.Signer
   */
  const setSignerGetter = useCallback((fn) => {
    signerGetterRef.current = fn;
  }, []);

  // ── Toast helpers ──────────────────────────────────────────────────────────

  const addToast = useCallback((message, type = "info", duration = 4000) => {
    const id = Date.now() + Math.random();
    dispatch({ type: "ADD_TOAST", payload: { id, message, type, duration } });
    setTimeout(() => dispatch({ type: "REMOVE_TOAST", payload: id }), duration);
  }, []);

  const removeToast = useCallback((id) => {
    dispatch({ type: "REMOVE_TOAST", payload: id });
  }, []);

  // ── Encryption key derivation ──────────────────────────────────────────────

  /**
   * Derives an AES-256-GCM encryption key from a wallet signature.
   * The signMessage function is provided by the caller (App.jsx) via the
   * useEthersSigner hook — it works for all wallet types without window.ethereum.
   *
   * @param {string} address - Connected wallet address
   * @param {Function} signMessageFn - async (message: string) => hex signature
   * @returns {Promise<CryptoKey>}
   */
  const deriveEncryptionKey = useCallback(async (address, signMessageFn) => {
    if (!address) throw new Error("No wallet address provided.");
    if (typeof signMessageFn !== "function") {
      throw new Error("signMessageFn must be a function.");
    }

    const message = getSigningMessage(address);
    const signature = await signMessageFn(message);
    const key = await deriveKeyFromSignature(signature, address);
    dispatch({ type: "SET_ENCRYPTION_KEY", payload: key });
    return key;
  }, []);

  // ── Data payload builder ───────────────────────────────────────────────────

  const buildPayload = useCallback((overrides = {}) => {
    const s = stateRef.current;
    return {
      setup: overrides.setup ?? s.payrollSetup,
      employees: overrides.employees ?? s.employees,
      amlResults: overrides.amlResults ?? s.amlResults,
      amlLastChecked: overrides.amlLastChecked ?? s.amlLastChecked,
      updatedAt: new Date().toISOString(),
    };
  }, []);

  // ── syncData — encrypt, upload to IPFS, write CID to registry ─────────────

  /**
   * Persists payroll data to both local IndexedDB and remote IPFS.
   * Writes the new IPFS CID to the user's personal registry contract.
   *
   * @param {object} overrides - Partial state overrides to merge before saving
   * @returns {Promise<string>} The new IPFS CID
   */
  const syncData = useCallback(async (overrides = {}) => {
    if (syncInProgress.current) return;

    const { account, encryptionKey, registryAddress } = stateRef.current;
    if (!account || !encryptionKey) {
      throw new Error("Wallet not connected or encryption key unavailable.");
    }
    if (!signerGetterRef.current) {
      throw new Error("Signer not available. Please reconnect your wallet.");
    }

    const uploadLimit = checkPinataUploadLimit();
    if (!uploadLimit.allowed) {
      throw new Error("Upload rate limit reached. Please wait before syncing again.");
    }
    const registryLimit = checkRegistryWriteLimit();
    if (!registryLimit.allowed) {
      throw new Error("Registry write rate limit reached. Please wait.");
    }

    syncInProgress.current = true;
    dispatch({ type: "SET_SYNCING", payload: true });
    dispatch({ type: "SET_SYNC_ERROR", payload: null });

    try {
      const payload = buildPayload(overrides);

      // 1. Save locally first — this always works even if IPFS/chain fails
      await savePayrollData(account, payload);

      // 2. Encrypt and upload to IPFS
      let encryptedBlob, cid;
      try {
        encryptedBlob = await encryptData(encryptionKey, payload);
        cid = await uploadToIPFS(encryptedBlob, account);
      } catch (ipfsErr) {
        throw new Error("IPFS upload failed: " + ipfsErr.message);
      }

      // 3. Obtain signer for on-chain registry write.
      // Use window.ethereum BrowserProvider directly when available — this is
      // the most reliable path for MetaMask and injected wallets and always
      // supports sendTransaction. Falls back to signerGetterRef for non-injected
      // wallets (WalletConnect, etc.).
      let signer;
      if (typeof window !== "undefined" && window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();
      } else {
        if (!signerGetterRef.current) {
          throw new Error("Signer not available. Please reconnect your wallet.");
        }
        signer = await signerGetterRef.current();
      }

      // 4. Ensure registry exists — always do a fresh lookup to avoid stale state
      let regAddr = stateRef.current.registryAddress;
      if (!regAddr) {
        regAddr = await getUserRegistry(account);
        if (regAddr) dispatch({ type: "SET_REGISTRY", payload: regAddr });
      }
      if (!regAddr) {
        try {
          regAddr = await createUserRegistry(signer, account);
          dispatch({ type: "SET_REGISTRY", payload: regAddr });
        } catch (regErr) {
          throw new Error("Registry creation failed: " + regErr.message);
        }
      }

      // 5. Write new CID to registry
      try {
        await writeCIDToRegistry(signer, regAddr, cid);
        // Cache the CID locally so loadData can skip IPFS fetch if unchanged
        await setMeta(`lastCid_${account.toLowerCase()}`, cid);
      } catch (cidErr) {
        throw new Error("Registry update failed — please approve the transaction in your wallet: " + cidErr.message);
      }

      // 6. Update in-memory state from overrides.
      // A single SET_PAYROLL_DATA dispatch is sufficient — it handles
      // employees, setup, amlResults, and amlLastChecked in one pass.
      // A prior version also dispatched SET_EMPLOYEES separately, causing
      // two renders for one logical update.
      if (
        overrides.setup !== undefined ||
        overrides.employees !== undefined ||
        overrides.amlResults !== undefined
      ) {
        dispatch({ type: "SET_PAYROLL_DATA", payload: payload });
      }

      dispatch({ type: "SET_LAST_SYNCED", payload: new Date().toISOString() });
      return cid;
    } catch (err) {
      dispatch({ type: "SET_SYNC_ERROR", payload: err.message });
      throw err;
    } finally {
      syncInProgress.current = false;
      dispatch({ type: "SET_SYNCING", payload: false });
    }
  }, [buildPayload]);

  // ── loadData — read CID from registry, fetch from IPFS, decrypt ───────────

  /**
   * Loads payroll data. Serves the local IndexedDB cache immediately for
   * fast perceived load, then fetches the latest version from IPFS and
   * syncs if a newer CID is found in the registry.
   *
   * @param {string} address - Employer wallet address
   * @param {CryptoKey} cryptoKey - AES-256-GCM decryption key
   */
  const loadData = useCallback(async (address, cryptoKey) => {
    if (!address || !cryptoKey) return;

    dispatch({ type: "SET_SYNCING", payload: true });

    try {
      // 1. Seed from local cache immediately (fast, offline-capable)
      const cached = await getPayrollData(address);
      if (cached) {
        dispatch({ type: "SET_PAYROLL_DATA", payload: cached });
      }

      // 2. Resolve registry address
      let regAddr = stateRef.current.registryAddress;
      if (!regAddr) {
        regAddr = await getUserRegistry(address);
        if (regAddr) dispatch({ type: "SET_REGISTRY", payload: regAddr });
      }

      if (!regAddr) return; // First-time user — no remote data yet

      // 3. Fetch latest CID from registry
      const cid = await readCIDFromRegistry(regAddr);
      if (!cid) return;

      // 4. Skip IPFS fetch if CID matches what we already have cached
      const cachedCid = await getMeta(`lastCid_${address.toLowerCase()}`);
      if (cachedCid === cid && cached) return;

      // 5. Fetch and decrypt from IPFS
      const encryptedBlob = await fetchFromIPFS(cid);
      const decrypted = await decryptData(cryptoKey, encryptedBlob);

      // 6. Update local cache and in-memory state
      await savePayrollData(address, decrypted);
      await setMeta(`lastCid_${address.toLowerCase()}`, cid);
      dispatch({ type: "SET_PAYROLL_DATA", payload: decrypted });
      dispatch({ type: "SET_LAST_SYNCED", payload: new Date().toISOString() });
    } catch (err) {
      console.error("[loadData] Failed:", err.message);
      dispatch({ type: "SET_SYNC_ERROR", payload: err.message });
    } finally {
      dispatch({ type: "SET_SYNCING", payload: false });
    }
  }, []);

  // ── Disconnect ─────────────────────────────────────────────────────────────

  const disconnectWallet = useCallback(() => {
    signerGetterRef.current = null;
    dispatch({ type: "RESET" });
  }, []);

  // ── Context value ──────────────────────────────────────────────────────────

  const value = {
    state,
    dispatch,
    addToast,
    removeToast,
    deriveEncryptionKey,
    setSignerGetter,
    syncData,
    loadData,
    disconnectWallet,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within <AppProvider>.");
  return ctx;
}
