const fs = require('fs');
const path = require('path');

const pagesDir = 'frontend/src/pages';
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.jsx'));

files.forEach(f => {
  const content = fs.readFileSync(path.join(pagesDir, f), 'utf8');
  const lines = content.split(/\r?\n/);
  lines.forEach((l, i) => {
    if (l.includes('#e2e8f0') || l.includes('#f1f5f9')) {
      console.log(`${f}:${i+1}: ${l.trim()}`);
    }
  });
});
