const fs = require('fs');
let code = fs.readFileSync('src/pages/player1.tsx', 'utf8');

code = code.replace(
  `    // 24-Hour / Midnight Rebalance Trigger
    if (isNewDay || is24hUptime) {
      try {
        const res = await fetch('/api/episodes?player=player1');`,
  `    // 24-Hour / Midnight Rebalance Trigger
    if (isNewDay || is24hUptime) {
      try {
        // Explicitly clear the old JSON payload array from memory before fetching and parsing the next 24-hour cycle
        setProgramQueue([]);
        const res = await fetch('/api/episodes?player=player1');`
);

fs.writeFileSync('src/pages/player1.tsx', code);
