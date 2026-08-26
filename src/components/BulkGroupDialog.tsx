import { useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { Tag } from "lucide-react";

interface BulkGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  existingGroups: string[];
  onAssignGroup: (groupTitle: string) => void;
}

export default function BulkGroupDialog({
  open,
  onOpenChange,
  selectedIds,
  existingGroups,
  onAssignGroup,
}: BulkGroupDialogProps) {
  const [groupMode, setGroupMode] = useState<"existing" | "new">("new");
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [newGroup, setNewGroup] = useState<string>("FXRShows");

  const handleAssign = () => {
    const groupTitle = groupMode === "existing" ? selectedGroup : newGroup.trim();
    if (groupTitle) {
      onAssignGroup(groupTitle);
      setSelectedGroup("");
      setNewGroup("");
    }
  };

  const isValid = groupMode === "existing" ? selectedGroup.length > 0 : newGroup.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="w-5 h-5" />
            Assign Group
          </DialogTitle>
          <DialogDescription>
            Set the group for {selectedIds.length} selected episode(s).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex gap-2">
            <Button
              variant={groupMode === "existing" ? "default" : "outline"}
              size="sm"
              onClick={() => setGroupMode("existing")}
              data-testid="button-existing-group"
            >
              Existing Group
            </Button>
            <Button
              variant={groupMode === "new" ? "default" : "outline"}
              size="sm"
              onClick={() => setGroupMode("new")}
              data-testid="button-new-group"
            >
              New Group
            </Button>
          </div>

          {groupMode === "existing" ? (
            <div className="space-y-2">
              <Label htmlFor="existing-group">Select Group</Label>
              {existingGroups.length > 0 ? (
                <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                  <SelectTrigger data-testid="select-existing-group">
                    <SelectValue placeholder="Select a group..." />
                  </SelectTrigger>
                  <SelectContent>
                    {existingGroups.map((group) => (
                      <SelectItem key={group} value={group}>
                        {group}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No existing groups. Create a new one.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="new-group">New Group Name</Label>
              <Input
                id="new-group"
                placeholder="Enter group name..."
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
                data-testid="input-new-group"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-group">
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={!isValid} data-testid="button-assign-group">
            <Tag className="w-4 h-4 mr-2" />
            Assign Group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
