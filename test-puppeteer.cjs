const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));

  console.log("Navigating to player2...");
  await page.goto('http://localhost:3000/player2', { waitUntil: 'networkidle2' });
  
  console.log("Waiting 5 seconds to observe stall...");
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  await browser.close();
})();
