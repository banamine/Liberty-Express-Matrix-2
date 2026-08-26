import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/src/components/ui/alert-dialog";
import { Input } from "@/src/components/ui/input";
import { useState } from "react";

interface ConfirmDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  count: number;
  isGlobal: boolean;
}

export function ConfirmDeleteDialog({
  isOpen,
  onClose,
  onConfirm,
  count,
  isGlobal,
}: ConfirmDeleteDialogProps) {
  const [confirmText, setConfirmText] = useState("");

  const handleConfirm = () => {
    if (confirmText.toUpperCase() === "DELETE") {
      onConfirm();
      setConfirmText("");
    }
  };

  const handleClose = () => {
    setConfirmText("");
    onClose();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={handleClose}>
      <AlertDialogContent className="border-destructive/40">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive">
            {isGlobal
              ? `Bulk Delete ${count.toLocaleString()} Episodes?`
              : `Delete ${count.toLocaleString()} Selected Episodes?`}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                This action is <strong>permanent</strong>. You are about to remove{" "}
                <span className="font-bold text-foreground">
                  {count.toLocaleString()}
                </span>{" "}
                records from the database
                {isGlobal ? " matching your current filters" : ""}.
              </p>
              <p className="text-xs text-muted-foreground">
                Type{" "}
                <span className="font-mono font-bold text-destructive">
                  DELETE
                </span>{" "}
                to confirm.
              </p>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DELETE"
                className="border-destructive/40 focus-visible:ring-destructive"
                data-testid="input-confirm-delete"
                onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={confirmText.toUpperCase() !== "DELETE"}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-testid="button-confirm-delete"
          >
            Confirm Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
