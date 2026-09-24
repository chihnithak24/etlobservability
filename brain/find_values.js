const fs = require('fs');
const content = fs.readFileSync('frontend/src/pages/Analytics.jsx', 'utf8');
const lines = content.split(/\r?\n/);
lines.forEach((line, i) => {
  if (
    line.includes('{value}') ||
    line.includes('{stat.value}') ||
    line.includes('{item.value}') ||
    line.includes('{count}') ||
    (line.includes('fontWeight: 800') && (line.includes('fontSize: 2') || line.includes('fontSize: 3')))
  ) {
    console.log(`${i + 1}: ${line.trim()}`);
  }
});
