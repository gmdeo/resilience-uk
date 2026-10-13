// Real building footprints near a point, via CARTO + Overture Maps (public).
// GET /api/buildings?lat=..&lng=..&radius=1000  (radius metres, <=3000)
const { cartoQuery, cors } = require("./_carto.js");
const TABLE = "`carto-do-public-data`.overture.geography_glo_building_v3";

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  const lat = parseFloat(req.query.lat), lng = parseFloat(req.query.lng);
  const radius = Math.min(Math.max(parseFloat(req.query.radius) || 1000, 100), 3000);
  if (!isFinite(lat) || !isFinite(lng)) { res.status(400).json({ error: "lat & lng required" }); return; }

  const pt = `ST_GEOGPOINT(${lng}, ${lat})`;
  const sql = `
    SELECT
      geoid,
      ROUND(ST_AREA(geom)) AS area_m2,
      ROUND(ST_Y(ST_CENTROID(geom)),6) AS lat,
      ROUND(ST_X(ST_CENTROID(geom)),6) AS lon,
      ROUND(ST_DISTANCE(geom, ${pt}),1) AS dist_m,
      height,
      num_floors AS floors,
      class,
      ST_ASGEOJSON(ST_SIMPLIFY(geom, 2)) AS gjson
    FROM ${TABLE}
    WHERE ST_DWITHIN(geom, ${pt}, ${radius})
    ORDER BY dist_m ASC
    LIMIT 400`;
  try {
    const rows = await cartoQuery(sql);
    // aggregate stats for the engine
    const n = rows.length;
    const totalArea = rows.reduce((s, r) => s + (r.area_m2 || 0), 0);
    const meanArea = n ? Math.round(totalArea / n) : 0;
    const meanDist = n ? Math.round(rows.reduce((s, r) => s + (r.dist_m || 0), 0) / n) : 0;
    const built = Math.min(1, totalArea / (radius * radius * Math.PI) * 8); // density proxy
    // draw only the nearest ~120 footprints to the map for responsiveness
    res.status(200).json({
      ok: true, source: "CARTO · Overture Maps (buildings v3)", count: n,
      stats: { count: n, totalArea, meanArea, meanDist, density: Math.round(built * 100) / 100 },
      buildings: rows.slice(0, 120)
    });
  } catch (e) {
    res.status(502).json({ ok: false, error: String(e), buildings: [] });
  }
};
