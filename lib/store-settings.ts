// Loads and saves store settings (server-only). Stored as one JSON value under
// settings.name = 'store'. Cached with the "settings" tag; the admin action
// calls updateTag(SETTINGS_TAG) after saving so every page updates at once.
import { cacheLife, cacheTag } from "next/cache";
import { dbConfigured, execute, selectOne } from "./db";
import { DEFAULT_SETTINGS, withDefaults, type StoreSettings } from "./store-config";

export const SETTINGS_TAG = "settings";

export async function getStoreSettings(): Promise<StoreSettings> {
  "use cache";
  cacheTag(SETTINGS_TAG);
  cacheLife("hours");
  if (!dbConfigured()) return DEFAULT_SETTINGS;
  try {
    const row = await selectOne<{ value: string }>("SELECT value FROM settings WHERE name = 'store'");
    return withDefaults(row ? JSON.parse(row.value) : null);
  } catch (e) {
    console.error("[settings] using defaults:", e instanceof Error ? e.message : e);
    return DEFAULT_SETTINGS;
  }
}

/** Fresh read (no cache), for checkout where the fee must be exact. */
export async function loadStoreSettingsFresh(): Promise<StoreSettings> {
  if (!dbConfigured()) return DEFAULT_SETTINGS;
  const row = await selectOne<{ value: string }>("SELECT value FROM settings WHERE name = 'store'");
  return withDefaults(row ? JSON.parse(row.value) : null);
}

export async function saveStoreSettings(s: StoreSettings): Promise<void> {
  await execute(
    "INSERT INTO settings (name, value) VALUES ('store', ?) ON DUPLICATE KEY UPDATE value = VALUES(value)",
    [JSON.stringify(s)],
  );
}
