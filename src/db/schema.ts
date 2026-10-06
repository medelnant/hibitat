import { boolean, doublePrecision, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const nodes = pgTable("nodes", {
  id: text("id").primaryKey(),
  type: text("type", { enum: ["exhibit", "curator", "community"] }).notNull(),
  name: text("name").notNull(),
  sub: text("sub").notNull().default(""),
  story: text("story").notNull().default(""),
  color: text("color").notNull(),
  kind: text("kind", { enum: ["place", "thing"] }),
  legacy: boolean("legacy").notNull().default(false),
  curatedBy: text("curated_by"),
  curatedSince: text("curated_since"),
  // Layout positions are stored so the constellation never reshuffles for existing visitors.
  x: doublePrecision("x").notNull(),
  y: doublePrecision("y").notNull(),
  z: doublePrecision("z").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const edges = pgTable(
  "edges",
  {
    id: serial("id").primaryKey(),
    source: text("source")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    target: text("target")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    curates: boolean("curates").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("edges_pair_idx").on(t.source, t.target)],
);

export type NodeRow = typeof nodes.$inferSelect;
export type EdgeRow = typeof edges.$inferSelect;
