import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Tv, Edit, Trash2, Tag, Sparkles } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { useToast } from '@/src/hooks/use-toast';
import AutoTagDialog, { AutoTagRule } from '@/src/components/AutoTagDialog';
import EpisodeTable from '@/src/components/EpisodeTable';
import ActionToolbar from '@/src/components/ActionToolbar';
import { EpisodeDetailSheet } from '@/src/components/EpisodeDetailSheet';
import EditEpisodeDialog from '@/src/components/EditEpisodeDialog';
import { ConfirmDeleteDialog } from '@/src/components/ConfirmDeleteDialog';
import { BulkUpdateDialog } from '@/src/components/BulkUpdateDialog';
import BulkCleanTitlesDialog from '@/src/components/BulkCleanTitlesDialog';
import BulkGroupDialog from '@/src/components/BulkGroupDialog';
import DuplicatesDialog from '@/src/components/DuplicatesDialog';
import BrowseUserDialog from '@/src/components/BrowseUserDialog';
import { BulkImportUrlsDialog } from '@/src/components/BulkImportUrlsDialog';
import BulkTitleDialog from '@/src/components/BulkTitleDialog';
import FilterDialog from '@/src/components/FilterDialog';
import type { Episode } from '@shared/schema';
import { TimeTravelPlayerDialog } from '@/src/components/TimeTravelPlayerDialog';

export default function EpisodeDB() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  // State for dialogs
  const [isAutoTagOpen, setIsAutoTagOpen] = useState(false);
  const [editingEpisode, setEditingEpisode] = useState<Episode | null>(null);
  const [viewingEpisode, setViewingEpisode] = useState<Episode | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);
  const [isBulkCleanTitlesOpen, setIsBulkCleanTitlesOpen] = useState(false);
  const [isBulkTitleOpen, setIsBulkTitleOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [playDialogUrl, setPlayDialogUrl] = useState<string | null>(null);
  const [isPlayDialogOpen, setIsPlayDialogOpen] = useState(false);

  const [activeFilterGroups, setActiveFilterGroups] = useState<string[]>([]);
  const [activeFilterHosts, setActiveFilterHosts] = useState<string[]>([]);
  const [isBulkGroupOpen, setIsBulkGroupOpen] = useState(false);
  const [isDuplicatesOpen, setIsDuplicatesOpen] = useState(false);
  const [isBrowseArchiveOpen, setIsBrowseArchiveOpen] = useState(false);
  const [isBulkImportUrlsOpen, setIsBulkImportUrlsOpen] = useState(false);
  
  // State for table/toolbar
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "valid" | "invalid" | "warning" | "long">("all");
  const [seasonView, setSeasonView] = useState(false);
  const [sortBy, setSortBy] = useState("season");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const { data: episodes = [], isLoading, error } = useQuery<Episode[]>({
    queryKey: ['/api/episodes'],
    staleTime: 60000,
    retry: 1,
    queryFn: async () => {
      const res = await fetch('/api/episodes');
      if (!res.ok) throw new Error('Failed to load episodes');
      return res.json();
    }
  });

  const autoTagMutation = useMutation({
    mutationFn: async (rules: AutoTagRule[]) => {
      const res = await fetch('/api/episodes/auto-tag', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rules })
      });
      if (!res.ok) throw new Error('Failed to apply auto-tags');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/episodes'] });
      toast({
        title: "Tags Applied",
        description: `Successfully updated ${data.changed} episodes.`,
      });
      setIsAutoTagOpen(false);
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (update: any) => {
      const res = await fetch(`/api/episodes/${update.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update)
      });
      if (!res.ok) throw new Error('Failed to update episode');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/episodes'] });
      toast({ title: "Episode Updated" });
      setEditingEpisode(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      // In a real app, you'd send a bulk delete request. For now, doing it sequentially or via a bulk endpoint if available.
      // Assuming a hypothetical bulk delete endpoint:
      const res = await fetch('/api/episodes/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      if (!res.ok) throw new Error('Failed to delete episodes');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/episodes'] });
      toast({ title: "Episodes Deleted" });
      setSelectedIds([]);
      setIsDeleteDialogOpen(false);
    }
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async (payload: { ids: string[]; updates: Partial<Episode> }) => {
      const res = await fetch('/api/episodes/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to bulk update');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/episodes'] });
      toast({ title: "Updated", description: `Successfully updated episodes.` });
      setIsBulkUpdateOpen(false);
      setIsBulkGroupOpen(false);
    }
  });

  const handleSelectAll = (checked: boolean | "indeterminate") => {
    if (checked === true) {
      setSelectedIds(episodes.map(ep => ep.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggle = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleRepairMetadata = async () => {
    try {
      const res = await fetch('/api/repair-all-metadata', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to repair metadata');
      const data = await res.json();
      toast({ title: 'Repair complete', description: data.message || 'Metadata repaired successfully.' });
      queryClient.invalidateQueries({ queryKey: ['/api/episodes'] });
    } catch (e: any) {
      toast({ title: 'Error repairing metadata', description: e.message, variant: 'destructive' });
    }
  };

  // Filter episodes based on active tab and search
  const filteredEpisodes = episodes.filter(ep => {
    if (activeTab === 'valid' && ep.status !== 'valid') return false;
    if (activeTab === 'invalid' && ep.status !== 'invalid') return false;
    if (activeTab === 'warning' && ep.status !== 'warning') return false;
    if (activeTab === 'long' && (ep.duration || 0) < 3600) return false;
    
    if (activeFilterGroups.length > 0) {
      if (!activeFilterGroups.includes((ep.groupTitle || '').trim())) return false;
    }
    
    if (activeFilterHosts.length > 0) {
      let h = '';
      try {
        if (ep.url) {
          h = new URL(ep.url).hostname.replace(/^www\./, '');
        }
      } catch(e) {}
      if (!activeFilterHosts.includes(h)) return false;
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return ep.title.toLowerCase().includes(q) || 
             (ep.groupTitle && ep.groupTitle.toLowerCase().includes(q));
    }
    return true;
  });

  // Sort episodes
  const sortedEpisodes = [...filteredEpisodes].sort((a, b) => {
    let valA = a[sortBy as keyof Episode];
    let valB = b[sortBy as keyof Episode];
    
    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    
    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const validCount = episodes.filter(e => e.status === 'valid').length;
  const invalidCount = episodes.filter(e => e.status === 'invalid').length;
  const warningCount = episodes.filter(e => e.status === 'warning').length;
  const longCount = episodes.filter(e => (e.duration || 0) >= 3600).length;

  return (
    <div className="space-y-4 flex flex-col h-[calc(100vh-6rem)]">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Episode DB</h2>
          <p className="text-muted-foreground mt-2">Manage all ingested media assets and scheduling rules.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsAutoTagOpen(true)} className="gap-2">
            <Tag className="h-4 w-4" />
            Auto-Tag Rules
          </Button>
          <Button variant="secondary" onClick={handleRepairMetadata} className="gap-2">
            <Sparkles className="h-4 w-4" />
            REPAIR ALL METADATA
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card flex flex-col flex-1 min-h-0">
        <ActionToolbar 
          totalCount={episodes.length}
          selectedCount={selectedIds.length}
          selectedIds={selectedIds}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          validCount={validCount}
          invalidCount={invalidCount}
          warningCount={warningCount}
          longCount={longCount}
          activeFilterCount={activeFilterGroups.length + activeFilterHosts.length}
          onOpenFilters={() => setIsFilterOpen(true)}
          onDeleteSelected={() => setIsDeleteDialogOpen(true)}
          onEditSelected={() => {
            const ep = episodes.find(e => e.id === selectedIds[0]);
            if (ep) setEditingEpisode(ep);
          }}
          onFindDuplicates={() => setIsDuplicatesOpen(true)}
          onBulkAssignGroup={() => setIsBulkGroupOpen(true)}
          onBulkCleanTitles={() => setIsBulkCleanTitlesOpen(true)}
          onBulkUpdate={() => setIsBulkUpdateOpen(true)}
          onBulkEditTitles={() => setIsBulkTitleOpen(true)}
          onBrowseArchive={() => setIsBrowseArchiveOpen(true)}
          onImport={() => setIsBulkImportUrlsOpen(true)}
          onSearchArchive={() => setLocation("/archive")}
          onStreamFinder={() => setLocation("/series-workbench")}
          onTVPlayer={() => setLocation("/tvnews-player")}
          onLivePlayer2={() => setLocation("/player2")}
          onWeeblyPlay2={() => setLocation("/player1")}
          onExportJSON={() => {
            window.open("/api/export/stream-json", "_blank");
            toast({ title: "Exported JSON" });
          }}
          onGenerateM3U={() => {
            window.open("/api/export/m3u8", "_blank");
            toast({ title: "Generated M3U" });
          }}
          onExportWeebly={() => {
            window.open("/api/export/weebly", "_blank");
            toast({ title: "Weebly export triggered" });
          }}
          onExportM3UWithWeebly={() => {
            window.open("/api/export/m3u-weebly", "_blank");
            toast({ title: "M3U + Weebly export triggered" });
          }}
          onClearAll={() => {
            if (confirm("Are you sure you want to clear ALL episodes? This is irreversible.")) {
               fetch('/api/episodes/clear', { method: 'POST' }).then(() => {
                 queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
                 toast({ title: "All episodes cleared" });
               });
            }
          }}
          onValidateUrls={() => {
             toast({ title: "Validating URLs in background..." });
             fetch('/api/episodes/validate-all', { method: 'POST' }).then(async (res) => {
               if(res.ok) {
                 queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
                 toast({ title: "URL Validation complete" });
               } else {
                 toast({ title: "Validation failed", variant: "destructive" });
               }
             });
          }}
          onRenumber={() => {
             toast({ title: "Renumbering episodes..." });
             fetch('/api/episodes/renumber', { method: 'POST' }).then(async (res) => {
               if(res.ok) {
                 queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
                 toast({ title: "Renumbering complete" });
               } else {
                 toast({ title: "Renumbering failed", variant: "destructive" });
               }
             });
          }}
          onCacheLogos={() => toast({ title: "Caching logos..." })}
        />
        
        <div className="flex-1 min-h-0 relative">
          <EpisodeTable 
            episodes={sortedEpisodes}
            isLoading={isLoading}
            hasMore={false}
            onLoadMore={() => {}}
            selectedIds={selectedIds}
            onSelectAll={handleSelectAll}
            onToggle={handleToggle}
            onRowClick={(ep) => setViewingEpisode(ep)}
            onEditEpisode={(ep) => setEditingEpisode(ep)}
            sortBy={sortBy}
            sortDir={sortDir}
            onSortChange={(col, dir) => {
              setSortBy(col);
              setSortDir(dir);
            }}
            seasonView={seasonView}
            onSeasonViewChange={setSeasonView}
          />
        </div>
      </div>
      
      <AutoTagDialog
        open={isAutoTagOpen}
        onOpenChange={setIsAutoTagOpen}
        onApply={(rules) => autoTagMutation.mutateAsync(rules)}
        existingGroups={Array.from(new Set((episodes || []).map((ep: any) => ep.groupTitle).filter(Boolean))) as string[]}
      />
      
      <EpisodeDetailSheet 
        episode={viewingEpisode}
        onClose={() => setViewingEpisode(null)}
        onEdit={(ep) => setEditingEpisode(ep)}
        hasPrev={false}
        hasNext={false}
        onPrev={() => {}}
        onNext={() => {}}
      />
      
      <EditEpisodeDialog
        open={!!editingEpisode}
        episode={editingEpisode}
        onOpenChange={(open) => !open && setEditingEpisode(null)}
        onSave={(update) => updateMutation.mutate(update)}
        existingGroups={Array.from(new Set((episodes || []).map((ep: any) => ep.groupTitle).filter(Boolean))) as string[]}
      />
      
      <ConfirmDeleteDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        count={selectedIds.length}
        isGlobal={false}
        onConfirm={() => deleteMutation.mutate(selectedIds)}
      />

      <BulkUpdateDialog
        isOpen={isBulkUpdateOpen}
        onClose={() => setIsBulkUpdateOpen(false)}
        count={selectedIds.length}
        isGlobal={selectedIds.length === 0}
        isPending={bulkUpdateMutation.isPending}
        onConfirm={(updates) => {
          const idsToUpdate = selectedIds.length > 0 ? selectedIds : episodes.map(e => e.id);
          bulkUpdateMutation.mutate({ ids: idsToUpdate, updates });
        }}
      />

      <BulkCleanTitlesDialog
        open={isBulkCleanTitlesOpen}
        onOpenChange={setIsBulkCleanTitlesOpen}
        selectedEpisodes={selectedIds.length > 0 ? episodes.filter(e => selectedIds.includes(e.id)) : episodes}
        onApplied={() => {
          setIsBulkCleanTitlesOpen(false);
          setSelectedIds([]);
        }}
      />

      <BulkGroupDialog
        open={isBulkGroupOpen}
        onOpenChange={setIsBulkGroupOpen}
        selectedIds={selectedIds}
        existingGroups={Array.from(new Set((episodes || []).map((ep: any) => ep.groupTitle).filter(Boolean))) as string[]}
        onAssignGroup={(groupTitle) => {
          const idsToUpdate = selectedIds.length > 0 ? selectedIds : episodes.map(e => e.id);
          bulkUpdateMutation.mutate({ ids: idsToUpdate, updates: { groupTitle } });
        }}
      />

      <DuplicatesDialog
        open={isDuplicatesOpen}
        onOpenChange={setIsDuplicatesOpen}
        onDeleteDuplicates={(ids) => {
          deleteMutation.mutate(ids);
        }}
      />
      
      <BrowseUserDialog
        open={isBrowseArchiveOpen}
        onOpenChange={setIsBrowseArchiveOpen}
      />
      

      <TimeTravelPlayerDialog
        open={isPlayDialogOpen}
        onOpenChange={setIsPlayDialogOpen}
        url={playDialogUrl}
        title="Imported Video"
        timestamp={null}
      />

      <BulkImportUrlsDialog
        open={isBulkImportUrlsOpen}
        onOpenChange={setIsBulkImportUrlsOpen}
        onImportAndPlay={(url) => {
          setPlayDialogUrl(url);
          setIsPlayDialogOpen(true);
        }}
      />

      <BulkTitleDialog
        open={isBulkTitleOpen}
        onOpenChange={setIsBulkTitleOpen}
        selectedIds={selectedIds.length > 0 ? selectedIds : episodes.map((e: any) => e.id)}
        onApply={(operation, value) => {
          const idsToUpdate = selectedIds.length > 0 ? selectedIds : episodes.map((e: any) => e.id);
          fetch('/api/episodes/bulk-title', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: idsToUpdate, operation, value })
          }).then(() => {
            queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
            setIsBulkTitleOpen(false);
          });
        }}
      />

      <FilterDialog
        open={isFilterOpen}
        onOpenChange={setIsFilterOpen}
        activeGroups={activeFilterGroups}
        activeHosts={activeFilterHosts}
        onApply={(groups, hosts) => {
          setActiveFilterGroups(groups);
          setActiveFilterHosts(hosts);
          setIsFilterOpen(false);
        }}
      />
    </div>
  );
}
