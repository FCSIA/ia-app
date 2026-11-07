import { ConvexError } from "convex/values";
import { normalizeUniqueId } from "./_lib";

export const MAX_CSV_ROWS = 200;
const CSV_ROW_BATCH_SIZE = 5;

/** The result of one row: anything with a `kind`, where "skipped" may carry the reason. */
type RowOutcome = { kind: string; error?: string };
type SkippedRow = { kind: "skipped"; error: string };

export function assertCsvRowCount(
  count: number,
  messages: { none: string; tooMany: string },
) {
  if (count === 0) throw new ConvexError(messages.none);
  if (count > MAX_CSV_ROWS) throw new ConvexError(messages.tooMany);
}

/**
 * Runs each CSV row through `processRow` in batches. Rows are numbered from 2
 * (row 1 is the header). A repeated unique ID, or a row that throws, becomes a
 * skipped row instead of failing the import.
 */
export async function runCsvRows<Row extends { uniqueId: string }, Outcome extends RowOutcome>(
  rows: readonly Row[],
  options: {
    duplicateError: (uniqueId: string) => string;
    processRow: (row: Row) => Promise<Outcome>;
  },
): Promise<Array<{ rowNumber: number; outcome: Outcome | SkippedRow }>> {
  const seenUniqueIds = new Set<string>();
  const work = rows.map((row, index) => {
    const uniqueId = normalizeUniqueId(row.uniqueId);
    const duplicateWithinImport = uniqueId.length > 0 && seenUniqueIds.has(uniqueId);
    if (uniqueId.length > 0) seenUniqueIds.add(uniqueId);
    return { row, rowNumber: index + 2, uniqueId, duplicateWithinImport };
  });

  const results: Array<{ rowNumber: number; outcome: Outcome | SkippedRow }> = [];
  for (let start = 0; start < work.length; start += CSV_ROW_BATCH_SIZE) {
    const batch = work.slice(start, start + CSV_ROW_BATCH_SIZE);
    const outcomes = await Promise.all(
      batch.map(async (entry): Promise<Outcome | SkippedRow> => {
        if (entry.duplicateWithinImport) {
          return { kind: "skipped", error: options.duplicateError(entry.uniqueId) };
        }
        try {
          return await options.processRow(entry.row);
        } catch (error) {
          return {
            kind: "skipped",
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      }),
    );
    for (const [index, outcome] of outcomes.entries()) {
      results.push({ rowNumber: batch[index]!.rowNumber, outcome });
    }
  }
  return results;
}

/** The import already happened; a failed audit write must not report it as failed. */
export async function recordAuditBestEffort(description: string, write: () => Promise<unknown>) {
  try {
    await write();
  } catch (error) {
    console.error(`Failed to record ${description} audit event`, error);
  }
}
