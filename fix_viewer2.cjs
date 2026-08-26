const fs = require('fs');
let code = fs.readFileSync('src/components/TelemetryViewer.tsx', 'utf8');

// I will just use regex to replace whatever is between `<div className="flex items-center justify-between p-4 border-b bg-muted/30">` and `<Button variant="ghost"`
const startStr = '<div className="flex items-center justify-between p-4 border-b bg-muted/30">';
const endStr = '<Button variant="ghost"';

const startIndex = code.indexOf(startStr);
const endIndex = code.indexOf(endStr, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
  const newMiddle = `
          <h2 className="text-xl font-bold flex items-center gap-2" title="Events older than 24 hours are automatically purged">
            <span className="font-mono text-primary">{'<>'}</span>
            Telemetry Debug Viewer <span className="text-sm font-normal text-muted-foreground ml-2">(Showing last 24h)</span>
          </h2>
          `;
  code = code.substring(0, startIndex + startStr.length) + newMiddle + code.substring(endIndex);
  fs.writeFileSync('src/components/TelemetryViewer.tsx', code);
}
