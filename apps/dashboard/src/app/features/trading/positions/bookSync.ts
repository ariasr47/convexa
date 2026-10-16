/**
 * Multi-device book sync — GET/PUT /api/book when signed in.
 * Local localStorage remains the working cache; server is latest-wins by updated_at.
 */
import { dataMode, getBook, putBook } from '@convexa/api';
import { claimBookFor, exportBookBlob, importBookBlobIfNewer, localBookTouchAt } from './store';

/** Pull server book after login; adopt if newer/nonempty. Another account's local book is dropped
 *  first (claimBookFor), so it is never kept or pushed into this account (audit W-E01). */
export async function pullServerBook(userId?: string): Promise<void> {
  if (dataMode === 'demo') return;
  if (userId) claimBookFor(userId);
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

/** Push local book after a durable write (debounced by store). Resolves `true` only when the server
 *  accepted it: sign-out drops this browser's copy only then. */
export async function pushLocalBook(): Promise<boolean> {
  if (dataMode === 'demo') return false;
  try {
    const blob = exportBookBlob();
    const updated_at = localBookTouchAt() || Date.now() / 1000;
    await putBook({
      schema_version: blob.schema_version,
      updated_at,
      blob: blob as unknown as Record<string, unknown>,
    });
    return true;
  } catch {
    /* not signed in or store unavailable */
    return false;
  }
}
