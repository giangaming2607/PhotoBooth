const fs = require('fs');
let code = fs.readFileSync('src/AdminDashboard.tsx', 'utf8');
const lines = code.split('\n');
// We want to delete line 441 (index 440)
lines.splice(440, 1);
fs.writeFileSync('src/AdminDashboard.tsx', lines.join('\n'));
