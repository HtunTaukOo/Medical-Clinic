"use client";

import { useEffect, useRef, useState } from "react";

type Meta = { modality?: string; studyDate?: string; rows?: number; columns?: number };

export function DicomPreview({ src }: { src: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unsupported" | "error">("loading");
  const [meta, setMeta] = useState<Meta>({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const dicomParser = await import("dicom-parser");
        const res = await fetch(src);
        const buffer = await res.arrayBuffer();
        const byteArray = new Uint8Array(buffer);
        const dataSet = dicomParser.parseDicom(byteArray);

        const rows = dataSet.uint16("x00280010");
        const columns = dataSet.uint16("x00280011");
        const bitsAllocated = dataSet.uint16("x00280100");
        const samplesPerPixel = dataSet.uint16("x00280002") ?? 1;
        const pixelRepresentation = dataSet.uint16("x00280103") ?? 0;
        const photometricInterpretation = (dataSet.string("x00280004") ?? "").trim();
        const pixelDataElement = dataSet.elements.x7fe00010;

        if (cancelled) return;
        setMeta({
          modality: dataSet.string("x00080060"),
          studyDate: dataSet.string("x00080020"),
          rows,
          columns,
        });

        const isSupportedBitDepth = bitsAllocated === 8 || bitsAllocated === 16;
        const isSupportedColor = samplesPerPixel === 1; // grayscale only, no RGB/YBR
        const isUncompressed = !!pixelDataElement && !pixelDataElement.encapsulatedPixelData;

        if (!rows || !columns || !pixelDataElement || !isSupportedBitDepth || !isSupportedColor || !isUncompressed) {
          setStatus("unsupported");
          return;
        }

        const pixelCount = rows * columns;
        const pixels: ArrayLike<number> =
          bitsAllocated === 8
            ? new Uint8Array(byteArray.buffer, byteArray.byteOffset + pixelDataElement.dataOffset, pixelCount)
            : pixelRepresentation === 1
              ? new Int16Array(byteArray.buffer, byteArray.byteOffset + pixelDataElement.dataOffset, pixelCount)
              : new Uint16Array(byteArray.buffer, byteArray.byteOffset + pixelDataElement.dataOffset, pixelCount);

        let min = Infinity;
        let max = -Infinity;
        for (let i = 0; i < pixelCount; i++) {
          const v = pixels[i];
          if (v < min) min = v;
          if (v > max) max = v;
        }
        const range = max - min || 1;
        const invert = photometricInterpretation === "MONOCHROME1";

        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = columns;
        canvas.height = rows;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const imageData = ctx.createImageData(columns, rows);
        for (let i = 0; i < pixelCount; i++) {
          let gray = Math.round(((pixels[i] - min) / range) * 255);
          if (invert) gray = 255 - gray;
          const offset = i * 4;
          imageData.data[offset] = gray;
          imageData.data[offset + 1] = gray;
          imageData.data[offset + 2] = gray;
          imageData.data[offset + 3] = 255;
        }
        ctx.putImageData(imageData, 0, 0);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (status === "error") {
    return <p className="text-sm text-destructive">Couldn&apos;t read this DICOM file.</p>;
  }

  if (status === "unsupported") {
    return (
      <p className="text-sm text-muted-foreground">
        This DICOM file uses a format (compressed, color, or multi-frame) this basic preview
        can&apos;t render — download it to view in a dedicated DICOM viewer.
      </p>
    );
  }

  return (
    <div className="grid gap-1">
      {status === "loading" && <p className="text-sm text-muted-foreground">Loading preview…</p>}
      <canvas
        ref={canvasRef}
        className={`max-h-64 w-auto rounded-md border ${status === "ready" ? "" : "hidden"}`}
      />
      {status === "ready" && (meta.modality || meta.studyDate || meta.rows) && (
        <p className="text-xs text-muted-foreground">
          {[meta.modality, meta.studyDate, meta.rows && meta.columns ? `${meta.columns}×${meta.rows}` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
    </div>
  );
}
