"use client";

import { useState, useTransition } from "react";
import { previewMedicineImport, runMedicineImport } from "@/actions/medicine-import-temp";
import { Button } from "@/components/ui/button";

export function MedicineImportPanel() {
  const [output, setOutput] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ lines: string[] }>, confirmMessage?: string) {
    if (confirmMessage && !confirm(confirmMessage)) return;
    startTransition(async () => {
      setError(null);
      try {
        const result = await action();
        setOutput(result.lines);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed");
      }
    });
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending} onClick={() => run(previewMedicineImport)}>
          Preview Medicine Import (dry run — no writes)
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={pending}
          onClick={() =>
            run(runMedicineImport, "This writes directly to the PRODUCTION database. Continue?")
          }
        >
          Run Medicine Import For Real
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {output.length > 0 && (
        <pre className="max-h-[60vh] overflow-auto rounded-lg bg-muted p-4 text-sm whitespace-pre-wrap">
          {output.join("\n")}
        </pre>
      )}
    </div>
  );
}
