/**
 * indexeddb.js
 * IndexedDB wrapper using the `idb` library.
 *
 * SINGLETON PATTERN: The module stores the openDB() Promise (not the
 * resolved DB instance) so concurrent callers all await the same promise.
 * Storing the resolved instance instead would cause a race condition where
 * two simultaneous callers (e.g. loadData + savePayrollData on mount) both
 * see _db === null, both call openDB(), and the second call races against
 * the upgrade transaction of the first.
 */

import { openDB } from "idb";

const DB_NAME = "salden-payroll";
const DB_VERSION = 1;

// Store names
export const STORES = {
  PAYROLL_DATA: "payrollData",
  META: "meta",
};

// Store the Promise, not the resolved value — race-condition-safe
let _dbPromise = null;

function getDB() {
  if (!_dbPromise) {
    _dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Payroll data: keyed by lower-cased wallet address
        if (!db.objectStoreNames.contains(STORES.PAYROLL_DATA)) {
          db.createObjectStore(STORES.PAYROLL_DATA, { keyPath: "walletAddress" });
        }
        // Meta: arbitrary key-value pairs (last synced CID, etc.)
        if (!db.objectStoreNames.contains(STORES.META)) {
          db.createObjectStore(STORES.META, { keyPath: "key" });
        }
      },
      // If openDB itself fails, clear the promise so callers can retry
      blocked() {
        console.warn("[IndexedDB] Upgrade blocked by an open tab.");
      },
      blocking() {
        console.warn("[IndexedDB] This tab is blocking a newer version.");
      },
    });
    // On failure, clear so the next call retries fresh
    _dbPromise.catch(() => { _dbPromise = null; });
  }
  return _dbPromise;
}

// ─── Payroll Data ─────────────────────────────────────────────────────────────

/**
 * Retrieves the full payroll data payload for a given employer wallet.
 * Returns null if no cached data exists.
 * @param {string} walletAddress
 * @returns {Promise<object|null>}
 */
export async function getPayrollData(walletAddress) {
  const db = await getDB();
  const record = await db.get(STORES.PAYROLL_DATA, walletAddress.toLowerCase());
  return record ?? null;
}

/**
 * Upserts the full payroll data payload for an employer.
 * Always normalises the key to lowercase.
 * @param {string} walletAddress
 * @param {object} data
 */
export async function savePayrollData(walletAddress, data) {
  const db = await getDB();
  await db.put(STORES.PAYROLL_DATA, {
    ...data,
    walletAddress: walletAddress.toLowerCase(),
  });
}

/**
 * Removes all locally cached payroll data for an employer (on logout).
 * @param {string} walletAddress
 */
export async function clearPayrollData(walletAddress) {
  const db = await getDB();
  await db.delete(STORES.PAYROLL_DATA, walletAddress.toLowerCase());
}

// ─── Meta Store ───────────────────────────────────────────────────────────────

/**
 * Returns a meta value by key, or null if not set.
 * @param {string} key
 * @returns {Promise<any|null>}
 */
export async function getMeta(key) {
  const db = await getDB();
  const record = await db.get(STORES.META, key);
  return record ? record.value : null;
}

/**
 * Sets a meta value.
 * @param {string} key
 * @param {any} value
 */
export async function setMeta(key, value) {
  const db = await getDB();
  await db.put(STORES.META, { key, value });
}

/**
 * Deletes a meta value.
 * @param {string} key
 */
export async function deleteMeta(key) {
  const db = await getDB();
  await db.delete(STORES.META, key);
}
