// Funciones puras: sin APIs, sin datos sintéticos y sin imputar valores ausentes.
(function (root) {
  const valido = v => typeof v === 'number' && Number.isFinite(v);
  function percentil(v, valores) {
    const a = valores.filter(valido);
    if (!valido(v) || !a.length) return null;
    if (a.length === 1) return 50;
    const menores = a.filter(x => x < v).length, iguales = a.filter(x => x === v).length;
    return (menores + (iguales - 1) / 2) / (a.length - 1) * 100;
  }
  function indice(d, pesos) {
    let suma = 0, total = 0;
    for (const [k, w] of Object.entries(pesos)) {
      if (!valido(w) || w < 0) return null;
      if (!w) continue;
      if (!valido(d['_p_' + k])) return null;
      suma += d['_p_' + k] * w; total += w;
    }
    return total ? suma / total : null;
  }
  function diferencia(a, b) {
    if (!valido(a) || !valido(b)) return { absoluta: null, porcentaje: null };
    return { absoluta: b - a, porcentaje: a === 0 ? null : (b - a) / a * 100 };
  }
  function anillo(p, r) {
    let dentro = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [x, y] = r[i], [u, v] = r[j];
      if ((y > p[1]) !== (v > p[1]) && p[0] < (u - x) * (p[1] - y) / (v - y) + x) dentro = !dentro;
    }
    return dentro;
  }
  function contiene(p, geometria) {
    const polys = geometria.type === 'Polygon' ? [geometria.coordinates] : geometria.type === 'MultiPolygon' ? geometria.coordinates : [];
    return polys.some(poly => anillo(p, poly[0]) && !poly.slice(1).some(r => anillo(p, r)));
  }
  function distancia(a, b) {
    const rad = x => x * Math.PI / 180, dlat = rad(b[1] - a[1]), dlon = rad(b[0] - a[0]);
    const h = Math.sin(dlat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dlon / 2) ** 2;
    return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
  }
  function circulo(p, metros) {
    const lat = p[1] * Math.PI / 180, lon = p[0] * Math.PI / 180, d = metros / 6371000;
    const r = Array.from({ length: 65 }, (_, i) => {
      const t = i * 2 * Math.PI / 64;
      const y = Math.asin(Math.sin(lat) * Math.cos(d) + Math.cos(lat) * Math.sin(d) * Math.cos(t));
      const x = lon + Math.atan2(Math.sin(t) * Math.sin(d) * Math.cos(lat), Math.cos(d) - Math.sin(lat) * Math.sin(y));
      return [x * 180 / Math.PI, y * 180 / Math.PI];
    });
    r[64] = r[0];
    return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [r] } }] };
  }
  const api = { valido, percentil, indice, diferencia, contiene, distancia, circulo };
  root.ANALISIS = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
