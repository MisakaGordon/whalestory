import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const code = readFileSync(new URL('../client.js', import.meta.url), 'utf8');

function loadClient() {
  let definition;
  const React = {
    createElement() {},
    useEffect() {},
    useLayoutEffect() {},
    useMemo() {},
    useRef() {},
    useState() { return [null, () => {}]; },
    useCallback(fn) { return fn; },
  };
  const sandbox = {
    window: {
      __ModuleLoader__: {
        load(value) { definition = value; },
      },
      sessionStorage: { getItem() { return null; }, setItem() {} },
      matchMedia() {
        return { matches: false, addEventListener() {}, removeEventListener() {} };
      },
      addEventListener() {},
      removeEventListener() {},
    },
    document: { visibilityState: 'visible' },
    Image: function Image() {},
    AbortController,
    performance: { now: () => 0 },
    fetch: async () => { throw new Error('no network in tests'); },
    console,
  };
  vm.runInNewContext(code, sandbox, { filename: 'client.js' });
  assert.equal(typeof definition, 'object', 'client bundle must call __ModuleLoader__.load');
  const module = definition.factory((id) => {
    if (id === 'react') return React;
    throw new Error(`unexpected require: ${id}`);
  });
  return module.__test;
}

const T = loadClient();

function base(overrides = {}) {
  return {
    sessionId: 'session-test',
    running: false,
    pending: false,
    lastAgentError: null,
    runningCall: null,
    hasPartialText: false,
    thought: 'none',
    partialKey: '',
    lastNode: null,
    recentTools: '',
    recentUserText: '',
    ...overrides,
  };
}

function toolResult(overrides = {}) {
  return {
    kind: 'tool-result',
    seq: 12,
    name: 'read',
    isError: false,
    content: [{ type: 'text', text: 'ok' }],
    call: { name: 'read', argsRaw: '{"file_path":"src/App.tsx"}' },
    ...overrides,
  };
}

test('phrase bank keeps every line short and first-person', () => {
  const lines = [];
  const walk = (value) => {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') lines.push(item);
        else if (item && typeof item.text === 'string') lines.push(item.text);
      }
    } else if (value && typeof value === 'object') {
      for (const item of Object.values(value)) walk(item);
    }
  };
  walk(T.PHRASES);
  assert.ok(lines.length >= 80, 'expected a substantial phrase bank');
  for (const line of lines) {
    assert.ok(Array.from(line).length <= 36, `too long: ${line}`);
    assert.match(line, /本鱼|老娘|大肥鱼我|我/u, `missing first person: ${line}`);
  }
});

test('idle session derives normal mode and no LLM eligibility', () => {
  const signal = T.deriveSignal(base());
  assert.equal(signal.mode, 'normal');
  assert.equal(signal.kind, 'idle');
  assert.equal(signal.llmEligible, false);
});

test('running read call derives walk mode', () => {
  const signal = T.deriveSignal(base({
    running: true,
    runningCall: { callId: 'call-1', name: 'read', phase: 'start', argsRaw: '{"file_path":"src/App.tsx"}' },
  }));
  assert.equal(signal.mode, 'walk');
  assert.equal(signal.tool, 'read');
  assert.equal(signal.file, 'App.tsx');
  assert.equal(signal.frontend, true);
  assert.equal(signal.priority, 1);
  assert.equal(signal.llmEligible, true);
});

test('write tool and streaming text both derive writing mode', () => {
  const byTool = T.deriveSignal(base({
    running: true,
    runningCall: { callId: 'call-2', name: 'edit', phase: 'start', argsRaw: '{"file_path":"src/App.css"}' },
  }));
  assert.equal(byTool.mode, 'writing');
  assert.equal(byTool.frontend, true);
  assert.equal(byTool.priority, 2);

  const byText = T.deriveSignal(base({
    running: true,
    hasPartialText: true,
    partialKey: '1:2',
  }));
  assert.equal(byText.mode, 'writing');
  assert.equal(byText.kind, 'milestone');
});

test('reasoning-only work stays in walk mode and carries thought class', () => {
  const signal = T.deriveSignal(base({
    running: true,
    thought: 'debug',
    partialKey: '1:3',
    recentUserText: '修一下这个前端 bug',
  }));
  assert.equal(signal.mode, 'walk');
  assert.equal(signal.thought, 'debug');
  assert.equal(signal.frontend, true);
});

test('pending interaction derives asking mode', () => {
  const signal = T.deriveSignal(base({ running: true, pending: true }));
  assert.equal(signal.mode, 'asking');
  assert.equal(signal.kind, 'question');
  assert.equal(signal.priority, 3);
});

test('turn errors, tool errors, and bash exit markers all derive attention', () => {
  for (const node of [
    { kind: 'turn-error', seq: 20, turn: 1, step: 1, message: '' },
    toolResult({ isError: true, name: 'edit' }),
    toolResult({ name: 'bash', content: [{ type: 'text', text: 'boom\n[exit code: 1]' }] }),
  ]) {
    const signal = T.deriveSignal(base({ lastNode: node }));
    assert.equal(signal.mode, 'error', node.kind);
    assert.equal(signal.outcome, 'error');
    assert.equal(signal.priority, 4);
  }
});

test('successful test command and frontend write become success beats', () => {
  const testSignal = T.deriveSignal(base({
    lastNode: toolResult({
      name: 'bash',
      call: { name: 'bash', argsRaw: '{"command":"pnpm test"}' },
    }),
  }));
  assert.equal(testSignal.kind, 'success');
  assert.equal(testSignal.mode, 'normal');

  const writeSignal = T.deriveSignal(base({
    lastNode: toolResult({
      name: 'write',
      call: { name: 'write', argsRaw: '{"file_path":"src/App.tsx"}' },
    }),
  }));
  assert.equal(writeSignal.kind, 'success');
  assert.equal(writeSignal.frontend, true);
});

test('exit-code markers only fail command-running tools', () => {
  const read = T.deriveSignal(base({
    lastNode: toolResult({ name: 'read', content: [{ type: 'text', text: 'docs: [exit code: 1]' }] }),
  }));
  assert.equal(read.mode, 'normal');
  const job = T.deriveSignal(base({
    lastNode: toolResult({ name: 'job_output', content: [{ type: 'text', text: 'boom\n[exit code: 2]' }] }),
  }));
  assert.equal(job.mode, 'error');
});

test('a user node starts a turn', () => {
  const signal = T.deriveSignal(base({
    lastNode: { kind: 'user', seq: 5, content: [{ type: 'text', text: '做个前台页面' }] },
    recentUserText: '做个前台页面',
  }));
  assert.equal(signal.kind, 'turn-start');
  assert.equal(signal.frontend, true);
});

test('repeated tools are detected from recent results', () => {
  const signal = T.deriveSignal(base({ recentTools: 'read,read,read,edit' }));
  assert.equal(signal.repeatTool, true);
  assert.equal(T.deriveSignal(base({ recentTools: 'read,read,edit' })).repeatTool, false);
});

test('local line selection is deterministic, short, and avoids the latest line', () => {
  const signal = T.deriveSignal(base({
    lastNode: toolResult({ isError: true, name: 'bash' }),
  }));
  const first = T.pickLocalLine(signal, [], 0);
  assert.ok(first);
  assert.ok(Array.from(first.text).length <= 36);
  assert.match(first.text, /本鱼|老娘|大肥鱼我|我/u);
  const second = T.pickLocalLine(signal, [first.text], 0);
  assert.ok(second);
  assert.notEqual(second.text, first.text);
});

test('LLM eligibility respects beat, cooldown, visibility, and backoff', () => {
  const eligible = T.deriveSignal(base({ running: true, hasPartialText: true }));
  const args = {
    signal: eligible,
    now: 100_000,
    mountedAt: 0,
    lastLlmAt: 0,
    inFlight: false,
    visible: true,
    unavailable: false,
    backoffUntil: 0,
  };
  assert.equal(T.shouldUseLlm(args), true);
  assert.equal(T.shouldUseLlm({ ...args, signal: T.deriveSignal(base()) }), false);
  assert.equal(T.shouldUseLlm({ ...args, inFlight: true }), false);
  assert.equal(T.shouldUseLlm({ ...args, visible: false }), false);
  assert.equal(T.shouldUseLlm({ ...args, unavailable: true }), false);
  assert.equal(T.shouldUseLlm({ ...args, lastLlmAt: 80_000 }), false);
  assert.equal(T.shouldUseLlm({ ...args, mountedAt: 98_000 }), false);
  assert.equal(T.shouldUseLlm({ ...args, backoffUntil: 120_000 }), false);
});

test('walking bounces at both boundaries and flips direction', () => {
  let step = T.stepWalker({ x: 0, dir: 1, maxX: 100, distance: 30 });
  assert.equal(step.x, 30);
  assert.equal(step.dir, 1);
  step = T.stepWalker({ x: 90, dir: 1, maxX: 100, distance: 30 });
  assert.equal(step.x, 100);
  assert.equal(step.dir, -1);
  step = T.stepWalker({ x: 10, dir: -1, maxX: 100, distance: 30 });
  assert.equal(step.x, 0);
  assert.equal(step.dir, 1);
  step = T.stepWalker({ x: 10, dir: 1, maxX: 0, distance: 30 });
  assert.equal(step.x, 0);
  assert.equal(step.dir, 1);
});

test('walking art faces its movement direction', () => {
  assert.equal(T.walkFlip(1), 'scaleX(-1)');
  assert.equal(T.walkFlip(-1), 'scaleX(1)');
});

test('pending peek copy distinguishes approval from a question', () => {
  assert.match(T.peekLineFor('approval'), /点头/u);
  assert.match(T.peekLineFor('question'), /回答/u);
  assert.equal(T.peekLineFor('plan-review'), T.peekLineFor('question'));
});

test('bubble follows the actor and flips sides at the right boundary', () => {
  const left = T.bubblePlacement(0, 100, 240, 700);
  assert.equal(left.side, 'right');
  assert.equal(left.x, 92);

  const middle = T.bubblePlacement(300, 100, 240, 700);
  assert.equal(middle.side, 'right');
  assert.equal(middle.x, 392);

  const edge = T.bubblePlacement(600, 100, 240, 700);
  assert.equal(edge.side, 'left');
  assert.equal(edge.x, 368);

  const narrow = T.bubblePlacement(0, 100, 900, 700);
  assert.equal(narrow.side, 'right');
  assert.equal(narrow.x, 8);
});

test('argument extraction handles JSON and partial JSON', () => {
  assert.equal(T.extractFile('{"file_path":"/a/b/App.tsx"}'), 'App.tsx');
  assert.equal(T.extractFile('{"path":"src\\\\App.css"}'), 'App.css');
  assert.equal(T.extractFile('{"file_path":"src/partial.js"'), 'partial.js');
  assert.equal(T.extractCommandLine('{"command":"pnpm build"}'), 'pnpm build');
  assert.equal(T.extractCommandLine('{"command":"git status"'), 'git status');
  assert.equal(T.firstToken('pnpm build'), 'pnpm');
});

test('frontend and test/build classification', () => {
  assert.equal(T.isFrontendFile('App.tsx'), true);
  assert.equal(T.isFrontendFile('README.md'), false);
  assert.equal(T.isTestOrBuild('pnpm test'), true);
  assert.equal(T.isTestOrBuild('pnpm build'), true);
  assert.equal(T.isTestOrBuild('echo hi'), false);
});

test('thought classification uses categories, never raw text', () => {
  assert.equal(T.classifyThoughtText(''), 'none');
  assert.equal(T.classifyThoughtText('先排查这个 error'), 'debug');
  assert.equal(T.classifyThoughtText('跑一下测试'), 'test');
  assert.equal(T.classifyThoughtText('调整一下 css 布局'), 'design');
  assert.equal(T.classifyThoughtText('先计划步骤'), 'plan');
  assert.equal(T.classifyThoughtText('x'.repeat(500)), 'long');
});

test('observation object sends only the allow-listed compact fields', () => {
  const signal = T.deriveSignal(base({
    running: true,
    runningCall: { callId: 'call-1', name: 'read', phase: 'start', argsRaw: '{"file_path":"/secret/path/App.tsx"}' },
    recentUserText: '这是不该发送的用户原文',
  }));
  const observation = T.toObservation(signal);
  assert.deepEqual(Object.keys(observation).sort(), [
    'command',
    'frontend',
    'kind',
    'mode',
    'outcome',
    'target',
    'thought',
    'tool',
  ].filter((key) => key !== 'command').sort());
  assert.equal(observation.target, 'App.tsx');
  assert.equal('commandLine' in observation, false);
  assert.equal('beatKey' in observation, false);
  assert.equal('seed' in observation, false);
  assert.ok(!JSON.stringify(observation).includes('不该发送'));
});

test('clipLine keeps the contract and adds an ellipsis', () => {
  assert.equal(T.clipLine('短句'), '短句');
  const clipped = T.clipLine('长'.repeat(50), 12);
  assert.ok(Array.from(clipped).length <= 12);
  assert.ok(clipped.endsWith('…'));
});
