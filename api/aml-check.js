/**
 * api/aml-check.js
 * Vercel serverless proxy for Scorechain AML API.
 *
 * Why this exists:
 * Scorechain's API does not send CORS headers, so browsers cannot call it
 * directly. This function runs server-side on Vercel and proxies the request
 * on behalf of the browser — no CORS restriction applies server-to-server.
 *
 * Usage: GET /api/aml-check?address=0x...
 */

export default async function handler(req, res) {
  const { address } = req.query;

  if (!address || typeof address !== "string" || !address.trim()) {
    return res.status(400).json({ error: "Missing or invalid address parameter." });
  }

  const apiKey = process.env.SCORECHAIN_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "AML service not configured on server." });
  }

  try {
    const upstream = await fetch(
      `https://sanctions.api.scorechain.com/v1/entity/check?address=${encodeURIComponent(address.trim())}`,
      {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: "AML service unreachable: " + err.message });
  }
}
