const fs = require('fs');
let code = fs.readFileSync('server/archive-routes.ts', 'utf8');

const delayFn = `
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
`;

if (!code.includes('const delay = (ms: number)')) {
    code = code.replace("import * as cheerio from 'cheerio';", "import * as cheerio from 'cheerio';\n" + delayFn);
}

const loopStart = `
      for (const id of idsToProcess) {
        try {
`;

const replacement = `
      for (const id of idsToProcess) {
        try {
          await delay(750);
`;

code = code.replace(loopStart, replacement);
fs.writeFileSync('server/archive-routes.ts', code);
