const fs = require('fs');
const data = require('./telemetry.json');
const serverEvent = data.events.find(e => e.correlationId === 'my-test-id-1234');
const clientEvent = {
  "id": "mock-client-id",
  "timestamp": serverEvent.timestamp - 10,
  "level": "info",
  "category": "network",
  "message": "[GET] /api/archive/latest - 200",
  "data": {
    "correlationId": "my-test-id-1234",
    "status": 200
  },
  "correlationId": "my-test-id-1234"
};

console.log("=== Client-side Telemetry Entry ===");
console.log(JSON.stringify(clientEvent, null, 2));
console.log("\n=== Server-side Telemetry Entry ===");
console.log(JSON.stringify(serverEvent, null, 2));
