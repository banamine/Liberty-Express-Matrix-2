const fs = require('fs');
let code = fs.readFileSync('src/pages/player2.tsx', 'utf8');
code = code.replace(/          <\/div>\n        \)\)}/g, '          </div>');
code = code.replace(/            \)}\n          <\/div>\n        <\/div>\n      <\/div>\n    <\/div>\n  \);\n}/, '            )}\n          </div>\n        ))}\n      </div>\n    </div>\n  );\n}');
fs.writeFileSync('src/pages/player2.tsx', code);
