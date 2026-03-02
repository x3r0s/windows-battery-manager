const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'node_modules', 'chart.js', 'dist', 'chart.umd.js');
const dest = path.join(__dirname, '..', 'src', 'renderer', 'lib', 'chart.umd.js');

if (fs.existsSync(src)) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log('chart.js copied to src/renderer/lib/');
} else {
  console.warn('chart.js not found in node_modules — skipping copy');
}
