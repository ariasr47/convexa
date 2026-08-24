import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  bomRef,
  compareComponents,
  componentSetHash,
  normalizeComponent,
  requiredSeedsPresent,
} from './component-oracle.mjs';
import { spawnCaptured } from './lib/process.mjs';

export function makeInventory(subject, components) {
  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.6',
    metadata: {
      properties: [
        { name: 'convexa:inventory_basis', value: 'lock_derived' },
        { name: 'convexa:subject_id', value: subject },
      ],
    },
    components: components.map((x) => ({ ...normalizeComponent(x), 'bom-ref': bomRef(x) })),
  };
}

export function validateInventory(expected, inventory, { subjectId, requiredSeeds = [] } = {}) {
  try {
    if (
      !inventory ||
      inventory.bomFormat !== 'CycloneDX' ||
      inventory.specVersion !== '1.6' ||
      !Array.isArray(inventory.components) ||
      inventory.components.length === 0
    )
      return blocked('inventory-schema');
    const properties = inventory.metadata?.properties;
    if (!Array.isArray(properties) || properties.length !== 2) return blocked('inventory-metadata');
    const propertyMap = new Map(properties.map((p) => [p?.name, p?.value]));
    if (propertyMap.get('convexa:inventory_basis') !== 'lock_derived')
      return blocked('inventory-basis');
    if (subjectId !== undefined && propertyMap.get('convexa:subject_id') !== subjectId)
      return fail('inventory-subject');
    const actual = inventory.components.map((component) => {
      if (
        !component ||
        Object.keys(component).sort().join(',') !==
          'bom-ref,ecosystem,family,name,provenance,version'
      )
        throw new TypeError('inventory-component-fields');
      const { 'bom-ref': ref, ...identity } = component;
      const normalized = normalizeComponent(identity);
      if (ref !== bomRef(normalized)) throw new TypeError('inventory-bom-ref');
      return normalized;
    });
    if (!compareComponents(expected, actual)) return fail('inventory-component-set');
    if (requiredSeeds.length && !requiredSeedsPresent(actual, requiredSeeds))
      return fail('inventory-required-seed');
    return {
      state: 'pass',
      rule_id: 'inventory-valid',
      completion: 'complete',
      component_count: actual.length,
      component_set_sha256: componentSetHash(actual),
      required_seeds_present: true,
    };
  } catch {
    return blocked('inventory-malformed');
  }
}
const blocked = (rule_id) => ({ state: 'blocked', rule_id, completion: 'malformed' });
const fail = (rule_id) => ({ state: 'fail', rule_id, completion: 'complete' });

export async function generateInventoryWithSyft({
  executable,
  subjectId,
  expected,
  runner = spawnCaptured,
}) {
  if (!executable || !Array.isArray(expected) || expected.length === 0)
    return { state: 'blocked', rule_id: 'syft-unavailable', completion: 'unavailable' };
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'convexa-syft-catalog-'));
  try {
    for (const [index, component] of expected.entries()) {
      const dir = path.join(root, String(index).padStart(6, '0'));
      await fs.mkdir(dir);
      await fs.writeFile(
        path.join(dir, 'package.json'),
        JSON.stringify({ name: component.name, version: component.version }),
      );
    }
    const run = await runner(
      executable,
      [
        'scan',
        `dir:${root}`,
        '--select-catalogers',
        'javascript-package-cataloger',
        '-o',
        'syft-json',
      ],
      { timeoutMs: 300000, maxOutputBytes: 64 * 1024 * 1024 },
    );
    if (run.state === 'blocked' || run.raw_exit_code !== 0)
      return {
        state: 'blocked',
        rule_id: 'syft-execution',
        completion: 'unavailable',
        raw_output_sha256: run.raw_output_sha256,
      };
    let document;
    try {
      document = JSON.parse(run.output);
    } catch {
      return {
        state: 'blocked',
        rule_id: 'syft-output',
        completion: 'malformed',
        raw_output_sha256: run.raw_output_sha256,
      };
    }
    if (!Array.isArray(document.artifacts))
      return {
        state: 'blocked',
        rule_id: 'syft-output',
        completion: 'malformed',
        raw_output_sha256: run.raw_output_sha256,
      };
    const byIdentity = new Map(
        expected.map((component) => [`${component.name}\0${component.version}`, component]),
      ),
      seen = new Set(),
      normalized = [];
    for (const artifact of document.artifacts) {
      const key = `${artifact?.name}\0${artifact?.version}`;
      const component = byIdentity.get(key);
      if (!component || seen.has(key))
        return {
          state: 'fail',
          rule_id: 'syft-component-set',
          completion: 'complete',
          raw_output_sha256: run.raw_output_sha256,
        };
      seen.add(key);
      normalized.push(component);
    }
    if (seen.size !== expected.length)
      return {
        state: 'fail',
        rule_id: 'syft-component-set',
        completion: 'complete',
        raw_output_sha256: run.raw_output_sha256,
      };
    const inventory = makeInventory(subjectId, normalized),
      validation = validateInventory(expected, inventory, { subjectId });
    return { ...validation, inventory, raw_output_sha256: run.raw_output_sha256 };
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}
