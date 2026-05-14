const fs = require('fs');
const path = require('path');

const binDir = path.join(__dirname, 'node_modules', '.bin');
const files = fs.readdirSync(binDir);

let fixed = 0;
for (const file of files) {
  const binPath = path.join(binDir, file);
  const stat = fs.lstatSync(binPath);
  
  if (stat.isSymbolicLink()) {
    try {
      // Check if symlink target exists
      const target = fs.readlinkSync(binPath);
      const resolvedTarget = path.resolve(path.dirname(binPath), target);
      
      if (!fs.existsSync(resolvedTarget)) {
        // Find the actual module
        const parts = target.split('/');
        let moduleName = parts[1]; // e.g., "next"
        
        // Check if module exists in node_modules
        const modulePath = path.join(__dirname, 'node_modules', moduleName);
        if (fs.existsSync(modulePath)) {
          // Find the actual binary in the module's package.json
          const pkgPath = path.join(modulePath, 'package.json');
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          if (pkg.bin) {
            const binField = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin[file];
            if (binField) {
              const actualTarget = path.join(modulePath, binField);
              fs.unlinkSync(binPath);
              fs.symlinkSync(actualTarget, binPath);
              fixed++;
              continue;
            }
          }
        }
        console.log(`Broken: ${file} -> ${target} (target not found)`);
      }
    } catch (e) {
      console.log(`Error with ${file}: ${e.message}`);
    }
  }
}

console.log(`Fixed ${fixed} symlinks`);
