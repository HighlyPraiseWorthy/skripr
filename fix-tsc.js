const fs = require('fs');
const p = require('path');
const bin = p.join(__dirname, 'node_modules', '.bin', 'tsc');
try { fs.unlinkSync(bin); } catch(e) {}
fs.symlinkSync(p.join(__dirname, 'node_modules', 'typescript', 'bin', 'tsc'), bin);
console.log('Fixed tsc symlink');
