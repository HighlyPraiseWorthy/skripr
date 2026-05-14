const fs = require('fs');
const path = require('path');

const base = path.join(__dirname, 'src');

function fixFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  // Replace literal \n (backslash followed by n at end of line) with actual newline
  // But we need to be careful not to break actual code
  // The pattern is: lines that end with literal `\n` as two characters
  const lines = content.split('\n');
  let changed = false;
  const newLines = lines.map(line => {
    // If line ends with literal \n (the two chars backslash and n)
    if (line.endsWith('\\n') && !line.endsWith('\\\\n')) {
      changed = true;
      return line.slice(0, -2); // Remove the literal \n
    }
    return line;
  });
  
  if (changed) {
    fs.writeFileSync(filePath, newLines.join('\n'));
    return true;
  }
  return false;
}

let fixed = 0;
for (const [root, dirs, files] of (() => {
  const result = [];
  function walk(dir, baseDir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const subdirs = [];
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      if (entry.isDirectory()) {
        subdirs.push(entry.name);
      } else if (entry.name.match(/\.(tsx?|css|js)$/)) {
        result.push([path.join(dir, entry.name), [], []]);
      }
    }
    for (const sd of subdirs) {
      walk(path.join(dir, sd), baseDir);
    }
  }
  walk(base, base);
  return result;
})()) {
  // Simplify: just walk and fix
}

// Simpler approach
function walkAndFix(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.next') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkAndFix(fullPath);
    } else if (entry.name.match(/\.(tsx?|css|js)$/)) {
      if (fixFile(fullPath)) {
        fixed++;
        console.log(`Fixed: ${path.relative(base, fullPath)}`);
      }
    }
  }
}

walkAndFix(base);
console.log(`\nTotal files fixed: ${fixed}`);
