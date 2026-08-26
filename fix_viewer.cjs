const fs = require('fs');
let code = fs.readFileSync('src/components/TelemetryViewer.tsx', 'utf8');

code = code.replace(
    `<h2 className="text-xl font-bold flex items-center gap-2" title="Events older than 24 hours are automatically purged">
      <span className="font-mono text-primary">{'<>'}</span
      Telemetry Debug Viewer <span className="text-sm font-normal text-muted-foreground">(Showing last 24h)</span>
    </div>
    <div className="hidden">
            <span className="font-mono text-primary">{'<>'}</span
            Telemetry Debug Viewer
          </h2>`,
    `<h2 className="text-xl font-bold flex items-center gap-2" title="Events older than 24 hours are automatically purged">
      <span className="font-mono text-primary">{'<>'}</span
      Telemetry Debug Viewer <span className="text-sm font-normal text-muted-foreground">(Showing last 24h)</span>
    </h2>`
);
fs.writeFileSync('src/components/TelemetryViewer.tsx', code);
