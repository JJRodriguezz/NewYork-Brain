const assert = require('node:assert/strict');
const fs = require('node:fs');
const A = require('../js/analisis.js');
assert.equal(A.percentil(10,[10,10,20]),25);
assert.equal(A.percentil(20,[10,10,20]),100);
assert.equal(A.percentil(null,[10,20]),null);
assert.equal(A.percentil(5,[5,5,5]),50);
assert.equal(A.indice({_p_a:10,_p_b:90},{a:3,b:1}),30);
assert.equal(A.indice({_p_a:10},{a:0}),null);
assert.equal(A.indice({_p_a:10},{a:1,b:1}),null);
assert.equal(A.diferencia(0,10).porcentaje,null);
assert.equal(A.diferencia(100,90).porcentaje,-10);
const hole={type:'Polygon',coordinates:[[[0,0],[4,0],[4,4],[0,4],[0,0]],[[1,1],[3,1],[3,3],[1,3],[1,1]]]};
assert(A.contiene([0.5,0.5],hole)); assert(!A.contiene([2,2],hole));
assert.equal(A.distancia([0,0],[0,0]),0);
const p=[-73.9855,40.7580];
const g=JSON.parse(fs.readFileSync('lago/geo/distritos_puma.geojson'));
assert.equal(g.features.find(f=>A.contiene(p,f.geometry)).properties.puma,'4165');
const circle=A.circulo(p,1000).features[0].geometry.coordinates[0];
assert.deepEqual(circle[0],circle.at(-1));
for(const q of circle) assert(Math.abs(A.distancia(p,q)-1000)<0.001);
const stations=JSON.parse(fs.readFileSync('lago/geo/estaciones.geojson')).features;
const count=r=>stations.filter(f=>A.distancia(p,f.geometry.coordinates)<=r).length;
assert(count(500)<=count(1000) && count(1000)<=count(2000));
// incertidumbre: con márgenes de error cero, el intervalo es un solo puesto; con márgenes enormes, se abre
const F=[{puma:'a',x:1,m:0},{puma:'b',x:2,m:0},{puma:'c',x:3,m:0}];
let R=A.rangosConError(F,{d:{k:'x',moe:'m'}},{d:1},{n:50});
assert.deepEqual([R.c.desde,R.c.hasta,R.a.desde,R.a.hasta],[1,1,3,3]);
assert.equal(A.grupos(R).length,3);
const F2=F.map(f=>({...f,m:50}));
R=A.rangosConError(F2,{d:{k:'x',moe:'m'}},{d:1},{n:300});
assert(R.a.desde===1 && R.a.hasta===3); assert.equal(A.grupos(R).length,1);
assert.deepEqual(A.rangosConError(F2,{d:{k:'x',moe:'m'}},{d:1},{n:300}),R); // reproducible con la misma semilla
assert.equal(A.rangosConError([{puma:'a',x:null}],{d:{k:'x'}},{d:1}),null);
// Benjamini-Hochberg contra el ejemplo de referencia: p=[.01,.04,.03,.005] → q=[.02,.04,.04,.02]
assert.deepEqual(A.benjaminiHochberg([.01,.04,.03,.005]).map(x=>+x.toFixed(4)),[.02,.04,.04,.02]);
console.log('OK: percentiles, ausencia de datos, pesos, cambios, geometrías y radios con lago real, rangos con margen de error, grupos y Benjamini-Hochberg.');
