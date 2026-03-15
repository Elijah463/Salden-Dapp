/**
 * rateLimiter.js
 * Client-side rate limiting using localStorage timestamps.
 * Commandments 14, 15: Apply rate limits to every front-end endpoint.
 *
 * NOTE: Client-side rate limiting is a UX safeguard and compliance measure.
 * It is not a substitute for server-side rate limiting, but is the correct
 * approach for a fully decentralized frontend-only dapp.
 */

const STORAGE_KEY = "salden_rate_limits";

/**
 * Reads the rate limit store from localStorage.
 * @returns {object}
 */
function getStore() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

/**
 * Saves the rate limit store to localStorage.
 * @param {object} store
 */
function saveStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Storage may be full or restricted — fail silently
  }
}

/**
 * Checks if an action is rate-limited and records the attempt if not.
 * @param {string} action - Unique action identifier (e.g. "pinata_upload")
 * @param {number} maxRequests - Maximum requests allowed in the window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {{ allowed: boolean, remainingMs?: number }}
 */
export function checkRateLimit(action, maxRequests, windowMs) {
  const store = getStore();
  const now = Date.now();

  if (!store[action]) {
    store[action] = [];
  }

  // Remove expired timestamps
  store[action] = store[action].filter((ts) => now - ts < windowMs);

  if (store[action].length >= maxRequests) {
    const oldestTs = Math.min(...store[action]);
    const remainingMs = windowMs - (now - oldestTs);
    return { allowed: false, remainingMs };
  }

  store[action].push(now);
  saveStore(store);
  return { allowed: true };
}

/**
 * Resets rate limit data for a specific action.
 * @param {string} action
 */
export function resetRateLimit(action) {
  const store = getStore();
  delete store[action];
  saveStore(store);
}

// ─── Preconfigured Limiters ──────────────────────────────────────────────────

/**
 * Rate limiter for Pinata IPFS uploads: max 20 per hour.
 */
export function checkPinataUploadLimit() {
  return checkRateLimit("pinata_upload", 20, 60 * 60 * 1000);
}

/**
 * Rate limiter for Scorechain AML calls: max 200 per hour (safe for free tier).
 */
export function checkScorechainLimit() {
  return checkRateLimit("scorechain_check", 200, 60 * 60 * 1000);
}

/**
 * Rate limiter for payroll execution: max 10 per hour per user.
 */
export function checkPayrollExecutionLimit() {
  return checkRateLimit("payroll_execute", 10, 60 * 60 * 1000);
}

/**
 * Rate limiter for registry writes: max 30 per hour.
 */
export function checkRegistryWriteLimit() {
  return checkRateLimit("registry_write", 30, 60 * 60 * 1000);
}

/**
 * General API limiter: 100 requests per hour (baseline per commandment 15).
 * @param {string} key - Unique key for the action
 */
export function checkGeneralApiLimit(key) {
  return checkRateLimit(`api_${key}`, 100, 60 * 60 * 1000);
}

/**
 * Formats a remaining time in milliseconds into a human-readable string.
 * @param {number} ms
 * @returns {string}
 */
export function formatRemainingTime(ms) {
  if (ms <= 0) return "now";
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds} second${seconds !== 1 ? "s" : ""}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
}
