/**
 * In-memory usage meter for the independent narrator calls.
 *
 * It records counts and provider-reported token usage only. It never records a
 * prompt, observation, model output, SessionId, or path. The snapshot resets
 * when the Host plugin unloads or the process restarts.
 */

const POLICIES = ['low', 'high', 'always'];
const DEPTHS = ['off', 'summary', 'snippet'];

function counters() {
  return {
    calls: 0,
    ok: 0,
    empty: 0,
    errors: 0,
    inputTokens: 0,
    outputTokens: 0,
  };
}

/**
 * @param {() => number} [now]
 * @returns {{
 *   attempt: (policy: string, depth: string) => void,
 *   result: (input: { policy: string, depth: string, outcome: 'ok'|'empty'|'error', usage?: { inputTokens?: number, outputTokens?: number } }) => void,
 *   limited: () => void,
 *   blocked: () => void,
 *   snapshot: () => object,
 * }}
 */
export function createUsageMeter(now = () => Date.now()) {
  const startedAt = now();
  let lastAt = startedAt;
  const totals = { ...counters(), limited: 0, blocked: 0 };
  const byPolicy = Object.fromEntries(POLICIES.map((policy) => [policy, counters()]));
  const byDepth = Object.fromEntries(DEPTHS.map((depth) => [depth, counters()]));

  const bump = (row, field, value = 1) => {
    if (row !== undefined && Number.isFinite(value)) row[field] += value;
  };

  const attempt = (policy, depth) => {
    lastAt = now();
    bump(totals, 'calls');
    bump(byPolicy[policy], 'calls');
    bump(byDepth[depth], 'calls');
  };

  const result = ({ policy, depth, outcome, usage }) => {
    lastAt = now();
    const field = outcome === 'ok' ? 'ok' : outcome === 'empty' ? 'empty' : 'errors';
    const input = Number(usage?.inputTokens);
    const output = Number(usage?.outputTokens);
    bump(totals, field);
    bump(byPolicy[policy], field);
    bump(byDepth[depth], field);
    if (Number.isFinite(input) && input > 0) {
      bump(totals, 'inputTokens', input);
      bump(byPolicy[policy], 'inputTokens', input);
      bump(byDepth[depth], 'inputTokens', input);
    }
    if (Number.isFinite(output) && output > 0) {
      bump(totals, 'outputTokens', output);
      bump(byPolicy[policy], 'outputTokens', output);
      bump(byDepth[depth], 'outputTokens', output);
    }
  };

  const limited = () => {
    lastAt = now();
    totals.limited += 1;
  };

  const blocked = () => {
    lastAt = now();
    totals.blocked += 1;
  };

  const snapshot = () => ({
    startedAt,
    lastAt,
    totals: { ...totals },
    byPolicy: Object.fromEntries(POLICIES.map((policy) => [policy, { ...byPolicy[policy] }])),
    byDepth: Object.fromEntries(DEPTHS.map((depth) => [depth, { ...byDepth[depth] }])),
  });

  return { attempt, result, limited, blocked, snapshot };
}
