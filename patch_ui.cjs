const fs = require('fs');
let code = fs.readFileSync('src/pages/archive.tsx', 'utf8');

const targetPanelDef = `function HoldingQueuePanel({ 
  items, 
  onRemove, 
  onProcess, 
  isProcessing 
}: { 
  items: QueueItem[]; 
  onRemove: (id: string) => void; 
  onProcess: (items: QueueItem[]) => void; 
  isProcessing: boolean 
}) {`;

const replPanelDef = `function HoldingQueuePanel({ 
  items, 
  onRemove, 
  onProcess,
  onClear,
  isProcessing 
}: { 
  items: QueueItem[]; 
  onRemove: (id: string) => void; 
  onProcess: (items: QueueItem[]) => void;
  onClear: () => void;
  isProcessing: boolean 
}) {`;

const targetPanelBtn = `      <div className="p-4 border-t bg-muted/10 flex-shrink-0">
        <button 
          onClick={() => onProcess(items)}
          disabled={items.length === 0 || isProcessing}
          className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={\`mr-2 h-4 w-4 \${isProcessing ? 'animate-spin' : ''}\`} />
          Process Queue ({items.length})
        </button>
      </div>`;

const replPanelBtn = `      <div className="p-4 border-t bg-muted/10 flex-shrink-0 flex gap-2">
        <button 
          onClick={onClear}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-destructive text-destructive-foreground hover:bg-destructive/90 h-9 px-4 py-2"
        >
          Clear Workspace
        </button>
        <button 
          onClick={() => onProcess(items)}
          disabled={items.length === 0 || isProcessing}
          className="flex-1 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={\`mr-2 h-4 w-4 \${isProcessing ? 'animate-spin' : ''}\`} />
          Process Queue ({items.length})
        </button>
      </div>`;

const targetMainStart = `export default function ArchiveQueue() {
  const [query, setQuery] = useState('');`;

const replMainStart = `export default function ArchiveQueue() {
  const [query, setQuery] = useState('');

  const handleQuickClear = async () => {
    try {
      const response = await fetch('/api/archive/holding-queue', { 
        method: 'DELETE' 
      });
      
      if (response.ok) {
        setHoldingQueue([]); 
        toast.success("Workspace cleared successfully.");
      } else {
        throw new Error("Backend failed to clear.");
      }
    } catch (error) {
      console.error("Clear failed:", error);
      toast.error("Failed to clear workspace.");
    }
  };`;

const targetPanelUse = `          <HoldingQueuePanel 
            items={holdingQueue}
            onRemove={(id) => {`;

const replPanelUse = `          <HoldingQueuePanel 
            items={holdingQueue}
            onClear={handleQuickClear}
            onRemove={(id) => {`;

code = code.replace(targetPanelDef, replPanelDef);
code = code.replace(targetPanelBtn, replPanelBtn);
code = code.replace(targetMainStart, replMainStart);
code = code.replace(targetPanelUse, replPanelUse);

fs.writeFileSync('src/pages/archive.tsx', code);
console.log("Success");
