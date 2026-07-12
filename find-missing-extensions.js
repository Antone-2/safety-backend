const fs = require('fs');
const files = [];
function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = dir + '/' + f;
    if (fs.statSync(p).isDirectory()) {
      if (f !== 'node_modules' && f !== 'dist') walk(p);
    } else if (f.endsWith('.ts')) {
      files.push(p);
    }
  }
}
walk('src');
let count = 0;
for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  const lines = c.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^import\s+.*\s+from\s+["']\.\.?\/.*["']/);
    if (m) {
      const from = m[0].match(/from\s+["']([^"']+)["']/)[1];
      if (!from.endsWith('.js')) {
        count++;
        if (count <= 20) console.log(f + ':' + (i + 1) + ' ' + from);
      }
    }
  }
}
console.log('Total missing extensions:', count);
