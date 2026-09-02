import { describe, expect, it } from 'vitest';
import {
  folderNameAvoidsPathScanNeedles,
  isOperatorSessionArchiveSource,
} from './operatorSessionArchiveAllowlist';

describe('operatorSessionArchiveAllowlist', () => {
  it('operator folder name avoids path-scan needles', () => {
    expect(folderNameAvoidsPathScanNeedles('operator-session-archive')).toBe(true);
    expect(folderNameAvoidsPathScanNeedles('session-books')).toBe(false);
    expect(folderNameAvoidsPathScanNeedles('operator-_research')).toBe(false);
    expect(folderNameAvoidsPathScanNeedles('session-chain-archive')).toBe(false);
  });

  it('allowlist matches only the operator page prefix', () => {
    expect(
      isOperatorSessionArchiveSource('/src/app/pages/operator-session-archive/researchClient.ts'),
    ).toBe(true);
    expect(isOperatorSessionArchiveSource('/src/app/pages/ticker/TickerDashboard.tsx')).toBe(false);
    expect(isOperatorSessionArchiveSource('/src/app/app.tsx')).toBe(false);
  });
});
