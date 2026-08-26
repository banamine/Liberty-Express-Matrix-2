const fs = require('fs');
let code = fs.readFileSync('shared/schema.ts', 'utf8');

if (!code.includes('archive_holding_queue_ident_file_unique')) {
  code = code.replace(
    '  pendingEpisodeJson: text("pending_episode_json"),\n});',
    '  pendingEpisodeJson: text("pending_episode_json"),\n}, (table) => ({\n  identFileIdx: uniqueIndex("archive_holding_queue_ident_file_unique").on(table.identifier, table.filename),\n}));'
  );
  fs.writeFileSync('shared/schema.ts', code);
}
