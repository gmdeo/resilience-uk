// Serverless proxy for NESO Grid Supply Point locations (CKAN datastore).
// api.neso.energy is CORS-open, but this proxy gives us a resilient same-origin
// fallback and a single cached copy for all clients.
const RESOURCE = "000d08b9-12d9-4396-95f8-6b3677664836"; // FES 2022 Grid Supply Point Info
const URL = `https://api.neso.energy/api/3/action/datastore_search?resource_id=${RESOURCE}&limit=500`;

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  try {
    const r = await fetch(URL, { headers: { "User-Agent": "ResilienceUK/1.0" } });
    const j = await r.json();
    const recs = (j.result && j.result.records) || [];
    const points = recs
      .map(x => ({ id: x["GSP ID"], name: x.Name, group: x["GSP Group"], flop: x["Minor FLOP"], lat: parseFloat(x.Latitude), lon: parseFloat(x.Longitude) }))
      .filter(p => isFinite(p.lat) && isFinite(p.lon));
    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate");
    res.status(200).json({ ok: true, source: "NESO live (via proxy)", count: points.length, points });
  } catch (e) {
    res.status(502).json({ ok: false, error: String(e), points: [] });
  }
};
