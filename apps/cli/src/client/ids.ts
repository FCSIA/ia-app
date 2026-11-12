import type { Id, TableNames } from "../../../convex/src/_generated/dataModel";

/**
 * Command-line arguments carry ids as plain strings; Convex ids are branded
 * only in TypeScript, so argv strings need this one honest cast. The backend
 * still rejects an id that doesn't exist or belongs to another table.
 */
export function asId<TableName extends TableNames>(value: string): Id<TableName> {
  return value as Id<TableName>;
}
