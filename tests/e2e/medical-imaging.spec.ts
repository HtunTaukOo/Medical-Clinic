import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import { prisma } from "./db";

// A well-known minimal valid 1x1 pixel PNG, used purely to exercise the real
// upload -> inline-image-preview path without needing a bundled fixture asset.
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function explicitElement(group: number, element: number, vr: string, valueBuffer: Buffer) {
  const tag = Buffer.alloc(4);
  tag.writeUInt16LE(group, 0);
  tag.writeUInt16LE(element, 2);

  const shortVRs = [
    "AE", "AS", "AT", "CS", "DA", "DS", "DT", "FL", "FD", "IS", "LO", "LT",
    "PN", "SH", "SL", "SS", "ST", "TM", "UI", "UL", "US",
  ];
  let header: Buffer;
  if (shortVRs.includes(vr)) {
    header = Buffer.alloc(4);
    header.write(vr, 0, 2, "ascii");
    header.writeUInt16LE(valueBuffer.length, 2);
  } else {
    header = Buffer.alloc(8);
    header.write(vr, 0, 2, "ascii");
    header.writeUInt16LE(0, 2);
    header.writeUInt32LE(valueBuffer.length, 4);
  }
  return Buffer.concat([tag, header, valueBuffer]);
}

function padEven(buf: Buffer, padChar: string) {
  return buf.length % 2 === 0 ? buf : Buffer.concat([buf, Buffer.from(padChar)]);
}

// Builds a minimal, valid, uncompressed 8-bit grayscale DICOM file (4x4 px)
// good enough for dicom-parser to parse and for the basic preview to render.
function buildTestDicom(): Buffer {
  const uiValue = (s: string) => padEven(Buffer.from(s, "ascii"), "\0");
  const strValue = (s: string) => padEven(Buffer.from(s, "ascii"), " ");

  const metaElements = Buffer.concat([
    explicitElement(0x0002, 0x0002, "UI", uiValue("1.2.840.10008.5.1.4.1.1.7")),
    explicitElement(0x0002, 0x0003, "UI", uiValue("1.2.3.4.5.6.7.8.9")),
    explicitElement(0x0002, 0x0010, "UI", uiValue("1.2.840.10008.1.2.1")),
  ]);
  const metaGroupLengthValue = Buffer.alloc(4);
  metaGroupLengthValue.writeUInt32LE(metaElements.length, 0);
  const fileMeta = Buffer.concat([
    explicitElement(0x0002, 0x0000, "UL", metaGroupLengthValue),
    metaElements,
  ]);

  const u16 = (n: number) => {
    const b = Buffer.alloc(2);
    b.writeUInt16LE(n, 0);
    return b;
  };

  const pixelData = Buffer.from([
    10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160,
  ]);

  const dataset = Buffer.concat([
    explicitElement(0x0008, 0x0060, "CS", strValue("OT")),
    explicitElement(0x0008, 0x0020, "DA", strValue("20260801")),
    explicitElement(0x0028, 0x0002, "US", u16(1)),
    explicitElement(0x0028, 0x0004, "CS", strValue("MONOCHROME2")),
    explicitElement(0x0028, 0x0010, "US", u16(4)),
    explicitElement(0x0028, 0x0011, "US", u16(4)),
    explicitElement(0x0028, 0x0100, "US", u16(8)),
    explicitElement(0x0028, 0x0101, "US", u16(8)),
    explicitElement(0x0028, 0x0102, "US", u16(7)),
    explicitElement(0x0028, 0x0103, "US", u16(0)),
    explicitElement(0x7fe0, 0x0010, "OB", pixelData),
  ]);

  const preamble = Buffer.alloc(128, 0);
  const magic = Buffer.from("DICM", "ascii");
  return Buffer.concat([preamble, magic, fileMeta, dataset]);
}

test.describe("Medical imaging preview", () => {
  let patientId: string;

  test.beforeEach(async () => {
    const patient = await prisma.patient.findFirstOrThrow({
      where: { email: "patient@example.com" },
    });
    patientId = patient.id;
  });

  test.afterEach(async () => {
    await prisma.medicalRecord.deleteMany({
      where: { patientId, type: "DOCUMENT", createdAt: { gte: new Date(Date.now() - 60_000) } },
    });
  });

  test("an uploaded image file renders an inline preview, not just a link", async ({ page }) => {
    await loginAs(page, "receptionist@nca.clinic");
    await page.goto(`/en/staff/patients/${patientId}`);

    await page.setInputFiles('input[name="file"]', {
      name: "xray.png",
      mimeType: "image/png",
      buffer: Buffer.from(TINY_PNG_BASE64, "base64"),
    });
    await page.click('button:has-text("Upload document")');
    await page.waitForLoadState("networkidle");

    const record = await prisma.medicalRecord.findFirstOrThrow({
      where: { patientId, fileName: "xray.png" },
    });
    expect(record.fileType).toBe("image/png");

    await expect(page.locator(`img[alt="xray.png"]`)).toBeVisible();
  });

  test("an uploaded DICOM file renders via the basic DICOM preview", async ({ page }) => {
    await loginAs(page, "receptionist@nca.clinic");
    await page.goto(`/en/staff/patients/${patientId}`);

    await page.setInputFiles('input[name="file"]', {
      name: "scan.dcm",
      mimeType: "application/octet-stream",
      buffer: buildTestDicom(),
    });
    await page.click('button:has-text("Upload document")');
    await page.waitForLoadState("networkidle");

    const record = await prisma.medicalRecord.findFirstOrThrow({
      where: { patientId, fileName: "scan.dcm" },
    });
    expect(record.fileData?.length).toBeGreaterThan(0);

    // The preview parses client-side; wait for it to move past the loading state.
    await expect(page.getByText("Loading preview…")).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByText(/couldn't read this DICOM file/i)).toHaveCount(0);
    await expect(page.getByText(/can't render/i)).toHaveCount(0);
    await expect(page.locator("canvas")).toBeVisible();
    await expect(page.getByText(/OT.*20260801.*4×4/)).toBeVisible();
  });
});
