const fs = require('fs');
let code = fs.readFileSync('shared/schema.ts', 'utf8');

if (!code.includes('export const telemetryEvents')) {
  code += `
// ── Telemetry Events (Persistent 24-hour log) ────────────────────────────────
export const telemetryEvents = pgTable("telemetry_events", {
  id: varchar("id").primaryKey(),
  timestamp: bigint("timestamp", { mode: "number" }).notNull(),
  level: text("level").notNull(),
  category: text("category").notNull(),
  message: text("message").notNull(),
  data: jsonb("data").$type<Record<string, unknown>>(),
  correlationId: text("correlation_id"),
});

export const insertTelemetryEventSchema = createInsertSchema(telemetryEvents);
export type InsertTelemetryEvent = z.infer<typeof insertTelemetryEventSchema>;
export type TelemetryEventRow = typeof telemetryEvents.$inferSelect;
`;
  fs.writeFileSync('shared/schema.ts', code);
}
