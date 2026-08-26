import { Search, X, Filter, Calendar, Tv } from "lucide-react";
import { useState } from "react";
import { Input } from "@/src/components/ui/input";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/src/components/ui/popover";
import { NEWS_SOURCES } from "@shared/news-registry";

type ViewTab = "all" | "valid" | "invalid" | "warning" | "long";

interface ContextBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
  totalCount: number;
  validCount: number;
  invalidCount: number;
  warningCount: number;
  longCount: number;
  activeGroups: string[];
  activeHosts: string[];
  activeSources: string[];
  onRemoveGroup: (group: string) => void;
  onRemoveHost: (host: string) => void;
  onAddSource: (slug: string) => void;
  onRemoveSource: (slug: string) => void;
  onClearStatus: () => void;
  activeFilterCount: number;
  onOpenFilters: () => void;
  searchInputRef?: React.RefObject<HTMLInputElement>;
  onJumpToDate?: (date: string) => void;
}

export default function ContextBar({
  searchQuery,
  onSearchChange,
  activeTab,
  onTabChange,
  totalCount,
  validCount,
  invalidCount,
  warningCount,
  longCount,
  activeGroups,
  activeHosts,
  activeSources,
  onRemoveGroup,
  onRemoveHost,
  onAddSource,
  onRemoveSource,
  onClearStatus,
  activeFilterCount,
  onOpenFilters,
  searchInputRef,
  onJumpToDate,
}: ContextBarProps) {
  const hasActivePills = searchQuery || activeTab !== "all" || activeGroups.length > 0 || activeHosts.length > 0 || activeSources.length > 0;
  const [dateValue, setDateValue] = useState("");
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [sourcePopoverOpen, setSourcePopoverOpen] = useState(false);

  const handleJumpToDate = () => {
    if (dateValue) {
      onJumpToDate?.(dateValue);
      setDatePopoverOpen(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 py-2 border-b sticky top-0 z-10" style={{ background: '#0a0a0a', borderBottomColor: 'rgba(57,255,20,0.2)' }}>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: '#39ff14' }} />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search episodes... (Ctrl+F)"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 pr-9 h-8 neon-search-input"
            data-testid="input-search"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
              style={{ color: '#39ff14' }}
              onClick={() => onSearchChange("")}
              data-testid="button-clear-search"
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onOpenFilters}
          data-testid="button-open-filters"
          style={{
            borderColor: activeFilterCount > 0 ? '#39ff14' : 'rgba(57,255,20,0.3)',
            color: activeFilterCount > 0 ? '#39ff14' : '#a0a0a0',
            background: 'transparent',
          }}
        >
          <Filter className="w-4 h-4 mr-2" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1.5 no-default-active-elevate">
              {activeFilterCount}
            </Badge>
          )}
        </Button>

        <Popover open={sourcePopoverOpen} onOpenChange={setSourcePopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              data-testid="button-filter-by-source"
              style={{
                borderColor: activeSources.length > 0 ? '#39ff14' : 'rgba(57,255,20,0.3)',
                color: activeSources.length > 0 ? '#39ff14' : '#a0a0a0',
                background: 'transparent',
              }}
            >
              <Tv className="w-4 h-4 mr-2" />
              Source
              {activeSources.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 no-default-active-elevate">
                  {activeSources.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-2" align="start">
            <div className="flex flex-col gap-0.5">
              <p className="text-xs text-muted-foreground px-2 pb-1">Filter by outlet</p>
              {NEWS_SOURCES.map((entry) => {
                const isActive = activeSources.includes(entry.slug);
                return (
                  <button
                    key={entry.slug}
                    onClick={() => isActive ? onRemoveSource(entry.slug) : onAddSource(entry.slug)}
                    className={`flex items-center justify-between text-sm px-2 py-1.5 rounded-md w-full text-left hover-elevate ${isActive ? "bg-primary/10 text-primary font-medium" : "text-foreground"}`}
                    data-testid={`source-option-${entry.slug}`}
                  >
                    <span>{entry.displayName}</span>
                    {isActive && <X className="w-3 h-3 shrink-0" />}
                  </button>
                );
              })}
              {activeSources.length > 0 && (
                <button
                  onClick={() => activeSources.forEach(s => onRemoveSource(s))}
                  className="text-xs text-muted-foreground px-2 pt-1.5 mt-0.5 border-t hover-elevate rounded-md w-full text-left py-1"
                  data-testid="button-clear-sources"
                >
                  Clear all sources
                </button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              data-testid="button-jump-to-date"
              title="Jump to date"
            >
              <Calendar className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3" align="start">
            <div className="flex flex-col gap-2">
              <label className="text-xs text-muted-foreground">Jump to episodes from date</label>
              <Input
                type="date"
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
                className="h-8 text-sm"
                data-testid="input-jump-date"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleJumpToDate();
                }}
              />
              <Button
                size="sm"
                onClick={handleJumpToDate}
                disabled={!dateValue}
                data-testid="button-confirm-jump-date"
              >
                Jump
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {totalCount > 0 && (
          <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as ViewTab)} className="w-auto">
            <TabsList className="h-8" data-testid="tabs-view">
              <TabsTrigger value="all" className="text-xs px-3" data-testid="tab-all">
                All ({totalCount})
              </TabsTrigger>
              <TabsTrigger value="valid" className="text-xs px-3" data-testid="tab-valid">
                Valid ({validCount})
              </TabsTrigger>
              <TabsTrigger value="warning" className="text-xs px-3" data-testid="tab-warning">
                Warn ({warningCount})
              </TabsTrigger>
              <TabsTrigger value="invalid" className="text-xs px-3" data-testid="tab-invalid">
                Invalid ({invalidCount})
              </TabsTrigger>
              <TabsTrigger value="long" className="text-xs px-3" data-testid="tab-long">
                Long ({longCount})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      {hasActivePills && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {searchQuery && (
            <Badge variant="secondary" className="gap-1 pl-2 pr-1" data-testid="pill-search">
              Search: {searchQuery}
              <button
                onClick={() => onSearchChange("")}
                className="ml-0.5 rounded-sm hover:bg-foreground/10 p-0.5"
                data-testid="button-remove-pill-search"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {activeTab !== "all" && (
            <Badge variant="secondary" className="gap-1 pl-2 pr-1" data-testid="pill-status">
              Status: {activeTab}
              <button
                onClick={onClearStatus}
                className="ml-0.5 rounded-sm hover:bg-foreground/10 p-0.5"
                data-testid="button-remove-pill-status"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {activeGroups.map((g) => (
            <Badge key={g} variant="secondary" className="gap-1 pl-2 pr-1" data-testid={`pill-group-${g}`}>
              Group: {g}
              <button
                onClick={() => onRemoveGroup(g)}
                className="ml-0.5 rounded-sm hover:bg-foreground/10 p-0.5"
                data-testid={`button-remove-pill-group-${g}`}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
          {activeHosts.map((h) => (
            <Badge key={h} variant="secondary" className="gap-1 pl-2 pr-1" data-testid={`pill-host-${h}`}>
              Host: {h}
              <button
                onClick={() => onRemoveHost(h)}
                className="ml-0.5 rounded-sm hover:bg-foreground/10 p-0.5"
                data-testid={`button-remove-pill-host-${h}`}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
          {activeSources.map((slug) => {
            const entry = NEWS_SOURCES.find(e => e.slug === slug);
            return (
              <Badge key={slug} variant="secondary" className="gap-1 pl-2 pr-1" data-testid={`pill-source-${slug}`}>
                Source: {entry?.displayName ?? slug}
                <button
                  onClick={() => onRemoveSource(slug)}
                  className="ml-0.5 rounded-sm hover:bg-foreground/10 p-0.5"
                  data-testid={`button-remove-pill-source-${slug}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
