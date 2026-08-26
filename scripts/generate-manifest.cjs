const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const distDir = path.join(__dirname, '../dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const manifest = {
  timestamp: new Date().toISOString(),
  gitCommit: (() => {
    try { return execSync('git rev-parse HEAD').toString().trim(); } catch { return 'unknown'; }
  })(),
  files: {}
};

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else {
      const relPath = path.relative(distDir, fullPath);
      const content = fs.readFileSync(fullPath);
      manifest.files[relPath] = crypto.createHash('sha256').update(content).digest('hex');
    }
  }
}

walk(distDir);
fs.writeFileSync(path.join(distDir, 'build-manifest.json'), JSON.stringify(manifest, null, 2));
console.log('✅ Generated dist/build-manifest.json successfully.');
