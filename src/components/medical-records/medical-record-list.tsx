import { FileText, StickyNote } from "lucide-react";
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

        return (
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
                <div className="mt-1 grid gap-2">
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {record.fileName}
                  </a>
                  {isImage && <ImagePreview src={fileUrl} alt={record.fileName ?? "Image"} />}
                  {isDicom && <DicomPreview src={fileUrl} />}
                  {record.note && (
                    <p className="text-sm text-muted-foreground">{record.note}</p>
                  )}
                </div>
              )}
            </div>
            {currentUserId && record.authorId === currentUserId && (
              <form action={deleteMedicalRecord.bind(null, record.id)}>
                <Button size="sm" variant="destructive" type="submit">
                  Remove
                </Button>
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}
