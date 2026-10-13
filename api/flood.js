// Serverless proxy to the Environment Agency "Risk of Flooding from Rivers and Sea"
// ArcGIS FeatureServer. The EA endpoint does not emit Access-Control-Allow-Origin,
// so browsers block direct fetches; this proxies server-side and adds CORS.
const EA_BASE = "https://environment.data.gov.uk/KB6uNVj5ZcJr7jUP/ArcGIS/rest/services/RiskOfFloodingFromRiversAndSea/FeatureServer/0/query";

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  const E = parseFloat(req.query.E), N = parseFloat(req.query.N);
  const pad = Math.min(Math.max(parseFloat(req.query.pad) || 900, 100), 5000);
  if (!isFinite(E) || !isFinite(N)) {
    res.status(400).json({ error: "E and N (British National Grid) query params required" });
    return;
  }
  const geometry = [E, N, E + pad, N + pad].join(",");
  const url = EA_BASE +
    "?where=1%3D1&geometry=" + encodeURIComponent(geometry) +
    "&geometryType=esriGeometryEnvelope&inSR=27700&spatialRel=esriSpatialRelIntersects" +
    "&outFields=prob_4band,suitability&returnGeometry=false&f=json";

  try {
    const upstream = await fetch(url, { headers: { "User-Agent": "ResilienceUK/1.0" } });
    const data = await upstream.json();
    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate");
    res.status(200).json({ ok: true, source: "EA live (via proxy)", count: (data.features || []).length, features: (data.features || []).map(f => f.attributes) });
  } catch (e) {
    res.status(502).json({ ok: false, error: String(e), features: [] });
  }
};
