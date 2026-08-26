const fs = require('fs');
let code = fs.readFileSync('src/components/ArchiveImportDialog.tsx', 'utf8');

code = code.replace(/\{rssItems\.map\(\(item\) => \(/g, '{rssItems.map((item, index) => (');
code = code.replace(/key=\{item\.identifier\}/g, 'key={`${item.identifier}-${index}`}');

fs.writeFileSync('src/components/ArchiveImportDialog.tsx', code);
