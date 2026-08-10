/**
 * Pure alert evaluation against a structure snapshot.
 * Does not fetch; callers pass ticker/scan fields.
 */
import type { AlertEvent, AlertRule } from './types';

export interface StructureSnap {
  symbol: string;
  price?: number | null;
  score?: number | null;
  tier?: string | null;
  call_wall?: number | null;
  put_wall?: number | null;
  gamma_flip?: number | null;
  as_of?: number | null;
}

/** Prior evaluation memory so we fire on transitions, not every poll. */
export interface EvalMemory {
  /** last price for level_touch proximity */
  lastPrice?: number;
  /** last tier for tier_change */
  lastTier?: string | null;
  /** last score for score_gate */
  lastScore?: number | null;
  /** already fired score gate this session for this rule */
  scoreGateLatched?: boolean;
  /** level already crossed this session */
  levelLatched?: boolean;
}

function levelValue(snap: StructureSnap, level: AlertRule['level']): number | null {
  if (!level) return null;
  switch (level) {
    case 'call_wall':
      return snap.call_wall ?? null;
    case 'put_wall':
      return snap.put_wall ?? null;
    case 'gamma_flip':
      return snap.gamma_flip ?? null;
    case 'price':
      return null;
    default:
      return null;
  }
}

/**
 * Evaluate one rule against a snap + prior memory.
 * Returns an event + updated memory when a transition fires.
 */
export function evaluateRule(
  rule: AlertRule,
  snap: StructureSnap,
  mem: EvalMemory,
  now = Date.now(),
): { event: AlertEvent | null; memory: EvalMemory } {
  if (!rule.enabled) return { event: null, memory: mem };
  const sym = snap.symbol.toUpperCase();
  if (sym !== rule.symbol.toUpperCase()) return { event: null, memory: mem };

  const next: EvalMemory = { ...mem };
  let event: AlertEvent | null = null;

  if (rule.kind === 'tier_change') {
    const tier = snap.tier ?? null;
    if (mem.lastTier != null && tier != null && tier !== mem.lastTier) {
      event = {
        id: `ev_${now}_${rule.id}`,
        ruleId: rule.id,
        kind: 'tier_change',
        symbol: sym,
        message: `${sym} tier ${mem.lastTier} → ${tier}`,
        detail: snap.score != null ? `score ${snap.score}` : undefined,
        at: now,
        read: false,
      };
    }
    next.lastTier = tier;
  }

  if (rule.kind === 'score_gate') {
    const min = rule.scoreMin ?? 60;
    const score = snap.score ?? null;
    if (score != null) {
      const wasBelow = mem.lastScore == null || mem.lastScore < min;
      const nowAbove = score >= min;
      if (wasBelow && nowAbove && !mem.scoreGateLatched) {
        event = {
          id: `ev_${now}_${rule.id}`,
          ruleId: rule.id,
          kind: 'score_gate',
          symbol: sym,
          message: `${sym} score ≥ ${min} (now ${score})`,
          detail: snap.tier ? `tier ${snap.tier}` : undefined,
          at: now,
          read: false,
        };
        next.scoreGateLatched = true;
      }
      if (score < min) next.scoreGateLatched = false;
      next.lastScore = score;
    }
  }

  if (rule.kind === 'level_touch') {
    const price = snap.price;
    if (price != null && Number.isFinite(price) && mem.lastPrice != null) {
      let thr: number | null =
        rule.level === 'price' ? (rule.priceThreshold ?? null) : levelValue(snap, rule.level);
      if (thr != null && Number.isFinite(thr) && !mem.levelLatched) {
        const crossed =
          (mem.lastPrice < thr && price >= thr) || (mem.lastPrice > thr && price <= thr);
        if (crossed) {
          const label =
            rule.level === 'price' ? `$${thr}` : (rule.level ?? 'level').replace('_', ' ');
          event = {
            id: `ev_${now}_${rule.id}`,
            ruleId: rule.id,
            kind: 'level_touch',
            symbol: sym,
            message: `${sym} touched ${label}`,
            detail: `price ${price.toFixed(2)} · level ${thr.toFixed(2)}`,
            at: now,
            read: false,
          };
          next.levelLatched = true;
        }
      }
      // Clear latch if price moves away by >0.5% of level
      if (thr != null && Math.abs(price - thr) / Math.max(Math.abs(thr), 1e-6) > 0.005) {
        next.levelLatched = false;
      }
    }
    if (price != null) next.lastPrice = price;
  }

  return { event, memory: next };
}
