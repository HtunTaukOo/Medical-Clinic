import { FileText, StickyNote } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type RecordItem = {
  id: string;
  type: "NOTE" | "DOCUMENT";
  note: string | null;
  fileName: string | null;
  createdAt: Date;
  author: { name: string; role: string };
};

export function MedicalRecordList({ records }: { records: RecordItem[] }) {
  if (records.length === 0) {
    return <p className="text-muted-foreground">No medical records yet.</p>;
  }

  return (
    <div className="grid gap-3">
      {records.map((record) => (
        <div key={record.id} className="flex items-start gap-3 rounded-lg border p-3">
          <div className="mt-0.5 text-muted-foreground">
            {record.type === "NOTE" ? (
              <StickyNote className="size-4" />
            ) : (
              <FileText className="size-4" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{record.author.name}</span>
              <Badge variant="outline">{record.author.role}</Badge>
              <span>{new Date(record.createdAt).toLocaleString()}</span>
            </div>
            {record.type === "NOTE" ? (
              <p className="mt-1 whitespace-pre-wrap">{record.note}</p>
            ) : (
              <div className="mt-1">
                <a
                  href={`/api/medical-records/${record.id}/file`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {record.fileName}
                </a>
                {record.note && (
                  <p className="mt-1 text-sm text-muted-foreground">{record.note}</p>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
