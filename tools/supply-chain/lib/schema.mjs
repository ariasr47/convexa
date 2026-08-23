import fs from 'node:fs/promises';

export async function loadSchema(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}
export function validateStrict(value, schema, path = '$') {
  if (schema?.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new TypeError(`${path}: expected object`);
    const keys = new Set(Object.keys(schema.properties ?? {}));
    if (schema.additionalProperties === false)
      for (const key of Object.keys(value))
        if (!keys.has(key)) throw new TypeError(`${path}.${key}: unknown property`);
    for (const key of schema.required ?? [])
      if (!(key in value)) throw new TypeError(`${path}.${key}: required`);
    for (const [key, child] of Object.entries(schema.properties ?? {}))
      if (key in value) validateStrict(value[key], child, `${path}.${key}`);
  } else if (schema?.type === 'array') {
    if (!Array.isArray(value)) throw new TypeError(`${path}: expected array`);
    if (schema.minItems != null && value.length < schema.minItems)
      throw new TypeError(`${path}: too few items`);
    for (const [index, item] of value.entries())
      validateStrict(item, schema.items, `${path}[${index}]`);
  } else if (schema?.type === 'string' && typeof value !== 'string')
    throw new TypeError(`${path}: expected string`);
  else if (schema?.type === 'integer' && !Number.isInteger(value))
    throw new TypeError(`${path}: expected integer`);
  return true;
}
