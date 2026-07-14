import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

const CSV_MIME_TYPES = [
  "text/csv",
  "text/comma-separated-values",
  "application/csv",
  "application/vnd.ms-excel",
  "text/plain",
] as const;

const MAX_CSV_BYTES = 1_000_000;

export async function pickCsvFile() {
  const result = await DocumentPicker.getDocumentAsync({
    type: [...CSV_MIME_TYPES],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;

  const asset = result.assets[0];
  if (!asset) throw new Error("No file was selected.");
  if (!asset.name.toLowerCase().endsWith(".csv")) {
    throw new Error("Choose a file whose name ends in .csv.");
  }
  if (asset.size != null && asset.size > MAX_CSV_BYTES) {
    throw new Error("This CSV is larger than 1 MB. Split it into smaller files.");
  }

  const file = new File(asset.uri);
  try {
    const text = await file.text();
    if (text.length > MAX_CSV_BYTES) {
      throw new Error("This CSV is larger than 1 MB. Split it into smaller files.");
    }
    return { name: asset.name, size: asset.size ?? text.length, text };
  } finally {
    if (file.exists) file.delete();
  }
}

export async function shareCsv({
  fileName,
  contents,
  dialogTitle,
}: {
  fileName: string;
  contents: string;
  dialogTitle: string;
}) {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("File sharing is not available on this device.");
  }

  const file = new File(Paths.cache, fileName);
  try {
    file.create({ overwrite: true, intermediates: true });
    file.write(`\uFEFF${contents}`);
    await Sharing.shareAsync(file.uri, {
      dialogTitle,
      mimeType: "text/csv",
      UTI: "public.comma-separated-values-text",
    });
  } finally {
    if (file.exists) file.delete();
  }
}

export function datedCsvName(prefix: string) {
  const date = new Date().toISOString().slice(0, 10);
  return `${prefix}-${date}.csv`;
}
