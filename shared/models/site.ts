// shared/models/site.ts
//
// SITE SETTINGS (Aidan 2026-09-16): small key/value switches an admin
// flips from the back office — first one is the pre-launch lock
// ("password protected with a data capture only… early access vibes").
// Created at boot by ensureLaunchColumns, so prod needs no manual push.

import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SiteSetting = typeof siteSettings.$inferSelect;
