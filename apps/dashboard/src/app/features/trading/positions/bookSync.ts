/**
 * Multi-device book sync — GET/PUT /api/book when signed in.
 * Local localStorage remains the working cache; server is latest-wins by updated_at.
 */
import { getBook, putBook } from '@convexa/api';
import { exportBookBlob, importBookBlobIfNewer, localBookTouchAt } from './store';

/** Pull server book after login; adopt if newer/nonempty. */
export async function pullServerBook(): Promise<void> {
  try {
    const env = await getBook();
    if (!env.blob || typeof env.blob !== 'object') return;
    const keys = Object.keys(env.blob as object);
    if (keys.length === 0 && env.updated_at <= 0) return;
    importBookBlobIfNewer(env.blob, env.updated_at);
  } catch {
    /* anonymous / offline — keep local */
  }
}

/** Push local book after a durable write (debounced by store). */
export async function pushLocalBook(): Promise<void> {
  try {
    const blob = exportBookBlob();
    const updated_at = localBookTouchAt() || Date.now() / 1000;
    await putBook({
      schema_version: blob.schema_version,
      updated_at,
      blob: blob as unknown as Record<string, unknown>,
    });
  } catch {
    /* not signed in or store unavailable */
  }
}
