/**
 * Convexa's one product version: the root package.json "version", in SemVer (e20082aa). The
 * dashboard's own package.json version is a workspace version, not this one.
 *
 * vite.config.mts reads it when the config loads, refuses one that isn't SemVer, and passes it
 * through `define`: inlined in the build, a global under the dev server and Vitest. Never write the
 * number here.
 */
declare global {
  /** Given by vite.config.mts's `define`: the root package.json "version". */
  const __CONVEXA_VERSION__: string;
}

/** The version the site footer states (shell/Footer.tsx). */
export const CONVEXA_VERSION: string = __CONVEXA_VERSION__;
