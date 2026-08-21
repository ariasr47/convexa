import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pidsFromLsof, pidsFromNetstat, portFromLocalAddress } from './free-ports.mjs';

const NETSTAT = `
Active Connections

  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:8000           0.0.0.0:0              LISTENING       111
  TCP    127.0.0.1:8000         0.0.0.0:0              LISTENING       111
  TCP    [::]:8000              [::]:0                 LISTENING       222
  TCP    [::1]:4200             [::]:0                 LISTENING       333
  TCP    [::1]:4300             [::]:0                 LISTENING       444
  TCP    127.0.0.1:28000        0.0.0.0:0              LISTENING       555
  TCP    127.0.0.1:8000         127.0.0.1:51234        ESTABLISHED     111
  UDP    0.0.0.0:8000           *:*                                    999
`;

describe('portFromLocalAddress', () => {
  it('reads IPv4 and IPv6 netstat local-address fields', () => {
    assert.equal(portFromLocalAddress('127.0.0.1:8000'), 8000);
    assert.equal(portFromLocalAddress('[::1]:4200'), 4200);
    assert.equal(portFromLocalAddress('[::]:8000'), 8000);
    assert.equal(portFromLocalAddress('0.0.0.0:4300'), 4300);
  });
});

describe('pidsFromNetstat', () => {
  it('picks IPv4 AND IPv6 LISTENING rows and ignores ESTABLISHED / UDP', () => {
    assert.deepEqual(
      pidsFromNetstat(NETSTAT, 8000).sort((a, b) => a - b),
      [111, 222],
    );
    assert.deepEqual(pidsFromNetstat(NETSTAT, 4200), [333]);
    assert.deepEqual(pidsFromNetstat(NETSTAT, 4300), [444]);
  });

  it('does not treat :28000 as :8000 (substring trap of includes(`:${port} `))', () => {
    assert.deepEqual(pidsFromNetstat(NETSTAT, 8000).includes(555), false);
    assert.deepEqual(pidsFromNetstat(NETSTAT, 28000), [555]);
  });

  it('returns empty when nothing listens', () => {
    assert.deepEqual(pidsFromNetstat(NETSTAT, 9999), []);
  });
});

describe('pidsFromLsof', () => {
  it('dedupes terse PID lines', () => {
    assert.deepEqual(pidsFromLsof('111\n222\n111\n'), [111, 222]);
  });
});
