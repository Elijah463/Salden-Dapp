/**
 * ConfigureModal.jsx
 *
 * Organisation & employee data setup. Opened from the HR Dashboard when the
 * user has a deployed payroll contract but no data configured yet, or whenever
 * they want to update their setup.
 *
 * This modal does NOT deploy any contract — it only:
 *   1. Collects org info and employee data
 *   2. Saves to IndexedDB (local cache)
 *   3. Encrypts and uploads to IPFS
 *   4. Writes the CID to the on-chain registry (creating it if needed)
 *
 * All contract writes happen inside syncData() in AppContext.
 */

import { useState, useRef, useCallback } from "react";
import {
  X,
  UserCircle,
  Buildings,
  UsersThree,
  UploadSimple,
  Plus,
  Trash,
  Spinner,
  Warning,
  FileText,
  CheckCircle,
} from "@phosphor-icons/react";
import Papa from "papaparse";
import { useApp } from "../context/AppContext.jsx";
import { useEthersSigner } from "../hooks/useEthersSigner.js";
import TermsModal from "./TermsModal.jsx";
import {
  validateEmployee,
  validateEmployeeFile,
  normalizeEmployeeRows,
  sanitizeString,
  findDuplicateWallets,
} from "../utils/validation.js";

const EMPLOYEE_COUNT_OPTIONS = [
  "2 – 500",
  "501 – 1,000",
  "1,001 – 5,000",
  "5,001 – 10,000",
];

const EMPTY_ROW = { fullName: "", department: "", walletAddress: "", salaryAmount: "" };

/**
 * @param {object}   props
 * @param {boolean}  props.isOpen
 * @param {Function} props.onClose
 * @param {Function} props.onComplete - Called after successful syncData
 */
export default function ConfigureModal({ isOpen, onClose, onComplete }) {
  const { state, addToast, syncData } = useApp();
  const { getSigner } = useEthersSigner();

  // Pre-fill from existing state if available
  const [fullName, setFullName]           = useState(state.payrollSetup?.fullName    ?? "");
  const [companyName, setCompanyName]     = useState(state.payrollSetup?.companyName ?? "");
  const [employeeCount, setEmployeeCount] = useState(state.payrollSetup?.employeeCount ?? "");

  const [uploadMode, setUploadMode]             = useState("upload");
  const [uploadedEmployees, setUploadedEmployees] = useState([]);
  const [manualRows, setManualRows]             = useState([{ ...EMPTY_ROW }]);
  const [fileError, setFileError]               = useState("");
  const [manualErrors, setManualErrors]         = useState({});

  const [showTerms, setShowTerms]   = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);

  const [isSaving, setIsSaving]   = useState(false);
  const [saveError, setSaveError] = useState("");

  const fileInputRef = useRef(null);

  const allEmployees = uploadMode === "upload"
    ? uploadedEmployees
    : manualRows.filter((r) => r.fullName && r.walletAddress && r.salaryAmount);

  const canFinish =
    fullName.trim().length >= 2 &&
    companyName.trim().length >= 2 &&
    employeeCount &&
    allEmployees.length >= 2 &&
    termsAgreed &&
    !isSaving;

  // ── File upload ─────────────────────────────────────────────────────────────

  const handleFileChange = useCallback(async (e) => {
    setFileError("");
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = await validateEmployeeFile(file);
    if (!validation.valid) { setFileError(validation.error); return; }

    if (validation.type === "csv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          const normalized = normalizeEmployeeRows(result.data);
          const valid = normalized.filter((emp) => validateEmployee(emp).valid);
          if (!valid.length) {
            setFileError("No valid records found. Ensure columns: FullName, Department, Wallet Address, Salary Amount.");
            return;
          }
          setUploadedEmployees(valid);
          addToast(`${valid.length} employee records loaded.`, "success");
        },
        error: () => setFileError("Failed to parse CSV file."),
      });
    } else {
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const rows = Array.isArray(parsed) ? parsed : parsed.employees || [];
        const normalized = normalizeEmployeeRows(rows);
        const valid = normalized.filter((emp) => validateEmployee(emp).valid);
        if (!valid.length) { setFileError("No valid records found in JSON."); return; }
        setUploadedEmployees(valid);
        addToast(`${valid.length} employee records loaded.`, "success");
      } catch { setFileError("Invalid JSON structure."); }
    }
  }, [addToast]);

  // ── Manual rows ─────────────────────────────────────────────────────────────

  const updateManualRow = (index, field, value) => {
    setManualRows((prev) => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
    setManualErrors((prev) => { const n = { ...prev }; delete n[`${index}_${field}`]; return n; });
  };

  const addManualRow = () => {
    const last = manualRows[manualRows.length - 1];
    const result = validateEmployee({ ...last, salaryAmount: Number(last.salaryAmount) });
    if (!result.valid) {
      const errs = {};
      result.errors.forEach((e, i) => { errs[`${manualRows.length - 1}_err_${i}`] = e; });
      setManualErrors(errs);
      return;
    }
    setManualErrors({});
    setManualRows((prev) => [...prev, { ...EMPTY_ROW }]);
  };

  const removeManualRow = (index) => setManualRows((prev) => prev.filter((_, i) => i !== index));

  // ── Finish setup ────────────────────────────────────────────────────────────

  const handleFinish = useCallback(async () => {
    if (!termsAgreed) return;

    const dupes = findDuplicateWallets(allEmployees);
    if (dupes.length > 0) {
      const details = dupes.map((d) => `${d.address.slice(0, 8)}… (rows ${d.rows.join(", ")})`).join("; ");
      addToast(`Duplicate wallet addresses: ${details}`, "error", 8000);
      return;
    }

    setIsSaving(true);
    setSaveError("");

    try {
      // Get signer before IPFS upload so wallet is primed and ready
      // This is the same pattern used in OnboardingModal and avoids
      // the signerGetterRef going stale during async IPFS upload.
      const signer = await getSigner();
      await syncData({
        _signer: signer,
        setup: {
          fullName:      sanitizeString(fullName),
          companyName:   sanitizeString(companyName),
          employeeCount,
        },
        employees: allEmployees,
      });
      addToast("Organisation and employee data saved successfully!", "success", 5000);
      onComplete?.();
      onClose?.();
    } catch (err) {
      setSaveError(err.message || "Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [termsAgreed, allEmployees, fullName, companyName, employeeCount, syncData, addToast, onComplete, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[8000] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="configure-title"
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden="true" />

        <div className="relative bg-salden-surface border border-salden-border rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh]">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-salden-border flex-shrink-0">
            <div>
              <h2 id="configure-title" className="text-salden-text-primary font-bold text-xl">
                Configure Employee & Payroll Data
              </h2>
              <p className="text-salden-text-muted text-sm mt-0.5">
                Set up your organisation profile and upload employee records.
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-salden-text-muted hover:text-salden-text-primary transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          {/* Scrollable form */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-salden-text-secondary mb-1.5">Full Name</label>
              <div className="relative">
                <UserCircle size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-salden-text-muted" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  maxLength={100}
                  className="w-full bg-salden-card border border-salden-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-salden-text-primary placeholder-salden-text-muted focus:outline-none focus:border-salden-blue/60 transition-colors"
                />
              </div>
            </div>

            {/* Company Name */}
            <div>
              <label className="block text-sm font-medium text-salden-text-secondary mb-1.5">Company / Organisation</label>
              <div className="relative">
                <Buildings size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-salden-text-muted" />
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Your company or organisation name"
                  maxLength={200}
                  className="w-full bg-salden-card border border-salden-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-salden-text-primary placeholder-salden-text-muted focus:outline-none focus:border-salden-blue/60 transition-colors"
                />
              </div>
            </div>

            {/* Employee Count */}
            <div>
              <label className="block text-sm font-medium text-salden-text-secondary mb-1.5">Number of Employees</label>
              <div className="relative">
                <UsersThree size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-salden-text-muted pointer-events-none" />
                <select
                  value={employeeCount}
                  onChange={(e) => setEmployeeCount(e.target.value)}
                  className="w-full bg-salden-card border border-salden-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-salden-text-primary focus:outline-none focus:border-salden-blue/60 transition-colors appearance-none"
                >
                  <option value="" disabled>Select a range</option>
                  {EMPLOYEE_COUNT_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Employee Data */}
            <div>
              <label className="block text-sm font-medium text-salden-text-secondary mb-1.5">Employee Data</label>
              <p className="text-xs text-salden-text-muted mb-3 bg-salden-hover/50 border border-salden-border rounded-lg px-3 py-2">
                <FileText size={12} className="inline mr-1.5" weight="fill" />
                Required columns: <strong className="text-salden-text-secondary">FullName</strong>,{" "}
                <strong className="text-salden-text-secondary">Department</strong>,{" "}
                <strong className="text-salden-text-secondary">Wallet Address</strong>,{" "}
                <strong className="text-salden-text-secondary">Salary Amount</strong>.
              </p>

              {/* Toggle */}
              <div className="flex rounded-xl border border-salden-border overflow-hidden mb-4">
                {["upload", "manual"].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setUploadMode(mode)}
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${
                      uploadMode === mode
                        ? "bg-salden-blue text-white"
                        : "text-salden-text-secondary hover:bg-salden-hover"
                    }`}
                  >
                    {mode === "upload" ? "Upload CSV / JSON" : "Enter Manually"}
                  </button>
                ))}
              </div>

              {/* File upload */}
              {uploadMode === "upload" && (
                <div>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-salden-border rounded-xl p-6 text-center cursor-pointer hover:border-salden-blue/50 hover:bg-salden-hover/30 transition-all"
                  >
                    <UploadSimple size={24} className="mx-auto mb-2 text-salden-text-muted" />
                    <p className="text-sm text-salden-text-secondary">Click to upload CSV or JSON</p>
                    <p className="text-xs text-salden-text-muted mt-1">Max file size: 5 MB</p>
                    {uploadedEmployees.length > 0 && (
                      <p className="text-xs text-salden-success mt-2 font-medium">
                        ✓ {uploadedEmployees.length} employees loaded
                      </p>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.json"
                    onChange={handleFileChange}
                    className="hidden"
                    aria-label="Upload employee data file"
                  />
                  {fileError && (
                    <p className="text-xs text-salden-error mt-2 flex items-center gap-1">
                      <Warning size={12} /> {fileError}
                    </p>
                  )}
                </div>
              )}

              {/* Manual entry */}
              {uploadMode === "manual" && (
                <div className="space-y-3">
                  {manualRows.map((row, idx) => (
                    <div key={idx} className="bg-salden-card border border-salden-border rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-salden-text-muted font-medium">Employee {idx + 1}</span>
                        {manualRows.length > 1 && (
                          <button
                            onClick={() => removeManualRow(idx)}
                            className="text-salden-text-muted hover:text-salden-error transition-colors"
                            aria-label={`Remove employee ${idx + 1}`}
                          >
                            <Trash size={14} />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" placeholder="Full Name" value={row.fullName}
                          onChange={(e) => updateManualRow(idx, "fullName", e.target.value)} maxLength={100}
                          className="bg-salden-surface border border-salden-border rounded-lg px-3 py-2 text-xs text-salden-text-primary placeholder-salden-text-muted focus:outline-none focus:border-salden-blue/60 transition-colors" />
                        <input type="text" placeholder="Department" value={row.department}
                          onChange={(e) => updateManualRow(idx, "department", e.target.value)} maxLength={100}
                          className="bg-salden-surface border border-salden-border rounded-lg px-3 py-2 text-xs text-salden-text-primary placeholder-salden-text-muted focus:outline-none focus:border-salden-blue/60 transition-colors" />
                        <input type="text" placeholder="Wallet Address (0x...)" value={row.walletAddress}
                          onChange={(e) => updateManualRow(idx, "walletAddress", e.target.value)} maxLength={42}
                          className="col-span-2 bg-salden-surface border border-salden-border rounded-lg px-3 py-2 text-xs text-salden-text-primary placeholder-salden-text-muted focus:outline-none focus:border-salden-blue/60 transition-colors font-mono" />
                        <input type="number" placeholder="Salary Amount (USDC)" value={row.salaryAmount}
                          onChange={(e) => updateManualRow(idx, "salaryAmount", e.target.value)} min={0} step="0.01"
                          className="col-span-2 bg-salden-surface border border-salden-border rounded-lg px-3 py-2 text-xs text-salden-text-primary placeholder-salden-text-muted focus:outline-none focus:border-salden-blue/60 transition-colors" />
                      </div>
                    </div>
                  ))}
                  {Object.keys(manualErrors).length > 0 && (
                    <p className="text-xs text-salden-error flex items-center gap-1">
                      <Warning size={12} /> Please correct the errors above before adding more.
                    </p>
                  )}
                  <button
                    onClick={addManualRow}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-salden-border text-salden-text-muted hover:border-salden-blue/50 hover:text-salden-blue transition-all text-sm"
                  >
                    <Plus size={14} /> Add Employee
                  </button>
                </div>
              )}
            </div>

            {/* ToS checkbox */}
            <div className="pt-1">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={termsAgreed}
                  onChange={(e) => setTermsAgreed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-salden-border accent-salden-blue flex-shrink-0 cursor-pointer"
                  aria-label="I agree to the Terms of Service"
                />
                <span className="text-xs text-salden-text-muted leading-relaxed">
                  I agree to the{" "}
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); setShowTerms(true); }}
                    className="text-salden-blue hover:underline font-medium"
                  >
                    Terms of Service
                  </button>
                </span>
              </label>
            </div>

            {/* Save error */}
            {saveError && (
              <div className="flex items-start gap-2 text-xs text-salden-error bg-red-950/20 border border-red-900/30 rounded-lg px-3 py-2">
                <Warning size={14} className="flex-shrink-0 mt-0.5" />
                {saveError}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-salden-border flex-shrink-0">
            <button
              onClick={handleFinish}
              disabled={!canFinish}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all ${
                canFinish
                  ? "bg-gradient-to-r from-salden-blue to-salden-violet hover:opacity-90 text-white shadow-lg"
                  : isSaving
                  ? "bg-salden-hover text-salden-text-muted cursor-wait"
                  : "bg-salden-hover text-salden-text-muted cursor-not-allowed"
              }`}
            >
              {isSaving ? (
                <><Spinner size={16} className="animate-spin" /> Saving…</>
              ) : (
                <><CheckCircle size={16} /> Finish Setup</>
              )}
            </button>
            {!canFinish && !isSaving && (
              <p className="text-center text-xs text-salden-text-muted mt-2">
                {allEmployees.length < 2
                  ? "Add at least 2 employees to continue."
                  : !termsAgreed
                  ? "Check the Terms of Service box to proceed."
                  : "Complete all fields to save."}
              </p>
            )}
          </div>
        </div>
      </div>

      <TermsModal
        isOpen={showTerms}
        onClose={() => setShowTerms(false)}
        onAgree={() => setTermsAgreed(true)}
        onDisagree={() => setTermsAgreed(false)}
      />
    </>
  );
}
