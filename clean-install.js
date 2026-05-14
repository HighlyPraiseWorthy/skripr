const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const nmPath = path.join(__dirname, 'node_modules');

// Recursively delete node_modules
function removeDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.readdirSync(dirPath).forEach(entry => {
      const fullPath = path.join(dirPath, entry);
      const stat = fs.lstatSync(fullPath);
      if (stat.isDirectory() && !stat.isSymbolicLink()) {
        removeDir(fullPath);
      } else {
        fs.unlinkSync(fullPath);
      }
    });
    fs.rmdirSync(dirPath);
  }
}

console.log('Removing node_modules...');
removeDir(nmPath);
console.log('Removed.');

// Also remove package-lock
const lockPath = path.join(__dirname, 'package-lock.json');
if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);

console.log('Running npm install...');
try {
  const result = execSync('npm install', { cwd: __dirname, encoding: 'utf8', timeout: 180000 });
  console.log(result.slice(-500));
  console.log('Done!');
} catch(e) {
  console.error('Install failed:', e.message);
}
