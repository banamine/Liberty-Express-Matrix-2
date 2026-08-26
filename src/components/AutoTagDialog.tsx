import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { Badge } from "@/src/components/ui/badge";
import { Plus, Trash2, GripVertical, Tag } from "lucide-react";
import { useToast } from "@/src/hooks/use-toast";

export interface AutoTagRule {
  id: string;
  field: "title" | "url";
  matchType: "contains" | "regex";
  value: string;
  targetGroup: string;
}

const RULES_STORAGE_KEY = "m3u-matrix-autotag-rules";

function loadRules(): AutoTagRule[] {
  try {
    return JSON.parse(localStorage.getItem(RULES_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRules(rules: AutoTagRule[]) {
  localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
}

export function loadAutoTagRules(): AutoTagRule[] {
  return loadRules();
}

interface AutoTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (rules: AutoTagRule[]) => Promise<{ changed: number }>;
  existingGroups: string[];
}

function newRule(): AutoTagRule {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    field: "title",
    matchType: "contains",
    value: "",
    targetGroup: "",
  };
}

export default function AutoTagDialog({
  open,
  onOpenChange,
  onApply,
  existingGroups,
}: AutoTagDialogProps) {
  const [rules, setRules] = useState<AutoTagRule[]>([]);
  const [isApplying, setIsApplying] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setRules(loadRules());
    }
  }, [open]);

  const addRule = () => {
    setRules((prev) => [...prev, newRule()]);
  };

  const removeRule = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const updateRule = (id: string, patch: Partial<AutoTagRule>) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
  };

  const handleSave = () => {
    saveRules(rules);
    toast({ title: "Rules saved", description: `${rules.length} rule${rules.length === 1 ? "" : "s"} saved to local storage.` });
    onOpenChange(false);
  };

  const handleApply = async () => {
    const validRules = rules.filter((r) => r.value.trim() && r.targetGroup.trim());
    if (validRules.length === 0) {
      toast({ title: "No valid rules", description: "Add at least one rule with a value and target group.", variant: "destructive" });
      return;
    }

    for (const rule of validRules) {
      if (rule.matchType === "regex") {
        try {
          new RegExp(rule.value);
        } catch {
          toast({ title: "Invalid regex", description: `Rule "${rule.value}" is not a valid regular expression.`, variant: "destructive" });
          return;
        }
      }
    }

    saveRules(rules);
    setIsApplying(true);
    try {
      const result = await onApply(validRules);
      toast({
        title: "Auto-tagging complete",
        description: `${result.changed} episode${result.changed === 1 ? "" : "s"} updated.`,
      });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Apply failed", description: err.message || "Unknown error", variant: "destructive" });
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="w-5 h-5" />
            Auto-Tag Groups
          </DialogTitle>
          <DialogDescription>
            Define rules to automatically assign group tags to episodes. Rules are evaluated top-to-bottom; first match wins. Rules are saved to local storage.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-2 space-y-3">
          {rules.length === 0 && (
            <div className="text-center text-muted-foreground py-8 text-sm">
              No rules yet. Click "Add Rule" to get started.
            </div>
          )}

          {rules.map((rule, index) => (
            <div
              key={rule.id}
              className="flex items-start gap-2 p-3 rounded-md border bg-card"
              data-testid={`autotag-rule-${rule.id}`}
            >
              <div className="mt-2 text-muted-foreground">
                <GripVertical className="w-4 h-4" />
              </div>

              <div className="flex items-center mt-2 min-w-[1.5rem]">
                <Badge variant="secondary" className="text-xs no-default-active-elevate">
                  {index + 1}
                </Badge>
              </div>

              <div className="flex-1 grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Field</Label>
                  <Select
                    value={rule.field}
                    onValueChange={(v) => updateRule(rule.id, { field: v as "title" | "url" })}
                  >
                    <SelectTrigger className="h-8 text-sm" data-testid={`select-field-${rule.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="title">Title</SelectItem>
                      <SelectItem value="url">URL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Match type</Label>
                  <Select
                    value={rule.matchType}
                    onValueChange={(v) => updateRule(rule.id, { matchType: v as "contains" | "regex" })}
                  >
                    <SelectTrigger className="h-8 text-sm" data-testid={`select-matchtype-${rule.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contains">Contains</SelectItem>
                      <SelectItem value="regex">Matches regex</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Value</Label>
                  <Input
                    className="h-8 text-sm"
                    placeholder={rule.matchType === "regex" ? "e.g. (news|live)" : "e.g. Documentary"}
                    value={rule.value}
                    onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                    data-testid={`input-rule-value-${rule.id}`}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Target group</Label>
                  <Input
                    className="h-8 text-sm"
                    placeholder="e.g. News"
                    value={rule.targetGroup}
                    onChange={(e) => updateRule(rule.id, { targetGroup: e.target.value })}
                    list={`groups-list-${rule.id}`}
                    data-testid={`input-rule-group-${rule.id}`}
                  />
                  <datalist id={`groups-list-${rule.id}`}>
                    {existingGroups.map((g) => (
                      <option key={g} value={g} />
                    ))}
                  </datalist>
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="mt-6 text-muted-foreground"
                onClick={() => removeRule(rule.id)}
                data-testid={`button-remove-rule-${rule.id}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={addRule}
            data-testid="button-add-rule"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Rule
          </Button>
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="ghost" onClick={() => onOpenChange(false)} data-testid="button-cancel-autotag">
            Cancel
          </Button>
          <Button variant="outline" onClick={handleSave} data-testid="button-save-rules">
            Save Rules
          </Button>
          <Button
            onClick={handleApply}
            disabled={isApplying || rules.filter((r) => r.value.trim() && r.targetGroup.trim()).length === 0}
            data-testid="button-apply-autotag"
          >
            {isApplying ? "Applying..." : "Apply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
