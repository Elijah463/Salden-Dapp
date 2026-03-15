/**
 * validation.js
 * Input sanitization and validation for all user-facing forms.
 * Follows OWASP input validation guidelines.
 * Never trust user input — sanitize everything on entry.
 */

// ─── Sanitization ─────────────────────────────────────────────────────────────

/**
 * Strips HTML/script tags and normalizes whitespace.
 * @param {string} input
 * @returns {string}
 */
export function sanitizeString(input) {
  if (typeof input !== "string") return "";
  return input
    .replace(/<[^>]*>/g, "") // Strip HTML tags
    .replace(/[<>"'&]/g, (char) => {
      const map = { "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;", "&": "&amp;" };
      return map[char];
    })
    .trim()
    .slice(0, 500); // Hard cap to prevent payload attacks
}

/**
 * Sanitizes a number input (salary, amounts, etc.).
 * @param {string|number} input
 * @returns {number|null}
 */
export function sanitizeAmount(input) {
  const num = parseFloat(String(input).replace(/[^0-9.]/g, ""));
  if (isNaN(num) || num < 0 || num > 1_000_000_000) return null;
  return Math.round(num * 100) / 100; // Cap to 2 decimal places
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validates an Ethereum wallet address.
 * @param {string} address
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateWalletAddress(address) {
  if (!address || typeof address !== "string") {
    return { valid: false, error: "Wallet address is required." };
  }
  const trimmed = address.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
    return { valid: false, error: "Invalid Ethereum wallet address format." };
  }
  return { valid: true };
}

/**
 * Validates a full name (letters, spaces, hyphens, apostrophes only).
 * @param {string} name
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateFullName(name) {
  if (!name || typeof name !== "string" || name.trim().length < 2) {
    return { valid: false, error: "Full name must be at least 2 characters." };
  }
  if (name.trim().length > 100) {
    return { valid: false, error: "Name is too long (max 100 characters)." };
  }
  if (!/^[a-zA-Z\s\-'\.]+$/.test(name.trim())) {
    return { valid: false, error: "Name contains invalid characters." };
  }
  return { valid: true };
}

/**
 * Validates a department name.
 * @param {string} dept
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateDepartment(dept) {
  if (!dept || typeof dept !== "string" || dept.trim().length < 1) {
    return { valid: false, error: "Department is required." };
  }
  if (dept.trim().length > 100) {
    return { valid: false, error: "Department name is too long." };
  }
  if (!/^[a-zA-Z0-9\s\-_&\/\.]+$/.test(dept.trim())) {
    return { valid: false, error: "Department contains invalid characters." };
  }
  return { valid: true };
}

/**
 * Validates a salary amount.
 * @param {string|number} amount
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateSalaryAmount(amount) {
  const num = sanitizeAmount(amount);
  if (num === null) {
    return { valid: false, error: "Salary must be a positive number." };
  }
  if (num <= 0) {
    return { valid: false, error: "Salary must be greater than zero." };
  }
  if (num > 10_000_000) {
    return { valid: false, error: "Salary amount exceeds maximum allowed." };
  }
  return { valid: true };
}

/**
 * Validates a complete employee record.
 * @param {{ fullName: string, department: string, walletAddress: string, salaryAmount: number }} employee
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateEmployee(employee) {
  const errors = [];
  const nameResult = validateFullName(employee.fullName);
  if (!nameResult.valid) errors.push(nameResult.error);

  const deptResult = validateDepartment(employee.department);
  if (!deptResult.valid) errors.push(deptResult.error);

  const addrResult = validateWalletAddress(employee.walletAddress);
  if (!addrResult.valid) errors.push(addrResult.error);

  const salaryResult = validateSalaryAmount(employee.salaryAmount);
  if (!salaryResult.valid) errors.push(salaryResult.error);

  return { valid: errors.length === 0, errors };
}

// ─── File Validation ──────────────────────────────────────────────────────────

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Validates a file by size and type signature (NOT just extension).
 * Commandment 20: validate by file signature, not extension.
 * @param {File} file
 * @returns {{ valid: boolean, type?: "csv"|"json", error?: string }}
 */
export async function validateEmployeeFile(file) {
  if (!file) return { valid: false, error: "No file selected." };

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: "File exceeds the maximum allowed size of 5 MB." };
  }

  // Read first 4 bytes to check file signature
  const buffer = await file.slice(0, 4).arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // CSV: all first bytes should be printable ASCII (0x20–0x7E, tab, newline)
  // JSON: first non-whitespace byte should be '{' (0x7B) or '[' (0x5B)
  const ext = file.name.split(".").pop().toLowerCase();

  if (ext === "json") {
    const firstChars = new TextDecoder().decode(bytes).trim();
    if (!firstChars.startsWith("{") && !firstChars.startsWith("[")) {
      return { valid: false, error: "File signature does not match JSON format." };
    }
    return { valid: true, type: "json" };
  }

  if (ext === "csv") {
    // CSV: check that initial bytes are printable ASCII
    const isPrintable = bytes.every((b) => b >= 0x09 && b <= 0x7e);
    if (!isPrintable) {
      return { valid: false, error: "File signature does not match CSV format." };
    }
    return { valid: true, type: "csv" };
  }

  return {
    valid: false,
    error: "Only CSV or JSON files are accepted.",
  };
}

/**
 * Detects duplicate wallet addresses in an employee array.
 * @param {Array<{walletAddress: string}>} employees
 * @returns {Array<{address: string, indices: number[]}>} Array of duplicates
 */
export function findDuplicateWallets(employees) {
  const seen = new Map();
  employees.forEach((emp, idx) => {
    const addr = emp.walletAddress?.toLowerCase();
    if (!addr) return;
    if (!seen.has(addr)) {
      seen.set(addr, []);
    }
    seen.get(addr).push(idx + 1); // 1-based row number
  });

  const duplicates = [];
  for (const [address, rows] of seen.entries()) {
    if (rows.length > 1) {
      duplicates.push({ address, rows });
    }
  }
  return duplicates;
}

/**
 * Normalizes raw CSV/JSON rows into a consistent employee object shape.
 * Expected columns: FullName, Department, Wallet Address, Salary Amount
 * @param {Array<object>} rows - Raw parsed rows
 * @returns {Array<object>} Normalized employee objects
 */
export function normalizeEmployeeRows(rows) {
  return rows.map((row) => {
    // Flexible key matching (case-insensitive, handle spacing variations)
    const get = (keys) => {
      for (const key of keys) {
        const found = Object.keys(row).find(
          (k) => k.toLowerCase().replace(/\s+/g, "") === key.toLowerCase().replace(/\s+/g, "")
        );
        if (found !== undefined) return row[found];
      }
      return "";
    };

    return {
      fullName: sanitizeString(get(["FullName", "full_name", "name", "Name"])),
      department: sanitizeString(get(["Department", "department", "dept", "Dept"])),
      walletAddress: get(["WalletAddress", "wallet_address", "wallet", "Wallet", "Address", "address"])
        ?.trim() ?? "",
      salaryAmount: sanitizeAmount(
        get(["SalaryAmount", "salary_amount", "salary", "Salary", "Amount", "amount"])
      ) ?? 0,
    };
  });
}
