import { FileText, StickyNote, Download } from "lucide-react";
import { deleteMedicalRecord } from "@/actions/medical-records";
import { ImagePreview } from "@/components/medical-records/image-preview";
import { DicomPreview } from "@/components/medical-records/dicom-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

type RecordItem = {
  id: string;
  type: "NOTE" | "DOCUMENT";
  note: string | null;
  fileName: string | null;
  fileType: string | null;
  fileData?: Uint8Array | Buffer | null;
  createdAt: Date;
  authorId: string;
  author: { name: string; role: string };
};

function isImageFile(fileType: string | null) {
  return !!fileType?.startsWith("image/");
}

function isDicomFile(fileType: string | null, fileName: string | null) {
  return fileType === "application/dicom" || !!fileName?.toLowerCase().endsWith(".dcm");
}

function formatFileSize(bytes?: number) {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MedicalRecordList({
  records,
  currentUserId,
}: {
  records: RecordItem[];
  currentUserId?: string;
}) {
  if (records.length === 0) {
    return <EmptyState icon={FileText} message="No medical records yet." />;
  }

  return (
    <div className="grid gap-3">
      {records.map((record) => {
        const fileUrl = `/api/medical-records/${record.id}/file`;
        const isImage = record.type === "DOCUMENT" && isImageFile(record.fileType);
        const isDicom =
          record.type === "DOCUMENT" && !isImage && isDicomFile(record.fileType, record.fileName);
        const canRemove = currentUserId && record.authorId === currentUserId;

        if (record.type === "NOTE") {
          return (
            <div key={record.id} className="flex items-start gap-3 rounded-lg border p-3">
              <div className="mt-0.5 text-muted-foreground">
                <StickyNote className="size-4" />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{record.author.name}</span>
                  <Badge variant="outline">{record.author.role}</Badge>
                  <span>{new Date(record.createdAt).toLocaleString()}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap">{record.note}</p>
              </div>
              {canRemove && (
                <form action={deleteMedicalRecord.bind(null, record.id)}>
                  <Button size="sm" variant="destructive" type="submit">
                    Remove
                  </Button>
                </form>
              )}
            </div>
          );
        }

        const size = formatFileSize(record.fileData?.length);

        return (
          <div key={record.id} className="grid gap-3 rounded-lg border p-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <FileText className="size-4" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{record.fileName}</p>
                <p className="text-sm text-muted-foreground">
                  {record.author.name} · {new Date(record.createdAt).toLocaleDateString()}
                  {size && ` · ${size}`}
                </p>
                {record.note && (
                  <p className="mt-1 text-sm text-muted-foreground">{record.note}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button asChild size="sm" variant="outline">
                  <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                    <Download className="size-3.5" />
                    Download
                  </a>
                </Button>
                {canRemove && (
                  <form action={deleteMedicalRecord.bind(null, record.id)}>
                    <Button size="sm" variant="destructive" type="submit">
                      Remove
                    </Button>
                  </form>
                )}
              </div>
            </div>
            {isImage && <ImagePreview src={fileUrl} alt={record.fileName ?? "Image"} />}
            {isDicom && <DicomPreview src={fileUrl} />}
          </div>
        );
      })}
    </div>
  );
}
