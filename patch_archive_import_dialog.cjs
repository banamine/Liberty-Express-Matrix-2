const fs = require('fs');
const file = 'src/components/ArchiveImportDialog.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'const importMutation = useMutation({',
  `const listImportMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/archive/import-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: archiveUrl, groupTitle: groupTitle || undefined }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "List import failed");
      }
      return response.json();
    },
    onSuccess: (data) => {
      sonnerToast.success(data.message || "List items imported successfully");
      queryClient.invalidateQueries({ queryKey: ["episodes"] });
      onOpenChange?.(false);
    },
    onError: (error: Error) => {
      sonnerToast.error(\`Failed to import list: \${error.message}\`);
    }
  });

  const importMutation = useMutation({`
);

content = content.replace(
  `setActiveTab(v as "direct" | "collection" | "tvnews")`,
  `setActiveTab(v as "direct" | "collection" | "tvnews" | "list")`
);

content = content.replace(
  `            <TabsTrigger value="tvnews" data-testid="tab-tvnews-import">
              <Tv className="w-3.5 h-3.5 mr-1.5" />
              TV News
            </TabsTrigger>
          </TabsList>`,
  `            <TabsTrigger value="tvnews" data-testid="tab-tvnews-import">
              <Tv className="w-3.5 h-3.5 mr-1.5" />
              TV News
            </TabsTrigger>
            <TabsTrigger value="list" data-testid="tab-list-import">
              <Library className="w-3.5 h-3.5 mr-1.5" />
              Lists
            </TabsTrigger>
          </TabsList>`
);

const listTabContent = `
          <TabsContent value="list" className="flex-1 overflow-hidden flex flex-col space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="list-url">Archive.org List URL</Label>
              <Input
                id="list-url"
                value={archiveUrl}
                onChange={(e) => setArchiveUrl(e.target.value)}
                placeholder="e.g. https://archive.org/details/@infobattalion/lists/1/documentary"
                onKeyDown={(e) => { if (e.key === 'Enter') listImportMutation.mutate(); }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="list-group-title">Channel Name (Optional)</Label>
              <Input
                id="list-group-title"
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
                placeholder="e.g. Channel: Documentaries - Infobattalion"
              />
            </div>
            <div className="flex-1" />
            <DialogFooter className="mt-4 flex justify-end">
              <Button onClick={() => listImportMutation.mutate()} disabled={listImportMutation.isPending || !archiveUrl}>
                {listImportMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Archive className="w-4 h-4 mr-2" />}
                Import List
              </Button>
            </DialogFooter>
          </TabsContent>
`;

content = content.replace(
  `          <TabsContent value="direct" className="flex-1 overflow-hidden flex flex-col space-y-4 mt-4">`,
  listTabContent + `\n          <TabsContent value="direct" className="flex-1 overflow-hidden flex flex-col space-y-4 mt-4">`
);

fs.writeFileSync(file, content);
console.log('Patched Dialog successfully!');
