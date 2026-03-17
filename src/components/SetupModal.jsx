/**
 * SetupModal.jsx
 * Payroll Setup & Deployment modal.
 * Collects employer info, employee data (CSV/JSON upload or manual entry),
 * handles ToS acceptance, then deploys the payroll clone on Arc Network.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import {
  X,
  UserCircle,
  Buildings,
  UsersThree,
  UploadSimple,
  Plus,
  Trash,
  Spinner,
  CheckCircle,
  Warning,
  FileText,
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
import { getOrDeployPayrollClone, getUserPayrolls } from "../utils/contracts.js";

const EMPLOYEE_COUNT_OPTIONS = [
  "2 – 500",
  "501 – 1,000",
  "1,001 – 5,000",
  "5,001 – 10,000",
];

const EMPTY_MANUAL_ROW = { fullName: "", department: "", walletAddress: "", salaryAmount: "" };

/**
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {function} props.onClose
 * @param {function} props.onDeployed - Called with clone address when deployment succeeds
 */
export default function SetupModal({ isOpen, onClose, onDeployed }) {
  const { state, dispatch, addToast, syncData } = useApp();
  const { getSigner } = useEthersSigner();

  // Form state
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [employeeCount, setEmployeeCount] = useState("");
  const [uploadMode, setUploadMode] = useState("upload"); // "upload" | "manual"
  const [uploadedEmployees, setUploadedEmployees] = useState([]);
  const [manualRows, setManualRows] = useState([{ ...EMPTY_MANUAL_ROW }]);
  const [fileError, setFileError] = useState("");
  const [manualErrors, setManualErrors] = useState({});

  // ToS modal
  const [showTerms, setShowTerms] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  // Deferred deploy flag: set when user agrees to ToS.
  // A useEffect watches this flag so handleDeploy is called after React
  // commits the termsAgreed = true state — eliminating the stale closure.
  const [pendingDeploy, setPendingDeploy] = useState(false);

  // Deployment status
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployStatus, setDeployStatus] = useState("");
  const [deployError, setDeployError] = useState("");

  const fileInputRef = useRef(null);

  // Derived: all employees (from upload or manual)
  const allEmployees =
    uploadMode === "upload" ? uploadedEmployees : manualRows.filter(
      (r) => r.fullName && r.walletAddress && r.salaryAmount
    );

  const canDeploy =
    fullName.trim().length >= 2 &&
    companyName.trim().length >= 2 &&
    employeeCount &&
    allEmployees.length >= 2 &&
    termsAgreed &&
    !isDeploying;

  // ── File upload handler ──────────────────────────────────────────────────

  const handleFileChange = useCallback(async (e) => {
    setFileError("");
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = await validateEmployeeFile(file);
    if (!validation.valid) {
      setFileError(validation.error);
      return;
    }

    if (validation.type === "csv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          const normalized = normalizeEmployeeRows(result.data);
          const valid = normalized.filter((emp) => {
            const v = validateEmployee(emp);
            return v.valid;
          });
          if (valid.length === 0) {
            setFileError("No valid employee records found. Ensure columns: FullName, Department, Wallet Address, Salary Amount.");
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
        if (valid.length === 0) {
          setFileError("No valid records found in JSON.");
          return;
        }
        setUploadedEmployees(valid);
        addToast(`${valid.length} employee records loaded.`, "success");
      } catch {
        setFileError("Invalid JSON structure.");
      }
    }
  }, [addToast]);

  // ── Manual row handlers ───────────────────────────────────────────────────

  const updateManualRow = (index, field, value) => {
    setManualRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
    setManualErrors((prev) => {
      const next = { ...prev };
      delete next[`${index}_${field}`];
      return next;
    });
  };

  const addManualRow = () => {
    // Validate current last row before adding
    const lastRow = manualRows[manualRows.length - 1];
    const result = validateEmployee({
      ...lastRow,
      salaryAmount: Number(lastRow.salaryAmount),
    });
    if (!result.valid) {
      const errors = {};
      result.errors.forEach((err, i) => {
        errors[`${manualRows.length - 1}_error_${i}`] = err;
      });
      setManualErrors(errors);
      return;
    }
    setManualErrors({});
    setManualRows((prev) => [...prev, { ...EMPTY_MANUAL_ROW }]);
  };

  const removeManualRow = (index) => {
    setManualRows((prev) => prev.filter((_, i) => i !== index));
  };

  // ── ToS agree callback ────────────────────────────────────────────────────
  //
  // PATTERN: We do NOT call handleDeploy directly here because handleDeploy
  // is a separate useCallback that depends on `termsAgreed`. Calling it from
  // handleTermsAgree would capture a stale version where termsAgreed === false.
  //
  // Instead we set a `pendingDeploy` flag and let a useEffect trigger
  // handleDeploy after React has committed the new termsAgreed = true state.

  const handleTermsAgree = useCallback(() => {
    setTermsAgreed(true);
    if (
      fullName.trim().length >= 2 &&
      companyName.trim().length >= 2 &&
      employeeCount &&
      allEmployees.length >= 2
    ) {
      setPendingDeploy(true);
    }
  }, [fullName, companyName, employeeCount, allEmployees]);

  // ── Deployment handler ────────────────────────────────────────────────────

  const handleDeploy = useCallback(async (agreedViaModal = false) => {
    if (!agreedViaModal && !termsAgreed) return;
    if (allEmployees.length < 2) {
      addToast("At least 2 employees are required to deploy.", "warning");
      return;
    }

    // Check for duplicate wallet addresses
    const duplicates = findDuplicateWallets(allEmployees);
    if (duplicates.length > 0) {
      const details = duplicates
        .map((d) => `${d.address.slice(0, 8)}... (rows ${d.rows.join(", ")})`)
        .join("; ");
      addToast(`Duplicate wallet addresses detected: ${details}. Please resolve before deploying.`, "error", 8000);
      return;
    }

    setIsDeploying(true);
    setDeployError("");

    try {
      const signer = await getSigner();
      const cloneAddress = await getOrDeployPayrollClone(signer, (status) => {
        setDeployStatus(status);
      });

      const allClones = await getUserPayrolls(state.account);
      dispatch({ type: "SET_CLONE_ADDRESSES", payload: allClones });
      dispatch({ type: "SET_ACTIVE_CLONE", payload: cloneAddress });

      // Save setup and employee data
      const setupData = {
        fullName: sanitizeString(fullName),
        companyName: sanitizeString(companyName),
        employeeCount,
      };

      await syncData({
        setup: setupData,
        employees: allEmployees,
      });

      addToast("Payroll deployed and data saved successfully!", "success", 6000);
      onDeployed?.(cloneAddress);
      onClose?.();
    } catch (err) {
      setDeployError(err.message || "Deployment failed. Please try again.");
      addToast(err.message, "error");
    } finally {
      setIsDeploying(false);
      setDeployStatus("");
    }
  }, [termsAgreed, allEmployees, fullName, companyName, employeeCount, state.account, dispatch, syncData, addToast, onDeployed, onClose]);

  // Trigger deploy after termsAgreed state has committed
  useEffect(() => {
    if (pendingDeploy && termsAgreed) {
      setPendingDeploy(false);
      handleDeploy(false);
    }
  }, [pendingDeploy, termsAgreed, handleDeploy]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[8000] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="setup-title"
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden="true" />

        {/* Modal */}
        <div className="relative bg-salden-surface border border-salden-border rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-salden-border flex-shrink-0">
            <div>
              <h2 id="setup-title" className="text-salden-text-primary font-bold text-xl">
                Payroll Setup & Deployment
              </h2>
              <p className="text-salden-text-muted text-sm mt-0.5">
                Configure your organization and deploy your payroll contract.
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-salden-text-muted hover:text-salden-text-primary transition-colors"
              aria-label="Close setup modal"
            >
              <X size={20} />
            </button>
          </div>

          {/* Scrollable form */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-salden-text-secondary mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <UserCircle
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-salden-text-muted"
                />
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
              <label className="block text-sm font-medium text-salden-text-secondary mb-1.5">
                Name of Company / Organization
              </label>
              <div className="relative">
                <Buildings
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-salden-text-muted"
                />
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Your company or organization name"
                  maxLength={200}
                  className="w-full bg-salden-card border border-salden-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-salden-text-primary placeholder-salden-text-muted focus:outline-none focus:border-salden-blue/60 transition-colors"
                />
              </div>
            </div>

            {/* Employee Count */}
            <div>
              <label className="block text-sm font-medium text-salden-text-secondary mb-1.5">
                Number of Employees
              </label>
              <div className="relative">
                <UsersThree
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-salden-text-muted pointer-events-none"
                />
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
              <label className="block text-sm font-medium text-salden-text-secondary mb-1.5">
                Upload Employee Data
              </label>
              <p className="text-xs text-salden-text-muted mb-3 bg-salden-hover/50 border border-salden-border rounded-lg px-3 py-2">
                <FileText size={12} className="inline mr-1.5" weight="fill" />
                The file must contain exactly 4 columns: <strong className="text-salden-text-secondary">FullName</strong>,{" "}
                <strong className="text-salden-text-secondary">Department</strong>,{" "}
                <strong className="text-salden-text-secondary">Wallet Address</strong>, and{" "}
                <strong className="text-salden-text-secondary">Salary Amount</strong>.
              </p>

              {/* Mode toggle */}
              <div className="flex rounded-xl border border-salden-border overflow-hidden mb-4">
                <button
                  onClick={() => setUploadMode("upload")}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    uploadMode === "upload"
                      ? "bg-salden-blue text-white"
                      : "text-salden-text-secondary hover:bg-salden-hover"
                  }`}
                >
                  Upload CSV / JSON
                </button>
                <button
                  onClick={() => setUploadMode("manual")}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    uploadMode === "manual"
                      ? "bg-salden-blue text-white"
                      : "text-salden-text-secondary hover:bg-salden-hover"
                  }`}
                >
                  Enter Manually
                </button>
              </div>

              {/* File upload area */}
              {uploadMode === "upload" && (
                <div>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-salden-border rounded-xl p-6 text-center cursor-pointer hover:border-salden-blue/50 hover:bg-salden-hover/30 transition-all"
                  >
                    <UploadSimple size={24} className="mx-auto mb-2 text-salden-text-muted" />
                    <p className="text-sm text-salden-text-secondary">
                      Click to upload CSV or JSON
                    </p>
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
                        <span className="text-xs text-salden-text-muted font-medium">
                          Employee {idx + 1}
                        </span>
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
                        <input
                          type="text"
                          placeholder="Full Name"
                          value={row.fullName}
                          onChange={(e) => updateManualRow(idx, "fullName", e.target.value)}
                          maxLength={100}
                          className="bg-salden-surface border border-salden-border rounded-lg px-3 py-2 text-xs text-salden-text-primary placeholder-salden-text-muted focus:outline-none focus:border-salden-blue/60 transition-colors"
                        />
                        <input
                          type="text"
                          placeholder="Department"
                          value={row.department}
                          onChange={(e) => updateManualRow(idx, "department", e.target.value)}
                          maxLength={100}
                          className="bg-salden-surface border border-salden-border rounded-lg px-3 py-2 text-xs text-salden-text-primary placeholder-salden-text-muted focus:outline-none focus:border-salden-blue/60 transition-colors"
                        />
                        <input
                          type="text"
                          placeholder="Wallet Address (0x...)"
                          value={row.walletAddress}
                          onChange={(e) => updateManualRow(idx, "walletAddress", e.target.value)}
                          maxLength={42}
                          className="col-span-2 bg-salden-surface border border-salden-border rounded-lg px-3 py-2 text-xs text-salden-text-primary placeholder-salden-text-muted focus:outline-none focus:border-salden-blue/60 transition-colors font-mono"
                        />
                        <input
                          type="number"
                          placeholder="Salary Amount (USDC)"
                          value={row.salaryAmount}
                          onChange={(e) => updateManualRow(idx, "salaryAmount", e.target.value)}
                          min={0}
                          step="0.01"
                          className="col-span-2 bg-salden-surface border border-salden-border rounded-lg px-3 py-2 text-xs text-salden-text-primary placeholder-salden-text-muted focus:outline-none focus:border-salden-blue/60 transition-colors"
                        />
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
                    <Plus size={14} />
                    Add Employee
                  </button>
                </div>
              )}
            </div>

            {/* Terms of Service */}
            <div className="pt-1">
              <p className="text-xs text-salden-text-muted text-center">
                By continuing you confirm to agree with our{" "}
                <button
                  onClick={() => setShowTerms(true)}
                  className="text-salden-blue hover:underline font-medium"
                >
                  Terms of Service
                </button>
              </p>
              {termsAgreed && (
                <p className="text-xs text-salden-success flex items-center justify-center gap-1 mt-1.5">
                  <CheckCircle size={12} weight="fill" /> Terms accepted
                </p>
              )}
            </div>

            {/* Deploy status */}
            {deployStatus && (
              <div className="flex items-center gap-2 text-xs text-salden-text-muted bg-salden-hover rounded-lg px-3 py-2">
                <Spinner size={14} className="animate-spin flex-shrink-0 text-salden-blue" />
                {deployStatus}
              </div>
            )}

            {/* Deploy error */}
            {deployError && (
              <div className="flex items-start gap-2 text-xs text-salden-error bg-red-950/20 border border-red-900/30 rounded-lg px-3 py-2">
                <Warning size={14} className="flex-shrink-0 mt-0.5" />
                {deployError}
              </div>
            )}
          </div>

          {/* Footer CTA */}
          <div className="px-6 py-4 border-t border-salden-border flex-shrink-0">
            <button
              onClick={() => canDeploy ? handleDeploy(false) : setShowTerms(true)}
              disabled={isDeploying || (!termsAgreed && !canDeploy && allEmployees.length < 2)}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all ${
                canDeploy
                  ? "bg-gradient-to-r from-salden-blue to-salden-violet hover:opacity-90 text-white shadow-lg"
                  : isDeploying
                  ? "bg-salden-hover text-salden-text-muted cursor-wait"
                  : "bg-salden-hover text-salden-text-muted cursor-not-allowed"
              }`}
            >
              {isDeploying ? (
                <>
                  <Spinner size={16} className="animate-spin" />
                  Deploying...
                </>
              ) : (
                "Deploy My Payroll"
              )}
            </button>
            {!canDeploy && !isDeploying && (
              <p className="text-center text-xs text-salden-text-muted mt-2">
                {allEmployees.length < 2
                  ? "Add at least 2 employees to continue."
                  : !termsAgreed
                  ? "Accept the Terms of Service to proceed."
                  : "Complete all fields to deploy."}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Terms of Service modal */}
      <TermsModal
        isOpen={showTerms}
        onClose={() => setShowTerms(false)}
        onAgree={handleTermsAgree}
      />
    </>
  );
}
