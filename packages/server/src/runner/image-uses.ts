// The chat images the cache's messages hold, read from its database: the images of every
// repository's sessions, as they share the data folder.
import type { DatabaseSync } from "node:sqlite";

/** Each image of each message, skipping an item whose data is not JSON. */
const IMAGES = `FROM items,
    json_each(CASE WHEN json_valid(items.data) THEN items.data ELSE '{}' END, '$.images') AS image
  WHERE items.kind = 'message'`;

/** The chat images the messages of every repository hold, by their IDs, for the cleanup. */
export function imagesInUse(db: DatabaseSync): Set<string> {
  const rows = db
    .prepare(`SELECT DISTINCT json_extract(image.value, '$.id') AS id ${IMAGES}`)
    .all() as Array<{ id: string | null }>;
  return new Set(rows.flatMap(({ id }) => (id === null ? [] : [id])));
}

/** Whether a message of any repository holds the chat image `id`, taken back or not. */
export function imageInUse(db: DatabaseSync, id: string): boolean {
  return (
    db.prepare(`SELECT 1 ${IMAGES} AND json_extract(image.value, '$.id') = ? LIMIT 1`).get(id) !==
    undefined
  );
}
