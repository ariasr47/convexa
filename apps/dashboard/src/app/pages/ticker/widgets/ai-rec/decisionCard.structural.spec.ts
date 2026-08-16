/** Task 5 source boundaries. These guards intentionally inspect production source, not rendered CSS. */
import { describe, expect, it } from 'vitest';

const modules = import.meta.glob('./*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const productionEntries = Object.entries(modules).filter(([file]) =>
  /(?:DecisionCard|AnalysisSurface|presentationPolicy)\.(?:ts|tsx)$/.test(file),
);
const source = productionEntries.map(([, value]) => value).join('\n');
const productionFiles = productionEntries.map(([file]) => file);

function has(re: RegExp, text = source): boolean {
  return re.test(text);
}

describe('AI recommendation decision-card structural boundaries', () => {
  it('uses theme tokens rather than component-owned hex colours', () => {
    expect(has(/#[0-9a-f]{3,8}\b/i)).toBe(false);
    expect(has(/#fff\b/i)).toBe(false);
  });

  it('does not introduce an animation or keyframe family', () => {
    expect(has(/\b(?:keyframes|animation(?:Name|Duration|TimingFunction)?)\b/i)).toBe(false);
  });

  it('keeps static recommendation presentation isolated from live-stream state', () => {
    expect(has(/\b(?:LiveUpdate|streamOffline|EventSource|SSE)\b/)).toBe(false);
  });

  it('does not resurrect retired result labels', () => {
    expect(has(/Accept into ghost trade|Act as sim order|Show full analysis/)).toBe(false);
  });

  it('does not import or define an alternate simulated-entry dialog', () => {
    expect(has(/(?:TradeEntryDialog|tradeEntry).*from/)).toBe(false);
    expect(has(/\bTradeEntry\w*Dialog\b/)).toBe(false);
  });

  it('keeps API/client/store ownership outside the decision-card presentation files', () => {
    expect(productionFiles.length).toBe(3);
    expect(productionFiles.some((file) => /(?:api|client|store)/i.test(file))).toBe(false);
    expect(has(/(?:fetch\s*\(|axios|use[A-Z]\w*(?:Store|Client|Api)\b)/)).toBe(false);
  });
});
