"use client";

import { useState, useTransition } from "react";
import { previewLabImport, runLabImport } from "@/actions/lab-import-temp";
import { Button } from "@/components/ui/button";

export function LabImportPanel() {
  const [output, setOutput] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              try {
                const result = await previewLabImport();
                setOutput(result.lines);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Preview failed");
              }
            })
          }
        >
          Preview (dry run — no writes)
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={pending}
          onClick={() => {
            if (!confirm("This writes directly to the PRODUCTION database. Continue?")) return;
            startTransition(async () => {
              setError(null);
              try {
                const result = await runLabImport();
                setOutput(result.lines);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Import failed");
              }
            });
          }}
        >
          Run Import For Real
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
