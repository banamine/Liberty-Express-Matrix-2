const fs = require('fs');
let code = fs.readFileSync('src/pages/tv.tsx', 'utf8');

if (!code.includes('Tap to Enable Audio')) {
  code = code.replace(
    '          </div>\n        )}\n        {/* Overlay HUD */}',
    `          </div>\n        )}\n        {needsInteraction && (\n          <div \n            className="absolute inset-0 z-50 flex items-center justify-center cursor-pointer"\n            style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}\n            onClick={handleInteract}\n          >\n            <div className="flex flex-col items-center gap-3 px-8 py-6 bg-black/80 rounded-xl border border-white/20 shadow-2xl hover:bg-black transition-colors">\n              <Volume2 className="h-12 w-12 text-white" />\n              <span className="font-bold tracking-wider text-white uppercase text-lg">Tap to Enable Audio</span>\n            </div>\n          </div>\n        )}\n        {/* Overlay HUD */}`
  );
  fs.writeFileSync('src/pages/tv.tsx', code);
}
