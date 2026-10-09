/** Test-support only (outside src/app glob). SPEC §2 allowlist prefix. */
export const OPERATOR_SESSION_ARCHIVE_FOLDER = '/pages/operator-session-archive/';

export function isOperatorSessionArchiveSource(path: string): boolean {
  return path.replace(/\\/g, '/').includes(OPERATOR_SESSION_ARCHIVE_FOLDER);
}
