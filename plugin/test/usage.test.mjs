import test from 'node:test';
import assert from 'node:assert/strict';

import { createUsageMeter } from '../usage.js';

test('usage meter records attempts, outcomes, tokens, limits, and blocks', () => {
  let now = 1_000;
  const meter = createUsageMeter(() => now);
  meter.attempt('low', 'summary');
  now = 1_100;
  meter.result({
    policy: 'low',
    depth: 'summary',
    outcome: 'ok',
    usage: { inputTokens: 120, outputTokens: 30 },
  });
  meter.attempt('high', 'snippet');
  meter.result({
    policy: 'high',
    depth: 'snippet',
    outcome: 'empty',
  });
  meter.attempt('always', 'off');
  meter.result({
    policy: 'always',
    depth: 'off',
    outcome: 'error',
    usage: { inputTokens: 50, outputTokens: 0 },
  });
  meter.limited();
  meter.blocked();

  const snapshot = meter.snapshot();
  assert.equal(snapshot.totals.calls, 3);
  assert.equal(snapshot.totals.ok, 1);
  assert.equal(snapshot.totals.empty, 1);
  assert.equal(snapshot.totals.errors, 1);
  assert.equal(snapshot.totals.limited, 1);
  assert.equal(snapshot.totals.blocked, 1);
  assert.equal(snapshot.totals.inputTokens, 170);
  assert.equal(snapshot.totals.outputTokens, 30);
  assert.equal(snapshot.byPolicy.low.calls, 1);
  assert.equal(snapshot.byPolicy.low.inputTokens, 120);
  assert.equal(snapshot.byDepth.summary.ok, 1);
  assert.equal(snapshot.byDepth.snippet.empty, 1);
  assert.equal(snapshot.byDepth.off.errors, 1);
  assert.equal(snapshot.lastAt, now);
});

test('usage snapshot is a detached copy', () => {
  const meter = createUsageMeter(() => 42);
  meter.attempt('low', 'summary');
  const first = meter.snapshot();
  first.totals.calls = 999;
  first.byPolicy.low.calls = 999;
  const second = meter.snapshot();
  assert.equal(second.totals.calls, 1);
  assert.equal(second.byPolicy.low.calls, 1);
  assert.equal(second.startedAt, 42);
});

test('usage meter ignores non-positive or non-finite token values', () => {
  const meter = createUsageMeter(() => 1);
  meter.attempt('low', 'summary');
  meter.result({
    policy: 'low',
    depth: 'summary',
    outcome: 'ok',
    usage: { inputTokens: Number.NaN, outputTokens: -5 },
  });
  const snapshot = meter.snapshot();
  assert.equal(snapshot.totals.inputTokens, 0);
  assert.equal(snapshot.totals.outputTokens, 0);
});
