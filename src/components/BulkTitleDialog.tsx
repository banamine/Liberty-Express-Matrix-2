import { useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { FileText } from "lucide-react";

interface BulkTitleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onApply: (operation: "replace" | "prepend" | "append", value: string) => void;
  isPending?: boolean;
}

export default function BulkTitleDialog({
  open,
  onOpenChange,
  selectedIds,
  onApply,
  isPending = false,
}: BulkTitleDialogProps) {
  const [operation, setOperation] = useState<"replace" | "prepend" | "append">("prepend");
  const [value, setValue] = useState("");

  const handleApply = () => {
    if (value.trim()) {
      onApply(operation, value);
      setValue("");
      setOperation("prepend");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Edit Titles
          </DialogTitle>
          <DialogDescription>
            Update titles for {selectedIds.length} selected episode(s).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex gap-2 flex-wrap">
            {["replace", "prepend", "append"].map((op) => (
              <Button
                key={op}
                variant={operation === op ? "default" : "outline"}
                size="sm"
                onClick={() => setOperation(op as "replace" | "prepend" | "append")}
                data-testid={`button-title-${op}`}
              >
                {op.charAt(0).toUpperCase() + op.slice(1)}
              </Button>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="title-input">
              {operation === "replace" && "New title"}
              {operation === "prepend" && "Text to add at start"}
              {operation === "append" && "Text to add at end"}
            </Label>
            <Textarea
              id="title-input"
              placeholder={
                operation === "replace"
                  ? "Enter new title..."
                  : operation === "prepend"
                    ? "E.g., [NEW] "
                    : " - Updated"
              }
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="min-h-20"
              data-testid="input-bulk-title"
            />
          </div>

          {operation === "prepend" && value && (
            <div className="text-sm text-secondary">
              Example: "{value}Original Title"
            </div>
          )}
          {operation === "append" && value && (
            <div className="text-sm text-secondary">
              Example: "Original Title{value}"
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            data-testid="button-cancel-bulk-title"
          >
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={!value.trim() || isPending}
            data-testid="button-apply-bulk-title"
          >
            {isPending ? "Applying..." : "Apply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
