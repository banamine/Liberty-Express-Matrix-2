const fs = require('fs');
let code = fs.readFileSync('src/pages/episodes.tsx', 'utf8');

const importStatement = `import { TimeTravelPlayerDialog } from '@/src/components/TimeTravelPlayerDialog';`;
if (!code.includes('import { TimeTravelPlayerDialog }')) {
    code = code.replace("import type { Episode } from '@shared/schema';", "import type { Episode } from '@shared/schema';\n" + importStatement);
}

const stateDeclarations = `
  const [playDialogUrl, setPlayDialogUrl] = useState<string | null>(null);
  const [isPlayDialogOpen, setIsPlayDialogOpen] = useState(false);
`;
if (!code.includes('const [playDialogUrl, setPlayDialogUrl]')) {
    code = code.replace("const [isFilterOpen, setIsFilterOpen] = useState(false);", "const [isFilterOpen, setIsFilterOpen] = useState(false);\n" + stateDeclarations);
}

const dialogComponent = `
      <TimeTravelPlayerDialog
        open={isPlayDialogOpen}
        onOpenChange={setIsPlayDialogOpen}
        url={playDialogUrl}
        title="Imported Video"
        timestamp={null}
      />
`;
if (!code.includes('<TimeTravelPlayerDialog')) {
    code = code.replace("      <BulkImportUrlsDialog", dialogComponent + "\n      <BulkImportUrlsDialog");
}

const actionReplacement = `
        onImportAndPlay={(url) => {
          setPlayDialogUrl(url);
          setIsPlayDialogOpen(true);
        }}
`;
code = code.replace(/onImportAndPlay=\{\(url\) => \{\s*toast\(\{ title: 'Playing episode', description: url \}\);\s*\}\}/, actionReplacement.trim());

fs.writeFileSync('src/pages/episodes.tsx', code);
