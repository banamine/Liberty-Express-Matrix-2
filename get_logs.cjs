const { execSync } = require('child_process');
console.log(execSync('cat dev_server2.log').toString());
