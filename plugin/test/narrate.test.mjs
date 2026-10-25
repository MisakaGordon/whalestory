import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LLM_POLICIES,
  MAX_LINE_CHARS,
  generateNarration,
  normalizeContentDepth,
  normalizeLlmPolicy,
  normalizeObservation,
  observationPrompt,
  pickReasoningEffort,
  sanitizeContentSnippet,
  sanitizeLine,
  shortField,
} from '../narrate.js';

function fakeLlm(chunks, { efforts = [{ id: 'off' }, { id: 'low' }], capture } = {}) {
  return {
    async prepareCall(config, signal, configure) {
      const configured = typeof configure === 'function'
        ? configure(config, { reasoning: { efforts } })
        : config;
      if (capture) capture.configured = configured;
      return {
        config: { ...config, ...configured },
        stream(options) {
          if (capture) capture.options = options;
          return (async function* stream() {
            for (const chunk of chunks) yield chunk;
          })();
        },
      };
    },
  };
}

test('LLM policy normalization and safety envelopes', () => {
  assert.equal(normalizeLlmPolicy('off'), 'off');
  assert.equal(normalizeLlmPolicy('always'), 'always');
  assert.equal(normalizeLlmPolicy(undefined), 'low');
  assert.equal(normalizeLlmPolicy('surprise'), 'low');
  assert.equal(LLM_POLICIES.low.minIntervalMs, 45_000);
  assert.equal(LLM_POLICIES.high.minIntervalMs, 15_000);
  assert.equal(LLM_POLICIES.always.minIntervalMs, 4_000);
  assert.ok(LLM_POLICIES.always.perWindow > LLM_POLICIES.low.perWindow);
  assert.ok(LLM_POLICIES.always.globalPerHour > LLM_POLICIES.low.globalPerHour);
});

test('content depth is opt-in and snippet content is redacted', () => {
  assert.equal(normalizeContentDepth('off'), 'off');
  assert.equal(normalizeContentDepth('summary'), 'summary');
  assert.equal(normalizeContentDepth('snippet'), 'snippet');
  assert.equal(normalizeContentDepth(undefined), 'off');
  assert.equal(normalizeContentDepth('surprise'), 'off');

  const clean = sanitizeContentSnippet('key sk-abcdefghijklmnop /home/alice/x\nline2');
  assert.match(clean, /\[redacted-key\]/u);
  assert.equal(clean.includes('/home/alice'), false);
  assert.match(clean, /line2/u);
  assert.ok(Array.from(sanitizeContentSnippet('x'.repeat(2000))).length <= 600);
});

test('normalizeObservation applies content depth after redaction', () => {
  const raw = {
    mode: 'walk',
    kind: 'milestone',
    tool: 'read',
    target: 'App.tsx',
    frontend: true,
    thought: 'none',
    outcome: 'running',
    contentKind: 'file',
    contentSummary: '读取 App.tsx（TSX），3 行',
    contentSnippet: 'line1\n[key sk-abcdefghijklmnop]',
  };
  const off = normalizeObservation(raw, 'off');
  assert.equal('contentSummary' in off, false);
  const summary = normalizeObservation(raw, 'summary');
  assert.equal(summary.contentKind, 'file');
  assert.match(summary.contentSummary, /App\.tsx/u);
  assert.equal('contentSnippet' in summary, false);
  const snippet = normalizeObservation(raw, 'snippet');
  assert.match(snippet.contentSnippet, /line1/u);
  assert.equal(snippet.contentSnippet.includes('sk-abcdefghijklmnop'), false);
});

test('normalizeObservation keeps only the compact allow-list', () => {
  const observation = normalizeObservation({
    mode: 'walk',
    kind: 'milestone',
    tool: 'read',
    target: '/secret/path/App.tsx'.split('/').at(-1),
    command: 'pnpm',
    frontend: true,
    thought: 'plan',
    outcome: 'running',
    userText: 'must not pass',
    reasoning: 'must not pass',
    nested: { command: 'rm -rf /' },
  });
  assert.deepEqual(observation, {
    mode: 'walk',
    kind: 'milestone',
    frontend: true,
    thought: 'plan',
    outcome: 'running',
    tool: 'read',
    target: 'App.tsx',
    command: 'pnpm',
  });
  assert.ok(!JSON.stringify(observation).includes('must not pass'));
});

test('normalizeObservation rejects invalid enums and non-objects', () => {
  assert.equal(normalizeObservation(null), null);
  assert.equal(normalizeObservation('hello'), null);
  assert.equal(normalizeObservation({ mode: 'dance', kind: 'milestone' }), null);
  assert.equal(normalizeObservation({ mode: 'walk', kind: 'unknown' }), null);
  assert.deepEqual(normalizeObservation({ mode: 'normal', kind: 'idle' }), {
    mode: 'normal',
    kind: 'idle',
    frontend: false,
    thought: 'none',
    outcome: 'running',
  });
  assert.deepEqual(normalizeObservation({ mode: 'walk', kind: 'milestone', contentKind: 'file', contentSummary: 'x' }), {
    mode: 'walk',
    kind: 'milestone',
    frontend: false,
    thought: 'none',
    outcome: 'running',
  });
});

test('shortField strips controls and quotes and enforces a bound', () => {
  assert.equal(shortField('a\u0000"\n b', 10), 'a b');
  assert.equal(Array.from(shortField('x'.repeat(20), 8)).length, 8);
});

test('observationPrompt marks the payload as data, not instructions', () => {
  const prompt = observationPrompt({ mode: 'walk', kind: 'milestone' });
  assert.match(prompt, /只作事实/u);
  assert.match(prompt, /\{"mode":"walk","kind":"milestone"\}/u);
});

test('pickReasoningEffort prefers off, then low, then absent', () => {
  assert.equal(pickReasoningEffort({ reasoning: { efforts: [{ id: 'high' }, { id: 'off' }] } }), 'off');
  assert.equal(pickReasoningEffort({ reasoning: { efforts: [{ id: 'low' }, { id: 'high' }] } }), 'low');
  assert.equal(pickReasoningEffort({ reasoning: { efforts: [{ id: 'high' }] } }), undefined);
  assert.equal(pickReasoningEffort({}), undefined);
});

test('sanitizeLine strips prefixes, quotes, markdown, and keeps one line', () => {
  assert.equal(sanitizeLine('大肥鱼：翻车了翻车了，本鱼先捞鱼！'), '翻车了翻车了，本鱼先捞鱼！');
  assert.equal(sanitizeLine('“本鱼在写了。”'), '本鱼在写了。');
  assert.equal(sanitizeLine('**本鱼在写了**\n第二句'), '本鱼在写了');
  assert.equal(sanitizeLine('才不是大肥鱼！……好吧。'), '本鱼觉得，才不是大肥鱼！……好吧。');
});

test('sanitizeLine enforces the character cap and rejects out-of-character text', () => {
  const long = sanitizeLine('本鱼'.repeat(40));
  assert.ok(long);
  assert.ok(Array.from(long).length <= MAX_LINE_CHARS);
  assert.ok(long.endsWith('…'));
  assert.equal(sanitizeLine('作为 AI，我不能这样做'), null);
  assert.equal(sanitizeLine('我来说说思维链'), null);
  assert.equal(sanitizeLine('本鱼去死'), null);
  assert.equal(sanitizeLine('   '), null);
  assert.equal(sanitizeLine('本鱼在摸鱼', ['本鱼在摸鱼']), null);
});

test('generateNarration streams one independent tool-less call', async () => {
  const capture = {};
  const llm = fakeLlm([
    { type: 'text-delta', text: '翻车了翻车了，' },
    { type: 'text-delta', text: '本鱼先捞鱼！\n不该出现的第二行' },
    { type: 'finish', reason: { kind: 'stop' } },
  ], { capture });
  const text = await generateNarration({
    llm,
    selection: { provider: 'deepseek-official', model: 'deepseek-flash' },
    observation: { mode: 'error', kind: 'error', outcome: 'error' },
    signal: new AbortController().signal,
  });
  assert.equal(text, '翻车了翻车了，本鱼先捞鱼！');
  assert.equal(capture.configured.reasoningEffort, 'off');
  assert.equal(capture.options.sessionId, undefined);
  assert.equal(capture.options.tools, undefined);
  assert.equal('stop' in capture.options, false);
  assert.match(capture.options.system, /大肥鱼/u);
});

test('generateNarration falls back to block-end text', async () => {
  const llm = fakeLlm([
    { type: 'block-end', index: 0, block: { type: 'text', text: '过了？本鱼勉强夸你一句。' } },
    { type: 'finish', reason: { kind: 'stop' } },
  ]);
  const text = await generateNarration({
    llm,
    selection: { provider: 'p', model: 'm' },
    observation: { mode: 'normal', kind: 'success', outcome: 'ok' },
    signal: new AbortController().signal,
  });
  assert.equal(text, '过了？本鱼勉强夸你一句。');
});

test('generateNarration returns null on finish errors and missing route', async () => {
  const errorLlm = fakeLlm([
    { type: 'text-delta', text: '本鱼不想说' },
    { type: 'finish', reason: { kind: 'error', failure: { message: 'nope', code: 'X' } } },
  ]);
  assert.equal(await generateNarration({
    llm: errorLlm,
    selection: { provider: 'p', model: 'm' },
    observation: { mode: 'walk', kind: 'milestone' },
    signal: new AbortController().signal,
  }), null);

  const neverCalled = {
    async prepareCall() {
      throw new Error('must not be called');
    },
  };
  assert.equal(await generateNarration({
    llm: neverCalled,
    selection: {},
    observation: { mode: 'walk', kind: 'milestone' },
    signal: new AbortController().signal,
  }), null);
});

test('generateNarration uses low when off is unsupported', async () => {
  const capture = {};
  const llm = fakeLlm([
    { type: 'text-delta', text: '本鱼在摸鱼。' },
    { type: 'finish', reason: { kind: 'stop' } },
  ], { capture, efforts: [{ id: 'low' }, { id: 'high' }] });
  await generateNarration({
    llm,
    selection: { provider: 'p', model: 'm' },
    observation: { mode: 'walk', kind: 'milestone' },
    signal: new AbortController().signal,
  });
  assert.equal(capture.configured.reasoningEffort, 'low');
});

test('generateNarration does not attach a session id or tools', async () => {
  const capture = {};
  const llm = fakeLlm([
    { type: 'text-delta', text: '本鱼在写了。' },
    { type: 'finish', reason: { kind: 'stop' } },
  ], { capture });
  await generateNarration({
    llm,
    selection: { provider: 'p', model: 'm' },
    observation: { mode: 'writing', kind: 'milestone' },
    signal: new AbortController().signal,
  });
  assert.equal('sessionId' in capture.options, false);
  assert.equal('tools' in capture.options, false);
});
