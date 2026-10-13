// Shared CARTO SQL helper (server-side only). Key lives in CARTO_KEY env var,
// never shipped to the browser.
const BASE = "https://gcp-europe-west1.api.carto.com";

async function cartoQuery(sql) {
  const key = process.env.CARTO_KEY;
  if (!key) throw new Error("CARTO_KEY not configured");
  const r = await fetch(`${BASE}/v3/sql/carto_dw/query`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ q: sql })
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.rows || [];
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate");
}

module.exports = { cartoQuery, cors };
