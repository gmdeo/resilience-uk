// Real road network near a point, via CARTO + Overture Maps transportation (public).
// GET /api/roads?lat=..&lng=..&radius=3000  -> nearest road, arterial distance, road class mix
const { cartoQuery, cors } = require("./_carto.js");
const TABLE = "`carto-do-public-data`.overture.geography_glo_transportationsegment_v3";
const ARTERIAL = "('motorway','trunk','primary','secondary')";

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  const lat = parseFloat(req.query.lat), lng = parseFloat(req.query.lng);
  const radius = Math.min(Math.max(parseFloat(req.query.radius) || 3000, 500), 10000);
  if (!isFinite(lat) || !isFinite(lng)) { res.status(400).json({ error: "lat & lng required" }); return; }

  const pt = `ST_GEOGPOINT(${lng}, ${lat})`;
  const sql = `
    SELECT geoid, ROUND(ST_DISTANCE(geom, ${pt}),1) AS dist_m, class, subtype,
      ROUND(ST_Y(ST_CENTROID(geom)),6) AS lat, ROUND(ST_X(ST_CENTROID(geom)),6) AS lon,
      ST_ASGEOJSON(ST_SIMPLIFY(geom, 2)) AS gjson
    FROM ${TABLE}
    WHERE ST_DWITHIN(geom, ${pt}, ${radius})
    ORDER BY dist_m ASC
    LIMIT 300`;
  try {
    const rows = await cartoQuery(sql);
    const nearest = rows[0] || null;
    const arterial = rows.find(r => ARTERIAL.includes(`'${r.class}'`)) || null;
    // road density (segments per km^2) as a connectivity/accessibility proxy
    const density = rows.length / (Math.PI * Math.pow(radius / 1000, 2));
    res.status(200).json({
      ok: true, source: "CARTO · Overture Maps (transportation v3)",
      count: rows.length,
      nearestRoad: nearest,
      nearestArterial: arterial,
      roadDensity: Math.round(density * 100) / 100,
      roads: rows.slice(0, 100)
    });
  } catch (e) {
    res.status(502).json({ ok: false, error: String(e), roads: [] });
  }
};
