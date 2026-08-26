import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { useState } from "react";

type UpdateField = "groupTitle" | "status" | "playerRoute";
type StatusValue = "valid" | "invalid" | "warning";

interface BulkUpdateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (updates: { groupTitle?: string; status?: string; playerRoute?: string }) => void;
  count: number;
  isGlobal: boolean;
  isPending: boolean;
}

export function BulkUpdateDialog({
  isOpen,
  onClose,
  onConfirm,
  count,
  isGlobal,
  isPending,
}: BulkUpdateDialogProps) {
  const [field, setField] = useState<UpdateField>("groupTitle");
  const [groupValue, setGroupValue] = useState("");
  const [playerRouteValue, setPlayerRouteValue] = useState("");
  const [statusValue, setStatusValue] = useState<StatusValue>("valid");

  const handleConfirm = () => {
    if (field === "groupTitle" && groupValue.trim()) {
      onConfirm({ groupTitle: groupValue.trim() });
    } else if (field === "playerRoute") {
      onConfirm({ playerRoute: playerRouteValue.trim() });
    } else if (field === "status") {
      onConfirm({ status: statusValue });
    }
  };

  const canConfirm =
    !isPending && (field === "status" || field === "playerRoute" || groupValue.trim().length > 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Bulk Update {count.toLocaleString()}{" "}
            {isGlobal ? "Filtered" : "Selected"} Episodes
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Field to update</Label>
            <Select
              value={field}
              onValueChange={(v) => setField(v as UpdateField)}
            >
              <SelectTrigger data-testid="select-bulk-update-field">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="groupTitle">Group</SelectItem>
                <SelectItem value="playerRoute">Player Route</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {field === "groupTitle" ? (
            <div className="space-y-1.5">
              <Label>New group name</Label>
              <Input
                data-testid="input-bulk-update-group"
                value={groupValue}
                onChange={(e) => setGroupValue(e.target.value)}
                placeholder="e.g. Season 3 Backlog"
                onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
              />
            </div>
          ) : field === "playerRoute" ? (
            <div className="space-y-1.5">
              <Label>New player route</Label>
              <Input
                data-testid="input-bulk-update-player-route"
                value={playerRouteValue}
                onChange={(e) => setPlayerRouteValue(e.target.value)}
                placeholder="e.g. player1, player2"
                onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>New status</Label>
              <Select
                value={statusValue}
                onValueChange={(v) => setStatusValue(v as StatusValue)}
              >
                <SelectTrigger data-testid="select-bulk-update-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="valid">Valid</SelectItem>
                  <SelectItem value="invalid">Invalid</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            This will overwrite the{" "}
            {field === "groupTitle" ? "group" : "status"} field for{" "}
            <span className="font-medium text-foreground">
              {count.toLocaleString()} episodes
            </span>
            . You can undo this by running another bulk update.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm}
            data-testid="button-bulk-update-confirm"
          >
            {isPending
              ? "Updating…"
              : `Update ${count.toLocaleString()} Episodes`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
