/**
 * HRDashboard.jsx
 * The primary employer dashboard. Features: employee table with advanced search,
 * add/edit/delete employee flows, batch payment execution with duplicate detection,
 * payroll history with receipt download, and clone selector.
 */

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  MagnifyingGlass,
  UserPlus,
  Play,
  ClockCounterClockwise,
  CaretDown,
  PencilSimple,
  Trash,
  Download,
  ArrowSquareOut,
  Warning,
  Spinner,
  X,
  CheckCircle,
  CopySimple,
  UsersThree,
  CurrencyDollar,
  Buildings,
  UploadSimple,
  FileText,
} from "@phosphor-icons/react";
import { useApp } from "../context/AppContext.jsx";
import { useEthersSigner } from "../hooks/useEthersSigner.js";
import { DashboardSkeleton } from "../components/SkeletonLoader.jsx";
import {
  validateEmployee,
  sanitizeString,
  findDuplicateWallets,
  validateEmployeeFile,
  normalizeEmployeeRows,
} from "../utils/validation.js";
import Papa from "papaparse";
import ConfigureModal from "../components/ConfigureModal.jsx";
import {
  executePayroll,
  getPayrollHistory,
  decodeBatchPayCalldata,
} from "../utils/contracts.js";
import { generatePayrollReceiptPDF } from "../utils/pdf.js";
import { checkPayrollExecutionLimit } from "../utils/rateLimiter.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncAddr(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// ─── Add / Edit Employee Modal ────────────────────────────────────────────────

function EmployeeModal({ mode, employee, rowIndex, onSave, onSaveBulk, onClose }) {
  // "single" = manual form, "bulk" = CSV/JSON import (add mode only)
  const [tab, setTab] = useState("single");

  // Single entry form
  const [form, setForm] = useState({
    fullName:      employee?.fullName         || "",
    department:    employee?.department       || "",
    walletAddress: employee?.walletAddress    || "",
    salaryAmount:  employee?.salaryAmount?.toString() || "",
  });
  const [errors,  setErrors]  = useState([]);
  const [saving,  setSaving]  = useState(false);

  // Bulk import state
  const fileInputRef              = useRef(null);
  const [bulkEmployees, setBulkEmployees] = useState([]);
  const [fileError,     setFileError]     = useState("");
  const [importing,     setImporting]     = useState(false);

  const handleSave = async () => {
    const result = validateEmployee({ ...form, salaryAmount: Number(form.salaryAmount) });
    if (!result.valid) { setErrors(result.errors); return; }
    setSaving(true);
    try {
      await onSave({ ...form, salaryAmount: Number(form.salaryAmount) }, rowIndex);
      onClose();
    } catch (err) {
      setErrors([err.message]);
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = async (e) => {
    setFileError("");
    setBulkEmployees([]);
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
          if (!valid.length) { setFileError("No valid records found. Ensure columns: FullName, Department, Wallet Address, Salary Amount."); return; }
          setBulkEmployees(valid);
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
        setBulkEmployees(valid);
      } catch { setFileError("Invalid JSON structure."); }
    }
  };

  const handleBulkImport = async () => {
    if (!bulkEmployees.length) return;
    setImporting(true);
    try {
      await onSaveBulk(bulkEmployees);
      onClose();
    } catch (err) {
      setFileError(err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-salden-surface border border-salden-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-salden-border">
          <h3 className="font-bold text-salden-text-primary">
            {mode === "add" ? "Add Employee" : "Edit Employee"}
          </h3>
          <button onClick={onClose} className="text-salden-text-muted hover:text-salden-text-primary transition-colors" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Tab toggle — only in add mode */}
        {mode === "add" && (
          <div className="flex border-b border-salden-border">
            {["single", "bulk"].map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setErrors([]); setFileError(""); }}
                className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                  tab === t
                    ? "text-salden-blue border-b-2 border-salden-blue"
                    : "text-salden-text-muted hover:text-salden-text-secondary"
                }`}
              >
                {t === "single" ? "Single Entry" : "Bulk Import (CSV / JSON)"}
              </button>
            ))}
          </div>
        )}

        {/* ── Single entry ── */}
        {(mode === "edit" || tab === "single") && (
          <>
            <div className="px-5 py-5 space-y-3">
              {errors.length > 0 && (
                <div className="bg-red-950/30 border border-red-800/40 rounded-xl p-3 text-xs text-red-300 space-y-1">
                  {errors.map((e, i) => (
                    <p key={i} className="flex items-start gap-1.5"><Warning size={12} className="flex-shrink-0 mt-0.5" />{e}</p>
                  ))}
                </div>
              )}
              {[
                { field: "fullName",      placeholder: "Full Name",             type: "text"   },
                { field: "department",    placeholder: "Department",            type: "text"   },
                { field: "walletAddress", placeholder: "Wallet Address (0x...)",type: "text", mono: true },
                { field: "salaryAmount",  placeholder: "Salary Amount (USDC)",  type: "number" },
              ].map(({ field, placeholder, type, mono }) => (
                <input
                  key={field}
                  type={type}
                  placeholder={placeholder}
                  value={form[field]}
                  onChange={(e) => { setForm((p) => ({ ...p, [field]: e.target.value })); setErrors([]); }}
                  maxLength={field === "walletAddress" ? 42 : 200}
                  min={type === "number" ? 0 : undefined}
                  step={type === "number" ? "0.01" : undefined}
                  className={`w-full bg-salden-card border border-salden-border rounded-xl px-3.5 py-2.5 text-sm text-salden-text-primary placeholder-salden-text-muted focus:outline-none focus:border-salden-blue/60 transition-colors ${mono ? "font-mono" : ""}`}
                />
              ))}
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-salden-border text-salden-text-secondary hover:bg-salden-hover transition-colors text-sm">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-salden-blue hover:bg-salden-blue-dark text-white text-sm font-semibold transition-colors disabled:opacity-60">
                {saving ? <Spinner size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                {mode === "add" ? "Add Employee" : "Save Changes"}
              </button>
            </div>
          </>
        )}

        {/* ── Bulk import ── */}
        {mode === "add" && tab === "bulk" && (
          <div className="px-5 py-5 space-y-4">
            <p className="text-xs text-salden-text-muted bg-salden-hover/50 border border-salden-border rounded-lg px-3 py-2">
              <FileText size={12} className="inline mr-1.5" weight="fill" />
              Required columns: <strong className="text-salden-text-secondary">FullName</strong>, <strong className="text-salden-text-secondary">Department</strong>, <strong className="text-salden-text-secondary">Wallet Address</strong>, <strong className="text-salden-text-secondary">Salary Amount</strong>.
            </p>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-salden-border rounded-xl p-6 text-center cursor-pointer hover:border-salden-blue/50 hover:bg-salden-hover/30 transition-all"
            >
              <UploadSimple size={22} className="mx-auto mb-2 text-salden-text-muted" />
              <p className="text-sm text-salden-text-secondary">Click to upload CSV or JSON</p>
              <p className="text-xs text-salden-text-muted mt-1">Max 5 MB</p>
              {bulkEmployees.length > 0 && (
                <p className="text-xs text-salden-success mt-2 font-medium">✓ {bulkEmployees.length} records ready to import</p>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept=".csv,.json" onChange={handleFileChange} className="hidden" />

            {fileError && (
              <p className="text-xs text-salden-error flex items-center gap-1"><Warning size={12} /> {fileError}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-salden-border text-salden-text-secondary hover:bg-salden-hover transition-colors text-sm">Cancel</button>
              <button
                onClick={handleBulkImport}
                disabled={!bulkEmployees.length || importing}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-salden-blue hover:bg-salden-blue-dark text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {importing ? <Spinner size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                Import {bulkEmployees.length > 0 ? `${bulkEmployees.length} Employees` : "Employees"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Delete Confirmation Modal ────────────────────────────────────────────────

function DeleteModal({ employee, onConfirm, onClose }) {
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative bg-salden-surface border border-salden-border rounded-2xl w-full max-w-sm shadow-2xl p-6">
        <div className="w-12 h-12 rounded-full bg-red-950/50 border border-red-800/40 flex items-center justify-center mx-auto mb-4">
          <Trash size={22} weight="fill" className="text-red-400" />
        </div>
        <h3 className="text-center font-bold text-salden-text-primary mb-2">
          Delete Employee?
        </h3>
        <p className="text-center text-sm text-salden-text-secondary mb-6">
          This will permanently remove{" "}
          <strong className="text-salden-text-primary">{employee?.fullName}</strong> from the
          payroll. This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-salden-border text-salden-text-secondary hover:bg-salden-hover transition-colors text-sm"
          >
            No, Keep
          </button>
          <button
            onClick={handleConfirm}
            disabled={deleting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 text-white text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {deleting ? <Spinner size={14} className="animate-spin" /> : <Trash size={14} />}
            Yes, Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Payment History Modal ────────────────────────────────────────────────────

function PaymentHistoryModal({ history, isLoading, activeClone, onClose }) {
  const [downloading, setDownloading] = useState(null);

  const handleDownload = async (entry, index) => {
    setDownloading(index);
    try {
      const employees = await decodeBatchPayCalldata(
        entry.transactionHash,
        activeClone
      );
      generatePayrollReceiptPDF({
        employer: entry.employer,
        cloneAddress: entry.cloneAddress,
        txHash: entry.transactionHash,
        date: entry.date,
        employees,
        totalAmount: entry.totalAmountPaid,
        receiptNumber: String(history.length - index),
      });
    } catch (err) {
      console.error("Receipt generation failed:", err.message);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative bg-salden-surface border border-salden-border rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-salden-border flex-shrink-0">
          <h3 className="font-bold text-salden-text-primary flex items-center gap-2">
            <ClockCounterClockwise size={18} weight="fill" className="text-salden-blue" />
            Payment History
          </h3>
          <button
            onClick={onClose}
            className="text-salden-text-muted hover:text-salden-text-primary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center gap-3 py-12 text-salden-text-muted text-sm">
              <Spinner size={18} className="animate-spin text-salden-blue flex-shrink-0" />
              Loading payment history…
            </div>
          ) : history.length === 0 ? (
            <p className="text-salden-text-muted text-sm text-center py-10">
              No payment history found for this contract.
            </p>
          ) : (
            history.map((entry, i) => (
              <div
                key={i}
                className="bg-salden-card border border-salden-border rounded-xl p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-salden-text-primary text-sm">
                    PAYROLL RECEIPT {history.length - i}
                  </span>
                  <button
                    onClick={() => handleDownload(entry, i)}
                    disabled={downloading === i}
                    className="flex items-center gap-1.5 text-xs text-salden-blue hover:text-salden-blue-light transition-colors disabled:opacity-60"
                  >
                    {downloading === i ? (
                      <Spinner size={12} className="animate-spin" />
                    ) : (
                      <Download size={12} />
                    )}
                    Download Full Receipt
                  </button>
                </div>
                <div className="space-y-1.5 text-xs">
                  {[
                    ["Employer", truncAddr(entry.employer)],
                    ["Employees Paid", entry.employeesPaid],
                    ["Total Amount", `${entry.totalAmountPaid} USDC`],
                  ].map(([label, value]) => (
                    <div key={label} className="flex gap-4">
                      <span className="text-salden-text-muted w-32 flex-shrink-0">
                        {label}
                      </span>
                      <span
                        className={`text-salden-text-secondary ${label === "Total Amount" ? "font-semibold text-salden-text-primary" : ""}`}
                      >
                        {value}
                      </span>
                    </div>
                  ))}
                  <div className="flex gap-4 items-center">
                    <span className="text-salden-text-muted w-32 flex-shrink-0">
                      Transaction
                    </span>
                    <a
                      href={entry.explorerLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-salden-blue hover:underline flex items-center gap-1 font-mono"
                    >
                      {truncAddr(entry.transactionHash)}
                      <ArrowSquareOut size={10} />
                    </a>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-salden-text-muted w-32 flex-shrink-0">Date</span>
                    <span className="text-salden-text-secondary">{entry.date}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard Component ─────────────────────────────────────────────────

export default function HRDashboard() {
  const { state, dispatch, addToast, syncData } = useApp();
  const { getSigner } = useEthersSigner();
  const { employees, payrollSetup, cloneAddresses, activeCloneAddress, isSyncing } = state;

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [highlightedRow, setHighlightedRow] = useState(null);
  const rowRefs = useRef({});
  const searchRef = useRef(null);

  const [employeeModal, setEmployeeModal] = useState(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [payrollHistory, setPayrollHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [contextMenu, setContextMenu] = useState(null);
  const longPressTimer = useRef(null);

  const [isExecuting, setIsExecuting] = useState(false);
  const [executeStatus, setExecuteStatus] = useState("");
  const [executeProgress, setExecuteProgress] = useState(null);

  const [cloneDropdownOpen, setCloneDropdownOpen] = useState(false);

  const isLoading = isSyncing && employees.length === 0;

  // ── Derived stats ──────────────────────────────────────────────────────────

  const totalPayroll = useMemo(
    () => employees.reduce((sum, emp) => sum + Number(emp.salaryAmount || 0), 0),
    [employees]
  );

  // ── Search ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }
    const q = searchQuery.toLowerCase();
    const results = employees
      .map((emp, idx) => ({ emp, idx }))
      .filter(({ emp }) =>
        emp.fullName?.toLowerCase().includes(q) ||
        emp.department?.toLowerCase().includes(q)
      )
      .slice(0, 8);
    setSearchResults(results);
    setShowSearchDropdown(results.length > 0);
  }, [searchQuery, employees]);

  const handleSearchSelect = useCallback((idx) => {
    setSearchQuery("");
    setShowSearchDropdown(false);
    setHighlightedRow(idx);
    setTimeout(() => {
      rowRefs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    setTimeout(() => setHighlightedRow(null), 2500);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Long-press context menu (row actions) ──────────────────────────────────

  const handleRowPointerDown = (e, rowIndex) => {
    longPressTimer.current = setTimeout(() => {
      setContextMenu({ x: e.clientX, y: e.clientY, rowIndex });
    }, 600);
  };

  const handleRowPointerUp = () => {
    clearTimeout(longPressTimer.current);
  };

  useEffect(() => {
    const close = () => setContextMenu(null);
    if (contextMenu) {
      window.addEventListener("click", close);
      return () => window.removeEventListener("click", close);
    }
  }, [contextMenu]);

  // ── Add employee ───────────────────────────────────────────────────────────

  const handleAddEmployeeBulk = useCallback(
    async (newEmployees) => {
      const merged = [...employees, ...newEmployees];
      dispatch({ type: "SET_EMPLOYEES", payload: merged });
      try {
        await syncData({ employees: merged });
        addToast(`${newEmployees.length} employee${newEmployees.length !== 1 ? "s" : ""} imported successfully.`, "success");
      } catch {
        addToast("Employees added locally but sync failed. Changes may not persist.", "warning");
      }
    },
    [employees, dispatch, syncData, addToast]
  );

  const handleAddEmployee = useCallback(
    async (data) => {
      const newEmployees = [...employees, { ...data }];
      dispatch({ type: "SET_EMPLOYEES", payload: newEmployees });
      try {
        await syncData({ employees: newEmployees });
        addToast("Employee added and data synced.", "success");
      } catch {
        addToast("Employee added locally. Sync failed — please retry.", "warning");
      }
    },
    [employees, dispatch, syncData, addToast]
  );

  // ── Edit employee ──────────────────────────────────────────────────────────

  const handleEditEmployee = useCallback(
    async (data, rowIndex) => {
      const newEmployees = employees.map((emp, i) =>
        i === rowIndex ? { ...emp, ...data } : emp
      );
      dispatch({ type: "SET_EMPLOYEES", payload: newEmployees });
      try {
        await syncData({ employees: newEmployees });
        addToast("Employee updated and data synced.", "success");
      } catch {
        addToast("Updated locally. Sync failed — please retry.", "warning");
      }
    },
    [employees, dispatch, syncData, addToast]
  );

  // ── Delete employee ────────────────────────────────────────────────────────

  const handleDeleteEmployee = useCallback(
    async (rowIndex) => {
      const newEmployees = employees.filter((_, i) => i !== rowIndex);
      dispatch({ type: "SET_EMPLOYEES", payload: newEmployees });
      try {
        await syncData({ employees: newEmployees });
        addToast("Employee removed and data synced.", "success");
      } catch {
        addToast("Removed locally. Sync failed — please retry.", "warning");
      }
    },
    [employees, dispatch, syncData, addToast]
  );

  // ── Load payroll history ───────────────────────────────────────────────────

  const handleLoadHistory = useCallback(async () => {
    if (!activeCloneAddress || !state.account) return;
    setHistoryLoading(true);
    setShowHistory(true);
    try {
      const history = await getPayrollHistory(activeCloneAddress, state.account);
      setPayrollHistory(history);
    } catch (err) {
      addToast("Failed to load payment history: " + err.message, "error");
    } finally {
      setHistoryLoading(false);
    }
  }, [activeCloneAddress, state.account, addToast]);

  // ── Execute payroll ────────────────────────────────────────────────────────

  const handleExecutePayroll = useCallback(async () => {
    if (!activeCloneAddress) {
      addToast("No payroll contract selected.", "error");
      return;
    }

    const rateCheck = checkPayrollExecutionLimit();
    if (!rateCheck.allowed) {
      addToast("Payroll execution rate limit reached. Please wait.", "warning");
      return;
    }

    // Duplicate wallet check
    const duplicates = findDuplicateWallets(employees);
    if (duplicates.length > 0) {
      const details = duplicates
        .map((d) => `Row${d.rows.length > 1 ? "s" : ""} ${d.rows.join(", ")}: ${d.address.slice(0, 8)}...`)
        .join(" | ");
      addToast(
        `Duplicate wallet addresses detected — ${details}. Resolve duplicates before executing payroll.`,
        "error",
        8000
      );
      return;
    }

    if (employees.length === 0) {
      addToast("No employees in the payroll list.", "warning");
      return;
    }

    setIsExecuting(true);
    setExecuteStatus("Preparing payroll execution...");

    try {
      const signer = await getSigner();
      await executePayroll(
        signer,
        activeCloneAddress,
        employees,
        (status) => setExecuteStatus(status),
        (current, total) => setExecuteProgress({ current, total }),
        state.account
      );
      addToast(
        `Payroll executed successfully for ${employees.length} employee${employees.length !== 1 ? "s" : ""}.`,
        "success",
        6000
      );
    } catch (err) {
      addToast("Payroll execution failed: " + err.message, "error");
    } finally {
      setIsExecuting(false);
      setExecuteStatus("");
      setExecuteProgress(null);
    }
  }, [activeCloneAddress, employees, addToast]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-salden-text-primary">HR Dashboard</h1>
        {payrollSetup?.companyName && (
          <p className="text-salden-text-muted text-sm mt-0.5 flex items-center gap-1.5">
            <Buildings size={13} />
            {payrollSetup.companyName}
          </p>
        )}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Employee count */}
        <div className="bg-salden-surface border border-salden-border rounded-2xl p-5">
          <div className="flex items-center gap-2 text-xs text-salden-text-muted mb-2">
            <UsersThree size={13} />
            Total Employees
          </div>
          <div className="text-2xl font-bold text-salden-text-primary">
            {employees.length.toLocaleString()}
          </div>
        </div>

        {/* Gross payroll */}
        <div className="bg-salden-surface border border-salden-border rounded-2xl p-5">
          <div className="flex items-center gap-2 text-xs text-salden-text-muted mb-2">
            <CurrencyDollar size={13} />
            Gross Total Pay
          </div>
          <div className="text-2xl font-bold text-salden-text-primary">
            {totalPayroll.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            <span className="text-sm font-normal text-salden-text-muted">USDC</span>
          </div>
        </div>

        {/* Active contract (clone dropdown) */}
        <div className="col-span-2 bg-salden-surface border border-salden-border rounded-2xl p-5">
          <div className="text-xs text-salden-text-muted mb-2">Active Payroll Contract</div>
          {cloneAddresses.length > 0 ? (
            <div className="relative">
              <button
                onClick={() => setCloneDropdownOpen((p) => !p)}
                className="flex items-center gap-2 text-sm font-mono text-salden-blue hover:text-salden-blue-light transition-colors"
              >
                {activeCloneAddress
                  ? `${truncAddr(activeCloneAddress)} — Payroll ${cloneAddresses.indexOf(activeCloneAddress) + 1}`
                  : "Select contract"}
                <CaretDown
                  size={14}
                  className={`transition-transform ${cloneDropdownOpen ? "rotate-180" : ""}`}
                />
              </button>
              {cloneDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 bg-salden-card border border-salden-border rounded-xl shadow-xl z-20 min-w-[240px] py-1">
                  {cloneAddresses.map((addr, i) => (
                    <button
                      key={addr}
                      onClick={() => {
                        dispatch({ type: "SET_ACTIVE_CLONE", payload: addr });
                        setCloneDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 hover:bg-salden-hover transition-colors ${addr === activeCloneAddress ? "text-salden-blue" : "text-salden-text-secondary"}`}
                    >
                      <span className="text-salden-text-muted text-xs w-16 flex-shrink-0">
                        Payroll {i + 1}
                      </span>
                      <span className="font-mono text-xs">{truncAddr(addr)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <span className="text-sm text-salden-text-muted">No contract deployed</span>
          )}
        </div>
      </div>

      {/* Table toolbar */}
      <div className="bg-salden-surface border border-salden-border rounded-2xl">
        <div className="p-4 border-b border-salden-border flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]" ref={searchRef}>
            <MagnifyingGlass
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-salden-text-muted pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search employees by name or department..."
              className="w-full bg-salden-card border border-salden-border rounded-xl pl-9 pr-4 py-2 text-sm text-salden-text-primary placeholder-salden-text-muted focus:outline-none focus:border-salden-blue/60 transition-colors"
            />
            {showSearchDropdown && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-salden-card border border-salden-border rounded-xl shadow-xl z-20 py-1 max-h-60 overflow-y-auto">
                {searchResults.map(({ emp, idx }) => (
                  <button
                    key={idx}
                    onClick={() => handleSearchSelect(idx)}
                    className="w-full text-left px-4 py-2.5 hover:bg-salden-hover transition-colors flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="text-sm text-salden-text-primary">{emp.fullName}</div>
                      <div className="text-xs text-salden-text-muted">{emp.department}</div>
                    </div>
                    <span className="text-xs text-salden-text-muted font-mono flex-shrink-0">
                      #{idx + 1}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Action buttons */}
          {/* Configure button — shown prominently when no data is set up yet */}
          {(!state.payrollSetup || employees.length === 0) && (
            <button
              onClick={() => setShowConfigModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-salden-blue/10 border border-salden-blue/40 text-salden-blue hover:bg-salden-blue/20 transition-all text-sm font-semibold"
            >
              <FileText size={15} />
              Configure Payroll Data
            </button>
          )}

          <button
            onClick={() => setEmployeeModal({ mode: "add" })}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-salden-surface border border-salden-border text-salden-text-secondary hover:border-salden-blue/50 hover:text-salden-blue transition-all text-sm font-medium"
          >
            <UserPlus size={15} />
            Add Employee
          </button>

          <button
            onClick={handleLoadHistory}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-salden-surface border border-salden-border text-salden-text-secondary hover:border-salden-blue/50 hover:text-salden-blue transition-all text-sm font-medium"
          >
            <ClockCounterClockwise size={15} />
            Payment History
          </button>

          <button
            onClick={handleExecutePayroll}
            disabled={isExecuting || employees.length === 0 || !activeCloneAddress}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-salden-blue to-salden-violet hover:opacity-90 text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20"
          >
            {isExecuting ? (
              <Spinner size={15} className="animate-spin" />
            ) : (
              <Play size={15} weight="fill" />
            )}
            Execute Payments
          </button>
        </div>

        {/* Payroll execution status bar */}
        {isExecuting && (
          <div className="px-4 py-3 bg-salden-blue/5 border-b border-salden-border flex items-center gap-3">
            <Spinner size={14} className="animate-spin text-salden-blue flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-salden-text-secondary">{executeStatus}</p>
              {executeProgress && (
                <div className="mt-1.5">
                  <div className="flex justify-between text-[10px] text-salden-text-muted mb-0.5">
                    <span>
                      Batch {executeProgress.current} of {executeProgress.total}
                    </span>
                    <span>
                      {Math.round(
                        (executeProgress.current / executeProgress.total) * 100
                      )}
                      %
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-salden-border overflow-hidden">
                    <div
                      className="h-full bg-salden-blue rounded-full transition-all duration-500"
                      style={{
                        width: `${(executeProgress.current / executeProgress.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Employee table */}
        <div className="overflow-x-auto">
          {employees.length === 0 ? (
            <div className="py-16 text-center">
              <UsersThree
                size={40}
                className="mx-auto text-salden-text-muted mb-3 opacity-40"
              />
              <p className="text-salden-text-muted text-sm">
                No employees yet. Add your first employee to get started.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm" aria-label="Employee payroll table">
              <thead>
                <tr className="border-b border-salden-border">
                  {["S/N", "Full Name", "Department", "Wallet Address", "Salary (USDC)"].map(
                    (col) => (
                      <th
                        key={col}
                        className="text-left text-xs font-semibold text-salden-text-muted px-5 py-3 whitespace-nowrap"
                      >
                        {col}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-salden-border/50">
                {employees.map((emp, idx) => (
                  <tr
                    key={idx}
                    ref={(el) => (rowRefs.current[idx] = el)}
                    onPointerDown={(e) => handleRowPointerDown(e, idx)}
                    onPointerUp={handleRowPointerUp}
                    onPointerLeave={handleRowPointerUp}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({ x: e.clientX, y: e.clientY, rowIndex: idx });
                    }}
                    className={`group cursor-pointer transition-colors select-none ${
                      highlightedRow === idx
                        ? "bg-salden-blue/10 border-salden-blue/30"
                        : "hover:bg-salden-hover/60"
                    }`}
                    aria-label={`Employee row for ${emp.fullName}`}
                  >
                    <td className="px-5 py-3.5 text-salden-text-muted text-xs font-mono">
                      {idx + 1}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-salden-text-primary whitespace-nowrap">
                      {emp.fullName}
                    </td>
                    <td className="px-5 py-3.5 text-salden-text-secondary whitespace-nowrap">
                      {emp.department}
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (navigator.clipboard) {
                            navigator.clipboard.writeText(emp.walletAddress);
                          }
                        }}
                        className="font-mono text-xs text-salden-text-secondary hover:text-salden-blue transition-colors flex items-center gap-1.5 group/addr"
                        title={emp.walletAddress}
                        aria-label={`Copy wallet address ${emp.walletAddress}`}
                      >
                        {truncAddr(emp.walletAddress)}
                        <CopySimple
                          size={12}
                          className="opacity-0 group-hover/addr:opacity-60 transition-opacity"
                        />
                      </button>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-salden-text-primary whitespace-nowrap">
                      {Number(emp.salaryAmount).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Table footer */}
        {employees.length > 0 && (
          <div className="px-5 py-3 border-t border-salden-border flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-salden-text-muted">
              {employees.length} employee{employees.length !== 1 ? "s" : ""} — Long-press any row for quick actions
            </span>
            <span className="text-xs font-semibold text-salden-text-primary">
              Total:{" "}
              {totalPayroll.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              USDC
            </span>
          </div>
        )}
      </div>

      {/* Row context menu (long press / right-click) */}
      {contextMenu && (
        <div
          className="fixed z-[9999] bg-salden-card border border-salden-border rounded-xl shadow-2xl py-1.5 min-w-[160px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              setEmployeeModal({
                mode: "edit",
                employee: employees[contextMenu.rowIndex],
                rowIndex: contextMenu.rowIndex,
              });
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-salden-text-secondary hover:bg-salden-hover hover:text-salden-text-primary transition-colors"
          >
            <PencilSimple size={14} />
            Edit Row Details
          </button>
          <button
            onClick={() => {
              setDeleteModal(contextMenu.rowIndex);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-950/30 transition-colors"
          >
            <Trash size={14} />
            Delete Row
          </button>
        </div>
      )}

      {/* Modals */}
      {employeeModal && (
        <EmployeeModal
          mode={employeeModal.mode}
          employee={employeeModal.employee}
          rowIndex={employeeModal.rowIndex}
          onSave={employeeModal.mode === "add" ? handleAddEmployee : handleEditEmployee}
          onSaveBulk={handleAddEmployeeBulk}
          onClose={() => setEmployeeModal(null)}
        />
      )}

      {deleteModal !== null && (
        <DeleteModal
          employee={employees[deleteModal]}
          onConfirm={() => handleDeleteEmployee(deleteModal)}
          onClose={() => setDeleteModal(null)}
        />
      )}

      {showConfigModal && (
        <ConfigureModal
          isOpen={showConfigModal}
          onClose={() => setShowConfigModal(false)}
          onComplete={() => setShowConfigModal(false)}
        />
      )}

      {showHistory && (
        <PaymentHistoryModal
          history={payrollHistory}
          isLoading={historyLoading}
          activeClone={activeCloneAddress}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
}
