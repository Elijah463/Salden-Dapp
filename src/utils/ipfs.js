/**
 * ipfs.js
 * Pinata IPFS integration for encrypted payroll data persistence.
 * All data is encrypted client-side BEFORE being uploaded.
 * Pinata only ever receives ciphertext — zero plaintext exposure.
 */

const PINATA_JWT = import.meta.env.VITE_PINATA_JWT;
const PINATA_UPLOAD_URL = "https://api.pinata.cloud/pinning/pinJSONToIPFS";
const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs";

if (!PINATA_JWT) {
  console.warn("VITE_PINATA_JWT is not set. IPFS sync will be unavailable.");
}

/**
 * Uploads an encrypted blob to IPFS via Pinata.
 * @param {string} encryptedBlob - Base64-encoded ciphertext from encryption.js
 * @param {string} employerAddress - Used as a metadata label only
 * @returns {Promise<string>} The IPFS CID (content identifier)
 */
export async function uploadToIPFS(encryptedBlob, employerAddress) {
  if (!PINATA_JWT) throw new Error("Pinata JWT is not configured.");

  const payload = {
    pinataContent: {
      v: 1,
      data: encryptedBlob,
    },
    pinataMetadata: {
      name: `salden-payroll-${employerAddress.toLowerCase().slice(0, 10)}`,
      keyvalues: {
        app: "salden",
        owner: employerAddress.toLowerCase(),
        updatedAt: new Date().toISOString(),
      },
    },
    pinataOptions: {
      cidVersion: 1,
    },
  };

  const response = await fetch(PINATA_UPLOAD_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PINATA_JWT}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Pinata upload failed (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  return result.IpfsHash; // This is the CID
}

/**
 * Fetches an encrypted blob from IPFS by CID.
 * @param {string} cid - IPFS Content Identifier
 * @returns {Promise<string>} Base64-encoded ciphertext
 */
export async function fetchFromIPFS(cid) {
  if (!cid || typeof cid !== "string" || cid.trim() === "") {
    throw new Error("Invalid CID provided.");
  }

  // Sanitize CID — allow only alphanumeric + base58 characters
  const sanitizedCid = cid.trim().replace(/[^a-zA-Z0-9]/g, "");
  if (sanitizedCid.length < 10) throw new Error("CID appears invalid.");

  const url = `${IPFS_GATEWAY}/${sanitizedCid}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`IPFS fetch failed (${response.status}). The data may not yet be available.`);
  }

  const result = await response.json();

  if (!result.data || typeof result.data !== "string") {
    throw new Error("IPFS response is malformed or corrupted.");
  }

  return result.data;
}
