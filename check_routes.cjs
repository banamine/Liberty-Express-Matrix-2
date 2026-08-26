const fs = require('fs');
const content = fs.readFileSync('server/archive-routes.ts', 'utf-8');
const routes = content.match(/app\.(get|post|patch|delete)\(['"][^'"]+['"],\s*async\s*\(req,\s*res\)\s*=>\s*\{([\s\S]*?)\}\);/g);
if (routes) {
  routes.forEach(route => {
    const body = route.match(/=>\s*\{([\s\S]*?)\}\);/)[1].trim();
    if (!body.startsWith('try {')) {
      console.log('MISSING TRY/CATCH:', route.split('\n')[0]);
    }
  });
}
