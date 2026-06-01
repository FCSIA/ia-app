import { v } from "convex/values";
import { schema } from "../src/schema";

type Tables = typeof schema.tables;
type TableName = keyof Tables & string;
type DocValidator<T extends TableName> = ReturnType<
  Tables[T]["validator"]["extend"]
>;

function withSystemFields<T extends TableName>(tableName: T) {
  return schema.tables[tableName].validator.extend({
    _id: v.id(tableName),
    _creationTime: v.number(),
  });
}

export const docs = Object.fromEntries(
  (Object.keys(schema.tables) as TableName[]).map((tableName) => [
    tableName,
    withSystemFields(tableName),
  ]),
) as {
  [T in TableName]: DocValidator<T>;
};
