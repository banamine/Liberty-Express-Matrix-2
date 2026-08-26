const fetch = require('node-fetch');

async function testTimeout() {
  const startTime = Date.now();
  console.log('Starting test...');
  
  // A service that intentionally delays for 15 seconds
  const hangingUrl = 'https://httpbin.org/delay/15';
  
  try {
    const res = await fetch('http://localhost:3000/api/archive/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: hangingUrl })
    });
    
    console.log(`Status: ${res.status}`);
    const text = await res.text();
    console.log(`Response: ${text}`);
    
  } catch (err) {
    console.error('Fetch error:', err);
  }
  
  const endTime = Date.now();
  console.log(`Test completed in ${(endTime - startTime) / 1000} seconds`);
}

testTimeout();
