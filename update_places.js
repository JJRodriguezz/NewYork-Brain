const fs = require('fs');
let content = fs.readFileSync('mapa.js', 'utf8');
content = content.replace(
    /\{ n: 'Parque Kennedy'.*\n.*Larcomar.*\n.*Huaca.*\n.*Parque del Amor.*\n.*Av\. Larco.*\n.*Costa Verde.*/g,
    `{ n: 'Central Park', busca: /central park/i, ll: [-73.9654, 40.7829], z: 14.0, b: -20, capas: ['cultura', 'verdes'] },
    { n: 'Times Square', busca: /times square/i, ll: [-73.9851, 40.7580], z: 16.4, b: 60, pitch: 66, capas: ['cultura', 'comercio'] },
    { n: 'Empire State', busca: /empire state/i, ll: [-73.9857, 40.7484], z: 16.5, b: 0, capas: ['patrimonio', 'comercio'] },
    { n: 'Statue of Liberty', busca: /statue of liberty/i, ll: [-74.0445, 40.6892], z: 16.6, b: 90, pitch: 68, capas: ['cultura', 'verdes'] },
    { n: 'Broadway', ll: [-73.9870, 40.7590], z: 15.2, b: -12, pitch: 62, capas: ['metro', 'comercio'] },
    { n: 'Brooklyn Bridge', ll: [-73.9969, 40.7061], z: 15, b: 120, pitch: 70, capas: ['tsunami', 'verdes'] },`
);
fs.writeFileSync('mapa.js', content);
