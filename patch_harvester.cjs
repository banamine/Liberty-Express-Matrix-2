const fs = require('fs');
let code = fs.readFileSync('server/bumper-harvester.ts', 'utf8');

if (!code.includes('logHarvesterEvent')) {
  const logFn = `
  async function logHarvesterEvent(category, message, count) {
    try {
      const db = require('./db').getDb();
      const { telemetryEvents } = require('../shared/schema');
      const crypto = require('crypto');
      await db.insert(telemetryEvents).values({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        level: 'info',
        category: category,
        message: message,
        data: { count }
      });
    } catch(e) {}
  }
`;
  code = code.replace("export async function harvestBumpers() {", logFn + "\nexport async function harvestBumpers() {");
  code = code.replace(
    'console.log(`Bumpers harvested successfully. Indexed ${count} items.`);',
    'console.log(`Bumpers harvested successfully. Indexed ${count} items.`);\n    logHarvesterEvent("system", `Bumpers harvested successfully`, count);'
  );
  code = code.replace(
    "console.error('Failed to harvest bumpers:', error);",
    "console.error('Failed to harvest bumpers:', error);\n    logHarvesterEvent('system', 'Failed to harvest bumpers: ' + error.message, 0);"
  );
  fs.writeFileSync('server/bumper-harvester.ts', code);
}
