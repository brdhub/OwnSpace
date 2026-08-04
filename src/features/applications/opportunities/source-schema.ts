import { z } from "zod";

export const apiEnvelopeSchema = z.object({
  code: z.number(),
  msg: z.string().optional(),
  data: z.record(z.unknown()),
});

export const clientvarsDataSchema = z.object({
  table: z.string(),
}).passthrough();

export const viewsDataSchema = z.object({
  gzipViews: z.string(),
}).passthrough();

export const recordsDataSchema = z.object({
  encoding: z.number(),
  records: z.string(),
}).passthrough();

export const fieldSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  type: z.number(),
  property: z.unknown().optional(),
}).passthrough();

export const tableSnapshotSchema = z.object({
  meta: z.object({
    id: z.string(),
    rev: z.number().int().nonnegative(),
    recordsNum: z.number().int().nonnegative(),
    depRev: z.string().optional(),
  }).passthrough(),
  fieldMap: z.record(fieldSchema),
  viewMap: z.record(z.unknown()),
  recordCount: z.number().int().nonnegative().optional(),
}).passthrough();

export const viewDefinitionSchema = z.object({
  property: z.object({
    filterInfo: z.object({
      conjunction: z.enum(["and", "or"]),
      conditions: z.array(z.object({
        fieldId: z.string(),
        operator: z.literal("contains"),
        value: z.array(z.string()),
      }).passthrough()),
    }),
    sortInfo: z.unknown().optional(),
  }).passthrough(),
}).passthrough();

export const viewsSnapshotSchema = z.record(
  z.object({ rankMap: z.record(z.string()) }).passthrough(),
);

export const recordsPageSchema = z.object({
  recordMap: z.record(z.record(z.object({ value: z.unknown().optional() }).passthrough())),
}).passthrough();
