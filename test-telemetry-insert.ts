import { getDb } from './server/db/index';
import { telemetryEvents } from './shared/schema';

async function test() {
  const connection = await getDb();
  try {
    await connection.insert(telemetryEvents).values({
      id: "70a3ed47-9e4e-4588-b95b-a5f46ce52df7",
      timestamp: 1786875180850,
      level: "error",
      category: "network",
      message: "[POST] /Express-Application/api/telemetry - 404 (2ms)",
      data: {"method":"POST","path":"/Express-Application/api/telemetry","statusCode":404,"duration":2},
      correlationId: null
    }).onConflictDoNothing();
    console.log("Success");
  } catch (e) {
    console.error("FAILED:");
    console.error(e);
  }
}
test();
