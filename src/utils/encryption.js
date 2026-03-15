/**
 * encryption.js
 * AES-256-GCM client-side encryption.
 * The encryption key is deterministically derived from the user's wallet
 * signature — no passwords, no servers. Only the wallet owner can decrypt.
 */

const SIGNING_MESSAGE = (address) =>
  `Salden: Authorize data encryption\n\nWallet: ${address}\n\nThis signature derives your local encryption key. It is never transmitted and is used only to secure your payroll data.`;

/**
 * Derives a 256-bit AES-GCM key from the wallet signature.
 * Uses PBKDF2 with SHA-256 and 100,000 iterations for key stretching.
 * @param {string} signature - Hex signature from wallet
 * @param {string} address - Wallet address (used as PBKDF2 salt)
 * @returns {Promise<CryptoKey>}
 */
export async function deriveKeyFromSignature(signature, address) {
  const encoder = new TextEncoder();
  const sigBytes = encoder.encode(signature);
  const saltBytes = encoder.encode(address.toLowerCase());

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    sigBytes,
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Converts a Uint8Array to a Base64 string safely without using spread,
 * which would cause a stack overflow for large payloads via
 * String.fromCharCode(...largeArray).
 *
 * Processes in 8 KB chunks to stay well within all call-stack limits.
 *
 * @param {Uint8Array} bytes
 * @returns {string} Base64-encoded string
 */
function uint8ArrayToBase64(bytes) {
  const CHUNK = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * Encrypts a JavaScript object using AES-256-GCM.
 * A random 96-bit IV is prepended to the ciphertext.
 * @param {CryptoKey} key
 * @param {object} data - Plain JS object
 * @returns {Promise<string>} Base64-encoded IV + ciphertext
 */
export async function encryptData(key, data) {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
  const plaintext = encoder.encode(JSON.stringify(data));

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext
  );

  // Concatenate IV (12 bytes) + ciphertext
  const combined = new Uint8Array(12 + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), 12);

  // Use chunked conversion — safe for arbitrarily large payloads
  return uint8ArrayToBase64(combined);
}

/**
 * Decrypts a Base64-encoded blob (IV + AES-256-GCM ciphertext) back to an object.
 * @param {CryptoKey} key
 * @param {string} base64Blob - Output of encryptData()
 * @returns {Promise<object>}
 */
export async function decryptData(key, base64Blob) {
  const combined = Uint8Array.from(atob(base64Blob), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(decrypted));
}

/**
 * Returns the standard signing message for a given wallet address.
 * @param {string} address
 * @returns {string}
 */
export function getSigningMessage(address) {
  return SIGNING_MESSAGE(address);
}
