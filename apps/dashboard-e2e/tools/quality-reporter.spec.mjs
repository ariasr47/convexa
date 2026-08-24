import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('visual reporter maps named actual/diff attachments instead of first PNG', () => {
  const source = fs.readFileSync(
    path.resolve('apps/dashboard-e2e/src/quality/reporters/quality-reporter.ts'),
    'utf8',
  );
  assert.match(source, /visualAttachmentRole\(attachment\)/);
  assert.match(source, /if \(role === 'actual'\) actualArtifact = artifact/);
  assert.match(source, /if \(role === 'diff'\) diffArtifact = artifact/);
  assert.doesNotMatch(source, /!actualArtifact && path\.extname/);
  assert.match(source, /diff_path: diffArtifact\?\.path \?\? null/);
  assert.match(source, /includes\('A11Y-'\) && !String\(x\.identity\)\.includes\('A11Y-B'\)/);
});
