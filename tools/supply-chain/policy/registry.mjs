export function resolveCatalog(catalog, id) {
  if (!catalog || !Object.hasOwn(catalog, id)) throw new Error(`unknown catalog id: ${id}`);
  return catalog[id];
}
