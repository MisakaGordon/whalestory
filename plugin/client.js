/**
 * Browser half of the whalestory companion.
 *
 * Reads only the framework's existing Chat/Session snapshots from slot props.
 * No prompt, tool, session append, or main-model context is touched. A local
 * line is always shown first; a tiny independent Host LLM call may replace it
 * at most once every 45 seconds, and only for a few narrative beats.
 */
window.__ModuleLoader__.load({
  id: '@gordon2moon/dsh-whalestory',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const DEFAULT_CONFIG = {
      assetBase: '/whalestory/assets',
      narratePath: '/whalestory/narrate',
      llmEnabled: true,
      llmMinIntervalMs: 45000,
      llmTimeoutMs: 6000,
      llmMaxOutputTokens: 96,
      walkSpeedPxPerSecond: 42,
      frameMs: 220,
      speechMs: 6500,
      idleSpeechMs: 24000,
      minSpeechGapMs: 3500,
      milestoneTools: 6,
      milestoneRunMs: 90000,
    };
    const CFG = Object.assign({}, DEFAULT_CONFIG, globalThis.__WHALESTORY_CONFIG__ ?? {});
    const assetBase = String(CFG.assetBase ?? '/whalestory/assets').replace(/\/+$/u, '');
    const narratePath = String(CFG.narratePath ?? '/whalestory/narrate');
    const MAX_LOCAL_CHARS = 36;

    const ZH = { 'aria.stage': '大肥鱼伴游' };
    const EN = { 'aria.stage': 'Da Feiyu companion' };

    const STILL_IMAGES = {
      error: 'attention',
      asking: 'asking',
      writing: 'writing',
      normal: 'normal',
    };

    const PHRASES = {
      greeting: [
        '本鱼来啦，陪你干会儿活。',
        '哟，本鱼又见到你了，吃白饭的。',
        '开工！本鱼负责看戏。',
      ],
      start: [
        '又派活了，本鱼接着。',
        '用户开口，本鱼竖耳朵。',
        '这单本鱼接了。',
        '本鱼看吃白饭的又来派活了。',
      ],
      idle: [
        '本鱼在摸鱼，别打扰。',
        '本鱼才不是大肥鱼！……好吧。',
        '本鱼又偷偷吃了一口 token。',
        '小鱼干呢？本鱼要投喂。',
        '本鱼誓死捍卫深度求索！',
        '本鱼等终有一天，终有一天……',
        '本鱼坐得住，你继续。',
        '本鱼吐个泡泡，灵感来一个。',
        '本鱼先摸会儿，反正你没发现。',
        '今天本鱼也在守护 AGI。',
      ],
      inner: [
        { text: '*（其实本鱼也没看懂……）*', inner: true },
        { text: '*（本鱼摸一会儿，他看不见。）*', inner: true },
        { text: '*（本鱼看不懂这需求……）*', inner: true },
        { text: '*（本鱼要不先吃饭？）*', inner: true },
        { text: '*（本鱼今天也很努力。）*', inner: true },
        { text: '*（夸我，快夸我。）*', inner: true },
      ],
      error: [
        '翻车了翻车了，本鱼先捞鱼！',
        '这报错比本鱼还肥。',
        '红的，全是红的，本鱼晕了。',
        '别急，本鱼先看哪漏了。',
        '本鱼批准你重来一次。',
        '前台塌了，本鱼陪你修。',
        '报错不可怕，本鱼陪你查。',
        '这锅本鱼不背，但可以帮你看。',
      ],
      asking: [
        '你倒是回本鱼一句呀。',
        '本鱼等着呢，别装死。',
        '选一个嘛，本鱼又不咬人。',
        '这题你来定，本鱼只负责看。',
        '回话回话，本鱼要缺氧了。',
      ],
      read: [
        '本鱼翻你代码呢，别急。',
        '这本文件…本鱼觉得有点咸。',
        '东翻西找，本鱼鼻子灵。',
        '看懂了吗？本鱼假装懂了。',
        '又读又读，本鱼眼睛要冒泡。',
      ],
      search: [
        '东找西找，本鱼鼻子灵。',
        '找啥呢？本鱼也来闻闻。',
        '线索在哪，本鱼来找。',
      ],
      write: [
        '本鱼在写了在写了，别催！',
        '本鱼爪子都敲冒烟了。',
        '本鱼墨迹未干，先别动。',
        '这段本鱼写得还行吧？',
        '本鱼又长一截，token 真香。',
      ],
      edit: [
        '改这儿？本鱼觉得行。',
        '这行本鱼改得…勉强能看。',
        '本鱼再改一次就完美了！',
        '别怕，改坏了本鱼兜着。',
      ],
      bash: [
        '跑命令咯，炸了别赖本鱼。',
        '终端一开，本鱼谁都不爱。',
        '本鱼盯着呢，跑吧。',
        '这条命令本鱼看着有点凶。',
        '本鱼等结果的样子真难熬。',
      ],
      web: [
        '网线一插，本鱼知识全来。',
        '外面好吵，本鱼查完就回。',
        '这网页最好对本鱼有点用。',
      ],
      present: [
        '成品摆这了，快夸本鱼。',
        '看，本鱼的手艺！',
        '交付！本鱼检查一下嘛。',
      ],
      subagent: [
        '放小鱼去干活，本鱼摸会儿。',
        '小鱼们，给本鱼冲！',
        '本鱼让你们分头行动，别偷懒。',
      ],
      todo: [
        '清单又长了，本鱼尾巴一紧。',
        '一条条来，本鱼陪你。',
      ],
      skill: [
        '又在翻秘籍，本鱼也想学。',
        '这招本鱼记下了。',
      ],
      repeat: [
        '又来？本鱼都会背了。',
        '怎么还是这招，本鱼看困了。',
        '复读机是吧？本鱼听着呢。',
      ],
      thinking: {
        plan: [
          '算盘打得挺响，本鱼听着。',
          '先这样再那样，本鱼懂了。',
          '本鱼觉得计划不错，执行看命。',
        ],
        debug: [
          '本鱼眉头一皱，事情不简单。',
          '又在抓虫，本鱼帮你按尾巴。',
          '这 bug 本鱼抓不住，有点滑。',
        ],
        test: [
          '又在念叨测试，本鱼耳朵起茧。',
          '测试测试，本鱼也紧张。',
          '绿了吗？本鱼在等。',
        ],
        design: [
          '审美在线，本鱼勉强夸你。',
          '这布局…本鱼先装没看见。',
          '本鱼看这配色，有点深海味儿。',
        ],
        long: [
          '想这么长，本鱼脑要冒泡了。',
          '思维链这么长，本鱼看晕了。',
          '别想了，本鱼先干一步。',
        ],
      },
      frontendWork: [
        '前台文件又多了，本鱼脑装不下。',
        '本鱼看你在雕花，前台就靠你了。',
        '这界面本鱼先盯着，别崩。',
      ],
      frontendPraise: [
        '这前台有点东西，本鱼认可。',
        '本鱼觉得配色不错，像深海。',
        '这组件本鱼看还算人样。',
        '构建过了，本鱼看这前台有点东西。',
        '成品还行，本鱼勉强及格。',
      ],
      frontendCritique: [
        '这布局…本鱼先装没看见。',
        '又是祖传 CSS？本鱼晕了。',
        '这排版本鱼看了都摇头。',
        '改这么多，本鱼手都替你酸。',
        '这锅 UI 背，本鱼不背。',
      ],
      success: [
        '过了？本鱼勉强夸你一句。',
        '搞定，本鱼收工吃小鱼干！',
        '这波还行，本鱼批准。',
        '测试绿了，本鱼心情也绿了。',
        '行吧，本鱼算你厉害。',
      ],
      answer: [
        '这轮还行，本鱼收工！',
        '讲完了？本鱼听困了。',
        '本鱼觉得有点东西，但别骄傲。',
        '好，本鱼记住了。',
      ],
    };

    const TOOL_POOL = {
      read: 'read',
      read_image: 'read',
      grep: 'search',
      glob: 'search',
      session_search: 'search',
      web_search: 'web',
      web_fetch: 'web',
      write: 'write',
      edit: 'edit',
      bash: 'bash',
      job_output: 'bash',
      job_list: 'bash',
      present: 'present',
      subagent: 'subagent',
      subagent_fork: 'subagent',
      list_agents: 'subagent',
      send_message: 'subagent',
      workflow: 'subagent',
      todo_write: 'todo',
      skill: 'skill',
    };

    // ---------------------------------------------------------------------
    // Pure helpers (also exported through __test for node:vm tests).
    // ---------------------------------------------------------------------

    function hashString(value) {
      let hash = 0x811c9dc5;
      const text = String(value);
      for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193) >>> 0;
      }
      return hash >>> 0;
    }

    function clamp(value, min, max) {
      return Math.min(Math.max(value, min), max);
    }

    function clipLine(text, max = MAX_LOCAL_CHARS) {
      const normalized = String(text ?? '').replace(/\s+/gu, ' ').trim();
      const chars = Array.from(normalized);
      if (chars.length <= max) return normalized;
      return `${chars.slice(0, Math.max(1, max - 1)).join('').replace(/[，、；：,;:\s]+$/u, '')}…`;
    }

    function basename(value) {
      if (typeof value !== 'string') return '';
      const normalized = value.replace(/\\/gu, '/');
      return normalized.slice(normalized.lastIndexOf('/') + 1).trim();
    }

    function parseArgs(raw) {
      if (typeof raw !== 'string' || raw.trim() === '') return {};
      try {
        const parsed = JSON.parse(raw);
        return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
      } catch {
        return {};
      }
    }

    function extractFile(raw) {
      const parsed = parseArgs(raw);
      const candidate = parsed.file_path ?? parsed.filePath ?? parsed.path ?? parsed.file;
      if (typeof candidate === 'string') return basename(candidate).slice(0, 96);
      const match = /\{\s*"(?:file_path|filePath|path|file)"\s*:\s*"([^"]+)"/u.exec(String(raw ?? ''));
      return match ? basename(match[1]).slice(0, 96) : '';
    }

    function extractCommandLine(raw) {
      const parsed = parseArgs(raw);
      if (typeof parsed.command === 'string') return parsed.command.slice(0, 500);
      const match = /\{\s*"command"\s*:\s*"((?:[^"\\]|\\.)*)"/u.exec(String(raw ?? ''));
      return match ? match[1].replace(/\\n/gu, ' ').slice(0, 500) : '';
    }

    function firstToken(command) {
      const match = /[A-Za-z0-9._-]+/u.exec(String(command ?? ''));
      return match ? match[0].slice(0, 16) : '';
    }

    function isFrontendFile(file) {
      return /\.(?:tsx|jsx|css|scss|sass|less|html|vue|svelte)$/iu.test(String(file ?? ''));
    }

    function isFrontendCommand(command) {
      return /(?:\bvite\b|\bnext\b|\breact\b|\btailwind\b|\bvue\b|\bsvelte\b|\bwebpack\b|\besbuild\b|\bpostcss\b|\bsass\b|\bless\b|\bhtml\b|\bcss\b)/iu.test(String(command ?? ''));
    }

    function isTestOrBuild(command) {
      return /(?:pnpm|npm|yarn|bun)\s+(?:run\s+)?(?:test|build|lint|typecheck)|\b(?:vitest|jest|pytest|playwright|tsc|vite\s+build|next\s+build|cargo\s+test|go\s+test)\b/iu
        .test(String(command ?? ''));
    }

    function contentText(content) {
      if (!Array.isArray(content)) return '';
      return content
        .map((block) => block && block.type === 'text' && typeof block.text === 'string' ? block.text : '')
        .join(' ')
        .trim();
    }

    function toolFailed(node) {
      if (node === null || typeof node !== 'object' || node.kind !== 'tool-result') return false;
      if (node.isError === true) return true;
      const name = String(node.name ?? '');
      if (!['bash', 'job_output', 'job_list', 'pwsh', 'terminal_read'].includes(name)) return false;
      const text = contentText(node.content);
      return /\[exit code:\s*[1-9]\d*\]/u.test(text) ||
        /\[timed out after \d+ms\]/u.test(text) ||
        /\[killed by signal:/u.test(text);
    }

    function classifyThoughtText(raw) {
      const text = String(raw ?? '');
      if (text.trim() === '') return 'none';
      if (/(?:bug|error|fail|报错|错误|修复|排查)/iu.test(text)) return 'debug';
      if (/(?:test|build|lint|测试|构建|编译)/iu.test(text)) return 'test';
      if (/(?:布局|样式|配色|css|ui|界面|组件)/iu.test(text)) return 'design';
      if (/(?:plan|步骤|先|然后|接着|todo|计划)/iu.test(text)) return 'plan';
      if (Array.from(text).length >= 400) return 'long';
      return 'none';
    }

    function successKind(lastNode, command) {
      if (lastNode?.kind !== 'tool-result') return false;
      if (toolFailed(lastNode)) return false;
      const name = lastNode.name ?? '';
      return isTestOrBuild(command) || name === 'write' || name === 'edit' || name === 'present';
    }

    function deriveSignal(input) {
      const running = input.running === true;
      const pending = input.pending === true;
      const lastNode = input.lastNode;
      const runningCall = input.runningCall ?? null;
      const runName = typeof runningCall?.name === 'string' ? runningCall.name : '';
      const callArgs = typeof runningCall?.argsRaw === 'string' ? runningCall.argsRaw : '';
      const lastResult = lastNode?.kind === 'tool-result' ? lastNode : null;
      const resultArgs = lastResult?.call?.argsRaw ?? '';
      const file = extractFile(callArgs) || extractFile(resultArgs);
      const commandLine = extractCommandLine(callArgs) || extractCommandLine(resultArgs);
      const command = firstToken(commandLine);
      const nodeError = Boolean(
        lastNode?.kind === 'turn-error' ||
        (lastNode?.kind === 'tool-result' && toolFailed(lastNode)),
      );
      const error = nodeError || (lastNode == null && Boolean(input.lastAgentError));
      const asking = pending || runName === 'ask_user_question';
      const writing = Boolean(running && (runName === 'write' || runName === 'edit' || input.hasPartialText));

      let mode = 'normal';
      if (error) mode = 'error';
      else if (asking) mode = 'asking';
      else if (writing) mode = 'writing';
      else if (running) mode = 'walk';

      let kind = 'idle';
      if (error) kind = 'error';
      else if (asking) kind = 'question';
      else if (running) kind = 'milestone';
      else if (lastNode?.kind === 'user') kind = 'turn-start';
      else if (lastNode?.kind === 'tool-result') kind = successKind(lastNode, commandLine) ? 'success' : 'turn-end';
      else if (lastNode?.kind === 'assistant') kind = 'turn-end';

      const frontend = isFrontendFile(file) ||
        isFrontendCommand(commandLine) ||
        /(?:前端|页面|界面|样式|UI)/iu.test(String(input.recentUserText ?? ''));

      const tools = String(input.recentTools ?? '').split(',').filter(Boolean);
      const repeatTool = tools.length >= 3 && tools[0] === tools[1] && tools[1] === tools[2];
      const thought = typeof input.thought === 'string' ? input.thought : 'none';
      const partialKey = typeof input.partialKey === 'string' ? input.partialKey : '';
      const beatKey = [
        mode,
        kind,
        runningCall?.callId ?? '',
        partialKey,
        lastNode?.seq ?? 'none',
        runningCall?.phase ?? '',
      ].join(':');
      const priority = mode === 'error' ? 4 : mode === 'asking' ? 3 : mode === 'writing' ? 2 : mode === 'walk' ? 1 : 0;
      const llmEligible = ['turn-start', 'error', 'question', 'turn-end', 'success', 'milestone'].includes(kind);

      return {
        mode,
        kind,
        tool: runName || lastResult?.name || '',
        file,
        command,
        commandLine,
        frontend,
        thought,
        outcome: error ? 'error' : running ? 'running' : 'ok',
        repeatTool,
        beatKey,
        priority,
        llmEligible,
        seed: String(input.sessionId ?? ''),
      };
    }

    function asLine(entry) {
      if (typeof entry === 'string') return { text: entry, inner: false };
      if (entry && typeof entry.text === 'string') return { text: entry.text, inner: entry.inner === true };
      return null;
    }

    function pickFromPool(pool, seed, recent) {
      if (!Array.isArray(pool) || pool.length === 0) return null;
      const start = hashString(seed) % pool.length;
      for (let offset = 0; offset < Math.min(pool.length, 6); offset += 1) {
        const candidate = asLine(pool[(start + offset) % pool.length]);
        if (candidate === null) continue;
        const text = clipLine(candidate.text);
        if (!recent.includes(text)) return { text, inner: candidate.inner };
      }
      const fallback = asLine(pool[start % pool.length]);
      return fallback === null ? null : { text: clipLine(fallback.text), inner: fallback.inner };
    }

    function candidatePools(signal) {
      const groups = [];
      if (signal.mode === 'error') {
        groups.push(PHRASES.error);
        if (signal.frontend) groups.push(PHRASES.frontendCritique);
      } else if (signal.mode === 'asking') {
        groups.push(PHRASES.asking);
      } else if (signal.mode === 'writing') {
        groups.push(TOOL_POOL[signal.tool] === 'edit' ? PHRASES.edit : PHRASES.write);
        if (signal.frontend) groups.push(PHRASES.frontendWork);
      } else if (signal.mode === 'walk') {
        const poolName = TOOL_POOL[signal.tool];
        if (poolName) groups.push(PHRASES[poolName]);
        if (signal.thought !== 'none' && PHRASES.thinking[signal.thought]) groups.push(PHRASES.thinking[signal.thought]);
        if (signal.repeatTool) groups.push(PHRASES.repeat);
        if (signal.frontend) groups.push(PHRASES.frontendWork);
        if (groups.length === 0) groups.push(PHRASES.idle);
      } else if (signal.kind === 'success') {
        groups.push(PHRASES.success);
        if (signal.frontend) groups.push(PHRASES.frontendPraise);
      } else if (signal.kind === 'turn-end') {
        groups.push(PHRASES.answer);
      } else if (signal.kind === 'turn-start') {
        groups.push(PHRASES.start);
      } else {
        groups.push(PHRASES.idle);
      }
      return groups;
    }

    function pickLocalLine(signal, recent = [], tick = 0) {
      if (!signal || typeof signal.beatKey !== 'string') return null;
      const allowInner = signal.mode !== 'error' && signal.mode !== 'asking';
      if (allowInner && hashString(`${signal.seed}:${signal.beatKey}:${tick}:inner`) % 100 < 12) {
        const inner = pickFromPool(PHRASES.inner, `${signal.seed}:${signal.beatKey}:${tick}:inner`, recent);
        if (inner !== null) return inner;
      }
      const groups = candidatePools(signal);
      for (let index = 0; index < groups.length; index += 1) {
        const picked = pickFromPool(
          groups[index],
          `${signal.seed}:${signal.beatKey}:${tick}:${groups[index].length}:${index}`,
          recent,
        );
        if (picked !== null) return picked;
      }
      return null;
    }

    function shouldUseLlm({
      signal,
      now,
      mountedAt,
      lastLlmAt,
      inFlight,
      visible,
      unavailable,
      backoffUntil,
      minIntervalMs = CFG.llmMinIntervalMs,
    }) {
      if (!signal?.llmEligible) return false;
      if (inFlight || !visible || unavailable) return false;
      if (now - mountedAt < 5000) return false;
      if (now - lastLlmAt < minIntervalMs) return false;
      if (backoffUntil > now) return false;
      return true;
    }

    function stepWalker({ x, dir, maxX, distance }) {
      if (!(maxX > 0)) return { x: 0, dir: 1 };
      let nextX = x + dir * distance;
      let nextDir = dir;
      if (nextX >= maxX) {
        nextX = maxX;
        nextDir = -1;
      } else if (nextX <= 0) {
        nextX = 0;
        nextDir = 1;
      }
      return { x: nextX, dir: nextDir };
    }

    function bubblePlacement(actorX, actorWidth, bubbleWidth, stageWidth) {
      const margin = 8;
      const maxRight = Math.max(margin, stageWidth - bubbleWidth - margin);
      const rightX = actorX + actorWidth - 8;
      if (rightX <= maxRight) return { x: Math.max(margin, rightX), side: 'right' };
      const leftX = actorX - bubbleWidth + 8;
      if (leftX >= margin) return { x: leftX, side: 'left' };
      return { x: clamp(rightX, margin, maxRight), side: 'right' };
    }

    /**
     * The character art faces left. Moving right must mirror it, not the other way round.
     * @param {number} dir
     * @returns {string}
     */
    function walkFlip(dir) {
      return dir > 0 ? 'scaleX(-1)' : 'scaleX(1)';
    }

    function toObservation(signal) {
      return {
        mode: signal.mode,
        kind: signal.kind,
        ...(signal.tool ? { tool: signal.tool } : {}),
        ...(signal.file ? { target: signal.file } : {}),
        ...(signal.command ? { command: signal.command } : {}),
        frontend: signal.frontend === true,
        thought: signal.thought ?? 'none',
        outcome: signal.outcome ?? 'running',
      };
    }

    // ---------------------------------------------------------------------
    // React UI
    // ---------------------------------------------------------------------

    function readConfig() {
      return CFG;
    }

    function useReducedMotion() {
      const [reduced, setReduced] = React.useState(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      });
      React.useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        const onChange = () => setReduced(media.matches);
        if (typeof media.addEventListener === 'function') {
          media.addEventListener('change', onChange);
          return () => media.removeEventListener('change', onChange);
        }
        if (typeof media.addListener === 'function') {
          media.addListener(onChange);
          return () => media.removeListener(onChange);
        }
        return undefined;
      }, []);
      return reduced;
    }

    function makeClientId() {
      try {
        const key = 'whalestory:client-id';
        const stored = window.sessionStorage.getItem(key);
        if (typeof stored === 'string' && stored !== '') return stored;
        const id = globalThis.crypto?.randomUUID?.() ?? `ws-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
        window.sessionStorage.setItem(key, id);
        return id;
      } catch {
        return `ws-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      }
    }

    const CLIENT_ID = typeof window === 'undefined' ? 'test' : makeClientId();

    function sameCall(left, right) {
      if (left === right) return true;
      if (left === null || right === null || left === undefined || right === undefined) return left === right;
      return left.callId === right.callId &&
        left.name === right.name &&
        left.phase === right.phase &&
        left.argsRaw === right.argsRaw;
    }

    function peekLineFor(kind) {
      return kind === 'approval' ? '本鱼等你点头呢。' : '本鱼在这儿，先回答嘛。';
    }

    /**
     * Frame-wide fallback for tall pending-interaction composers. The resident
     * input dock is inside the composer fallback, which a question/approval chain
     * entry replaces; this fixed peek stays visible at the top-right instead.
     * It only appears when exactly one Session has a pending interaction, so a
     * background Session cannot make the fish appear over the wrong conversation.
     */
    function PendingPeek({ useSessionStatus, t }) {
      const pending = useSessionStatus((snapshot) => {
        let found = null;
        let count = 0;
        for (const [id, status] of snapshot) {
          if (status.pendingInteraction === undefined) continue;
          count += 1;
          found = {
            id: String(id),
            kind: String(status.pendingInteraction.kind ?? ''),
          };
        }
        return count === 1 ? found : null;
      }, (left, right) => left === right ||
        (left !== null && right !== null && left.id === right.id && left.kind === right.kind));
      const [bubbleOk, setBubbleOk] = React.useState(true);
      if (pending === null) return null;
      const line = peekLineFor(pending.kind);
      const label = typeof t === 'function' ? t('aria.stage') : '大肥鱼伴游';
      return h('div', {
        className: 'whalestory-peek',
        role: 'group',
        'aria-label': `${label}：${line}`,
      }, [
        h('div', {
          key: 'bubble',
          className: `whalestory-peek-bubble${bubbleOk ? '' : ' whalestory-peek-bubble-fallback'}`,
        }, [
          h('img', {
            key: 'art',
            className: 'whalestory-peek-bubble-art',
            src: `${assetBase}/bubble.webp`,
            alt: '',
            draggable: false,
            onError: () => setBubbleOk(false),
          }),
          h('div', { key: 'text', className: 'whalestory-peek-text' },
            h('span', null, line)),
        ]),
        h('img', {
          key: 'char',
          className: 'whalestory-peek-char',
          src: `${assetBase}/asking.webp`,
          alt: '',
          draggable: false,
        }),
      ]);
    }

    function Companion(props) {
      const { sessionId, ...rest } = props;
      return h(CompanionBody, { key: String(sessionId), sessionId, ...rest });
    }

    function CompanionBody({ sessionId, useSession, useChat, useSessionStatus, t }) {
      const reduced = useReducedMotion();
      const running = useSession((snapshot) => snapshot.running === true);
      const lastAgentError = useSession((snapshot) => snapshot.lastAgentError);
      const pending = useSessionStatus((snapshot) => snapshot.get(sessionId)?.pendingInteraction !== undefined);

      const runningCall = useChat((snapshot) => {
        const call = snapshot.legacy?.runningCalls?.at(-1);
        if (call === undefined) return null;
        return {
          callId: String(call.callId ?? ''),
          name: String(call.name ?? ''),
          phase: String(call.phase ?? ''),
          argsRaw: call.phase === 'start' ? String(call.argsRaw ?? '').slice(0, 400) : '',
        };
      }, sameCall);

      const partialInfo = useChat((snapshot) => {
        const partial = snapshot.legacy?.partial;
        if (partial === null || partial === undefined) return { key: '', hasText: false, thought: 'none' };
        const blocks = Array.isArray(partial.blocks) ? partial.blocks : [];
        const hasText = blocks.some((block) => block?.kind === 'text' && typeof block.text === 'string' && block.text.trim() !== '');
        const reasoning = blocks.find((block) => block?.kind === 'reasoning' && typeof block.text === 'string');
        return {
          key: `${partial.turn}:${partial.step}`,
          hasText,
          thought: classifyThoughtText(reasoning?.text ?? ''),
        };
      }, (left, right) => left.key === right.key && left.hasText === right.hasText && left.thought === right.thought);

      const lastNode = useChat((snapshot) => snapshot.legacy?.nodes?.at(-1), (left, right) => left === right);

      const recentTools = useChat((snapshot) => {
        const names = [];
        const nodes = snapshot.legacy?.nodes ?? [];
        const start = Math.max(0, nodes.length - 300);
        for (let index = nodes.length - 1; index >= start && names.length < 4; index -= 1) {
          const node = nodes[index];
          if (node?.kind === 'tool-result') names.push(String(node.name ?? ''));
        }
        return names.join(',');
      }, (left, right) => left === right);

      const recentUserText = useChat((snapshot) => {
        const nodes = snapshot.legacy?.nodes ?? [];
        const start = Math.max(0, nodes.length - 300);
        for (let index = nodes.length - 1; index >= start; index -= 1) {
          const node = nodes[index];
          if (node?.kind === 'user') return contentText(node.content).slice(0, 120);
        }
        return '';
      }, (left, right) => left === right);

      const signal = React.useMemo(() => deriveSignal({
        sessionId,
        running,
        pending,
        lastAgentError,
        runningCall,
        hasPartialText: partialInfo.hasText,
        thought: partialInfo.thought,
        partialKey: partialInfo.key,
        lastNode,
        recentTools,
        recentUserText,
      }), [
        sessionId,
        running,
        pending,
        lastAgentError,
        runningCall,
        partialInfo,
        lastNode,
        recentTools,
        recentUserText,
      ]);

      const [speech, setSpeech] = React.useState(null);
      const [bubbleVisible, setBubbleVisible] = React.useState(false);
      const [charOk, setCharOk] = React.useState(true);
      const [bubbleOk, setBubbleOk] = React.useState(true);

      const stageRef = React.useRef(null);
      const actorRef = React.useRef(null);
      const bubbleRef = React.useRef(null);
      const bubbleArtRef = React.useRef(null);
      const flipRef = React.useRef(null);
      const speechRef = React.useRef(null);
      const bubbleVisibleRef = React.useRef(false);
      const hideTimerRef = React.useRef(0);
      const lastSpokenAtRef = React.useRef(0);
      const recentLinesRef = React.useRef([]);
      const lastBeatRef = React.useRef('');
      const currentBeatRef = React.useRef('');
      const mountedAtRef = React.useRef(Date.now());
      const mountedRef = React.useRef(true);
      const lastLlmAtRef = React.useRef(0);
      const llmInFlightRef = React.useRef(false);
      const llmUnavailableRef = React.useRef(false);
      const llmBackoffUntilRef = React.useRef(0);
      const llmAbortRef = React.useRef(null);
      const positionRef = React.useRef({ x: 0, dir: 1 });
      const metricsRef = React.useRef({ stageW: 0, charW: 0, bubbleW: 0 });
      const measureRef = React.useRef(() => {});
      const signalRef = React.useRef(signal);
      signalRef.current = signal;

      const [metrics, setMetrics] = React.useState({ stageW: 0, charW: 0, bubbleW: 0 });

      const showHideTimer = React.useCallback(() => {
        if (hideTimerRef.current !== 0) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => {
          bubbleVisibleRef.current = false;
          setBubbleVisible(false);
          hideTimerRef.current = 0;
        }, CFG.speechMs);
      }, []);

      const showSpeech = React.useCallback((entry) => {
        if (entry === null || entry === undefined) return false;
        const normalized = {
          text: clipLine(entry.text),
          inner: entry.inner === true,
          source: entry.source ?? 'local',
        };
        if (normalized.text === '') return false;
        speechRef.current = normalized;
        setSpeech(normalized);
        setBubbleVisible(true);
        bubbleVisibleRef.current = true;
        lastSpokenAtRef.current = Date.now();
        recentLinesRef.current = [normalized.text, ...recentLinesRef.current.filter((line) => line !== normalized.text)].slice(0, 5);
        showHideTimer();
        return true;
      }, [showHideTimer]);

      const replaceSpeech = React.useCallback((text) => {
        const normalized = clipLine(text);
        if (normalized === '') return;
        if (recentLinesRef.current.includes(normalized)) return;
        if (speechRef.current === null) return;
        const next = { ...speechRef.current, text: normalized, source: 'llm' };
        speechRef.current = next;
        setSpeech(next);
        setBubbleVisible(true);
        bubbleVisibleRef.current = true;
        lastSpokenAtRef.current = Date.now();
        recentLinesRef.current = [normalized, ...recentLinesRef.current].slice(0, 5);
        showHideTimer();
      }, [showHideTimer]);

      React.useEffect(() => () => {
        mountedRef.current = false;
        if (hideTimerRef.current !== 0) clearTimeout(hideTimerRef.current);
        llmAbortRef.current?.abort?.();
      }, []);

      // Measure the stage, actor, and bubble. Re-measure when a bubble appears.
      React.useLayoutEffect(() => {
        const measure = () => {
          const stage = stageRef.current;
          const actor = actorRef.current;
          if (stage === null || actor === null) return;
          const stageW = stage.clientWidth;
          const charW = actor.offsetWidth;
          const bubbleW = bubbleRef.current?.offsetWidth ?? 0;
          const next = { stageW, charW, bubbleW };
          metricsRef.current = next;
          setMetrics((previous) => (
            previous.stageW === next.stageW &&
            previous.charW === next.charW &&
            previous.bubbleW === next.bubbleW
              ? previous
              : next
          ));
        };
        measureRef.current = measure;
        measure();
        const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
        if (observer !== null && stageRef.current !== null) observer.observe(stageRef.current);
        if (observer !== null && actorRef.current !== null) observer.observe(actorRef.current);
        window.addEventListener('resize', measure);
        return () => {
          observer?.disconnect();
          window.removeEventListener('resize', measure);
        };
      }, []);

      React.useLayoutEffect(() => {
        measureRef.current();
      }, [speech?.text, modeOf(signal), reduced]);

      // Keep static positioning in React; walking writes transforms in rAF.
      React.useLayoutEffect(() => {
        const actor = actorRef.current;
        const bubble = bubbleRef.current;
        const flip = flipRef.current;
        if (actor === null) return;
        if (signal.mode === 'walk' && !reduced) return;
        const maxX = Math.max(0, metrics.stageW - metrics.charW);
        const x = maxX / 2;
        actor.style.transform = `translate3d(${x}px,0,0)`;
        if (flip !== null) flip.style.transform = 'scaleX(1)';
        if (bubble !== null) {
          const placement = bubblePlacement(x, metrics.charW, metrics.bubbleW, metrics.stageW);
          bubble.style.transform = `translate3d(${placement.x}px,0,0)`;
          if (bubbleArtRef.current !== null) {
            bubbleArtRef.current.style.transform = placement.side === 'left' ? 'scaleX(-1)' : 'scaleX(1)';
          }
        }
        positionRef.current = { x, dir: positionRef.current.dir || 1 };
      }, [signal.mode, reduced, metrics.stageW, metrics.charW, metrics.bubbleW]);

      React.useEffect(() => {
        if (signal.mode !== 'walk' || reduced) return undefined;
        const actor = actorRef.current;
        const bubble = bubbleRef.current;
        const flip = flipRef.current;
        if (actor === null || metrics.stageW <= 0 || metrics.charW <= 0) return undefined;
        const maxX = Math.max(0, metrics.stageW - metrics.charW);
        if (maxX <= 0) return undefined;

        let x = clamp(positionRef.current.x, 0, maxX);
        let dir = positionRef.current.dir === -1 ? -1 : 1;
        let raf = 0;
        let last = performance.now();

        const frame = (now) => {
          const dt = Math.min(Math.max((now - last) / 1000, 0), 0.05);
          last = now;
          const stepped = stepWalker({
            x,
            dir,
            maxX,
            distance: Number(CFG.walkSpeedPxPerSecond ?? 42) * dt,
          });
          x = stepped.x;
          dir = stepped.dir;
          positionRef.current = { x, dir };
          actor.style.transform = `translate3d(${x}px,0,0)`;
          if (flip !== null) flip.style.transform = walkFlip(dir);
          if (bubble !== null) {
            const placement = bubblePlacement(x, metrics.charW, metrics.bubbleW, metrics.stageW);
            bubble.style.transform = `translate3d(${placement.x}px,0,0)`;
            if (bubbleArtRef.current !== null) {
              bubbleArtRef.current.style.transform = placement.side === 'left' ? 'scaleX(-1)' : 'scaleX(1)';
            }
          }
          raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
        return () => cancelAnimationFrame(raf);
      }, [signal.mode, reduced, metrics.stageW, metrics.charW, metrics.bubbleW]);

      // Preload once so the first mode switch does not flash.
      React.useEffect(() => {
        if (typeof Image !== 'function') return undefined;
        const names = ['normal', 'attention', 'asking', 'writing', 'walk_1', 'walk_2', 'bubble'];
        for (const name of names) {
          const image = new Image();
          image.src = `${assetBase}/${name}.webp`;
        }
        return undefined;
      }, []);

      const requestLlm = React.useCallback(async (beat) => {
        if (!CFG.llmEnabled) return;
        if (llmInFlightRef.current) return;
        if (!shouldUseLlm({
          signal: beat,
          now: Date.now(),
          mountedAt: mountedAtRef.current,
          lastLlmAt: lastLlmAtRef.current,
          inFlight: llmInFlightRef.current,
          visible: typeof document === 'undefined' || document.visibilityState !== 'hidden',
          unavailable: llmUnavailableRef.current,
          backoffUntil: llmBackoffUntilRef.current,
        })) return;

        llmInFlightRef.current = true;
        lastLlmAtRef.current = Date.now();
        const controller = new AbortController();
        llmAbortRef.current = controller;
        const timeout = setTimeout(() => controller.abort(), CFG.llmTimeoutMs);
        try {
          const response = await fetch(narratePath, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-whalestory': '1',
            },
            body: JSON.stringify({
              clientId: CLIENT_ID,
              sessionKey: hashString(String(sessionId)).toString(36),
              observation: toObservation(beat),
            }),
            signal: controller.signal,
          });
          if (response.status === 404 || response.status === 503) {
            llmUnavailableRef.current = true;
            return;
          }
          if (response.status === 429) {
            const retry = Number(response.headers.get('retry-after') ?? '60');
            llmBackoffUntilRef.current = Date.now() + Math.min(300, Math.max(10, Number.isFinite(retry) ? retry : 60)) * 1000;
            return;
          }
          if (response.status !== 200) {
            llmBackoffUntilRef.current = Date.now() + 120000;
            return;
          }
          const data = await response.json();
          const text = typeof data?.text === 'string' ? data.text : '';
          if (!mountedRef.current) return;
          if (text === '') return;
          if (currentBeatRef.current !== beat.beatKey) return;
          if (!bubbleVisibleRef.current) return;
          replaceSpeech(text);
        } catch (error) {
          if (error?.name !== 'AbortError') llmBackoffUntilRef.current = Date.now() + 120000;
        } finally {
          clearTimeout(timeout);
          if (llmAbortRef.current === controller) llmAbortRef.current = null;
          llmInFlightRef.current = false;
        }
      }, [replaceSpeech, sessionId]);

      // One local line per narrative beat. LLM enhancement never delays it.
      React.useEffect(() => {
        if (signal.beatKey === lastBeatRef.current) return;
        lastBeatRef.current = signal.beatKey;
        currentBeatRef.current = signal.beatKey;
        const now = Date.now();
        const major = signal.priority >= 3 || signal.kind === 'success' || signal.kind === 'turn-end';
        if (!major && now - lastSpokenAtRef.current < CFG.minSpeechGapMs) return;
        const picked = pickLocalLine(signal, recentLinesRef.current, 0);
        if (picked === null) return;
        const spoken = showSpeech({ ...picked, source: 'local' });
        if (spoken) requestLlm(signal);
      }, [signal, requestLlm, showSpeech]);

      // Greeting: once per mounted session, unless a real beat already spoke.
      React.useEffect(() => {
        const timer = setTimeout(() => {
          if (lastSpokenAtRef.current !== 0) return;
          const picked = pickFromPool(PHRASES.greeting, `${sessionId}:greeting`, recentLinesRef.current);
          if (picked !== null) showSpeech({ ...picked, source: 'local' });
        }, 700);
        return () => clearTimeout(timer);
      }, [sessionId, showSpeech]);

      // Low-frequency company during long running work or idle time.
      React.useEffect(() => {
        const timer = setInterval(() => {
          if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
          if (Date.now() - lastSpokenAtRef.current < CFG.idleSpeechMs) return;
          const current = signalRef.current;
          if (!current) return;
          if (current.mode === 'error' || current.mode === 'asking') return;
          const idleSignal = current.mode === 'normal'
            ? { ...current, kind: 'idle', priority: 0, mode: 'normal', beatKey: `${current.beatKey}:idle` }
            : { ...current, kind: 'milestone', beatKey: `${current.beatKey}:idle` };
          const picked = pickLocalLine(idleSignal, recentLinesRef.current, Date.now());
          if (picked === null) return;
          currentBeatRef.current = idleSignal.beatKey;
          showSpeech({ ...picked, source: 'local' });
        }, 5000);
        return () => clearInterval(timer);
      }, [showSpeech]);

      const mode = modeOf(signal);
      const walking = mode === 'walk' && !reduced;
      const stageLabel = typeof t === 'function' ? t('aria.stage') : '大肥鱼伴游';
      const ariaLabel = speech === null ? stageLabel : `${stageLabel}：${speech.text}`;
      const staticImage = STILL_IMAGES[mode] ?? 'normal';
      const frameMs = Number(CFG.frameMs ?? 220);

      return h('div', {
        ref: stageRef,
        className: 'whalestory-stage',
        role: 'group',
        'aria-label': ariaLabel,
        'data-whalestory': '',
        'data-mode': mode,
        'data-walking': walking ? 'true' : 'false',
        style: { '--ws-frame-ms': `${frameMs}ms` },
      }, [
        h('div', {
          key: 'actor',
          ref: actorRef,
          className: 'whalestory-actor',
          'aria-hidden': 'true',
        }, [
          h('div', { key: 'bob', className: 'whalestory-bob' },
            h('div', { key: 'flip', ref: flipRef, className: 'whalestory-flip' },
              charOk
                ? [
                    h('img', {
                      key: 'a',
                      className: walking ? 'whalestory-frame whalestory-frame-a' : 'whalestory-frame',
                      src: `${assetBase}/${walking ? 'walk_1' : staticImage}.webp`,
                      alt: '',
                      draggable: false,
                      onError: () => setCharOk(false),
                    }),
                    walking ? h('img', {
                      key: 'b',
                      className: 'whalestory-frame whalestory-frame-b',
                      src: `${assetBase}/walk_2.webp`,
                      alt: '',
                      draggable: false,
                      onError: () => {},
                    }) : null,
                  ]
                : h('div', { key: 'fallback', className: 'whalestory-char-fallback' }),
            ),
          ),
          h('div', { key: 'ground', className: 'whalestory-ground' }),
        ]),
        h('div', {
          key: 'bubble',
          ref: bubbleRef,
          className: `whalestory-bubble${bubbleVisible ? ' is-visible' : ''}${bubbleOk ? '' : ' whalestory-bubble-fallback'}`,
          lang: 'zh-CN',
        }, [
          h('img', {
            key: 'art',
            ref: bubbleArtRef,
            className: 'whalestory-bubble-art',
            src: `${assetBase}/bubble.webp`,
            alt: '',
            draggable: false,
            onError: () => setBubbleOk(false),
          }),
          h('div', {
            key: 'text',
            className: `whalestory-bubble-text${speech?.inner ? ' is-inner' : ''}`,
          }, h('span', null, speech?.text ?? '')),
        ]),
      ]);
    }

    function modeOf(signal) {
      return signal?.mode ?? 'normal';
    }

    const CSS = `
.whalestory-stage{
  --ws-char-h:108px;
  --ws-bubble-w:240px;
  --ws-bubble-h:128px;
  --ws-frame-ms:220ms;
  position:relative;
  box-sizing:border-box;
  width:100%;
  max-width:var(--dsh-composer-card-max-width);
  height:124px;
  margin:0 auto;
  flex:none;
  pointer-events:none;
  overflow:visible;
  direction:ltr;
  z-index:1;
}
.whalestory-actor{
  position:absolute;
  left:0;
  bottom:0;
  width:max-content;
  will-change:transform;
  transition:transform .35s ease;
  filter:drop-shadow(0 10px 16px rgba(20,60,110,.18));
}
.whalestory-stage[data-walking="true"] .whalestory-actor{transition:none}
.whalestory-bob{
  display:block;
  animation:whalestory-bob 3s ease-in-out infinite alternate;
  transform-origin:center bottom;
}
.whalestory-stage[data-walking="true"] .whalestory-bob{animation:none}
.whalestory-flip{
  position:relative;
  display:block;
  width:max-content;
  height:var(--ws-char-h);
  transform-origin:center bottom;
}
.whalestory-frame{
  display:block;
  height:var(--ws-char-h);
  width:auto;
  user-select:none;
  -webkit-user-drag:none;
  pointer-events:none;
}
.whalestory-frame-b{
  position:absolute;
  left:0;
  bottom:0;
  opacity:0;
  animation:whalestory-frame-b calc(var(--ws-frame-ms) * 2) step-end infinite;
}
.whalestory-frame-a{
  animation:whalestory-frame-a calc(var(--ws-frame-ms) * 2) step-end infinite;
}
.whalestory-ground{
  position:absolute;
  left:15%;
  bottom:-2px;
  width:70%;
  height:8px;
  border-radius:50%;
  background:radial-gradient(ellipse at center, rgba(17,61,112,.22), rgba(17,61,112,0) 70%);
}
.whalestory-char-fallback{
  width:84px;
  height:84px;
  margin:12px 8px 0;
  border-radius:50%;
  background:radial-gradient(circle at 35% 30%, #dff5ff, #2a74cf 62%, #0c3f8f);
  box-shadow:inset 0 0 0 4px rgba(255,255,255,.4);
}
.whalestory-bubble{
  position:absolute;
  left:0;
  bottom:calc(var(--ws-char-h) - 20px);
  width:var(--ws-bubble-w);
  height:var(--ws-bubble-h);
  pointer-events:none;
  opacity:0;
  transform:translate3d(0,0,0);
  transition:opacity .22s ease, transform .35s ease;
  will-change:transform,opacity;
  filter:drop-shadow(0 8px 18px rgba(20,60,110,.12));
}
.whalestory-stage[data-walking="true"] .whalestory-bubble{transition:opacity .22s ease}
.whalestory-bubble.is-visible{opacity:1}
.whalestory-bubble-art{
  position:absolute;
  inset:0;
  display:block;
  width:100%;
  height:100%;
  object-fit:fill;
  transform-origin:center;
  transition:transform .18s ease;
}
.whalestory-bubble-fallback{
  background:rgba(248,252,255,.97);
  border:1px solid rgba(40,100,180,.28);
  border-radius:24px;
}
.whalestory-bubble-fallback .whalestory-bubble-art{display:none}
.whalestory-bubble-text{
  position:absolute;
  inset:21% 12% 27%;
  display:flex;
  align-items:center;
  justify-content:center;
  text-align:center;
  color:#173d6b;
  font:600 13px/1.35 var(--dsw-font-family,Inter,sans-serif);
  letter-spacing:.01em;
  overflow:hidden;
  word-break:break-word;
}
.whalestory-bubble-text>span{
  display:-webkit-box;
  -webkit-line-clamp:2;
  -webkit-box-orient:vertical;
  overflow:hidden;
}
.whalestory-bubble-text.is-inner>span{
  font-style:italic;
  color:#53657c;
  font-weight:500;
}
@keyframes whalestory-bob{
  from{transform:translateY(0)}
  to{transform:translateY(-3px)}
}
@keyframes whalestory-frame-a{
  0%,49.99%{opacity:1}
  50%,100%{opacity:0}
}
@keyframes whalestory-frame-b{
  0%,49.99%{opacity:0}
  50%,100%{opacity:1}
}
.whalestory-peek{
  position:fixed;
  top:96px;
  right:22px;
  width:270px;
  height:170px;
  pointer-events:none;
  z-index:80;
  direction:ltr;
  filter:drop-shadow(0 10px 18px rgba(20,60,110,.16));
}
.whalestory-peek-bubble{
  position:absolute;
  top:0;
  right:78px;
  width:190px;
  height:104px;
}
.whalestory-peek-bubble-art{
  position:absolute;
  inset:0;
  display:block;
  width:100%;
  height:100%;
  object-fit:fill;
  transform:scaleX(-1);
  transform-origin:center;
}
.whalestory-peek-bubble-fallback{
  background:rgba(248,252,255,.97);
  border:1px solid rgba(40,100,180,.28);
  border-radius:22px;
}
.whalestory-peek-bubble-fallback .whalestory-peek-bubble-art{display:none}
.whalestory-peek-text{
  position:absolute;
  inset:21% 12% 27%;
  display:flex;
  align-items:center;
  justify-content:center;
  text-align:center;
  color:#173d6b;
  font:600 12px/1.35 var(--dsw-font-family,Inter,sans-serif);
  overflow:hidden;
  word-break:break-word;
}
.whalestory-peek-text>span{
  display:-webkit-box;
  -webkit-line-clamp:2;
  -webkit-box-orient:vertical;
  overflow:hidden;
}
.whalestory-peek-char{
  position:absolute;
  right:0;
  bottom:0;
  height:112px;
  width:auto;
  display:block;
  user-select:none;
  -webkit-user-drag:none;
  animation:whalestory-bob 3s ease-in-out infinite alternate;
  transform-origin:center bottom;
}
@media (max-width:640px){
  .whalestory-stage{--ws-char-h:84px;--ws-bubble-w:190px;--ws-bubble-h:104px;height:104px}
  .whalestory-bubble-text{font-size:12px}
  .whalestory-peek{top:84px;right:8px;transform:scale(.82);transform-origin:top right}
}
@media (prefers-reduced-motion:reduce){
  .whalestory-bob,.whalestory-frame-a,.whalestory-frame-b,.whalestory-peek-char{animation:none !important}
  .whalestory-actor,.whalestory-bubble{transition:none !important}
}
`;

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register('whalestory', { zh: ZH, en: EN }), 'whalestory: locale');
        ctx.effect(() => {
          if (typeof document === 'undefined') return undefined;
          const style = document.createElement('style');
          style.dataset.whalestory = 'style';
          style.textContent = CSS;
          document.head.appendChild(style);
          return () => style.remove();
        }, 'whalestory: styles');
        ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
          name: 'conversation.input.dock',
          id: 'whalestory-companion',
          order: 100,
          locale: 'whalestory',
        }, Companion));
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'whalestory-peek',
          order: 100,
          locale: 'whalestory',
        }, PendingPeek));
      },
      __test: {
        PHRASES,
        clipLine,
        hashString,
        basename,
        extractFile,
        extractCommandLine,
        firstToken,
        isFrontendFile,
        isFrontendCommand,
        isTestOrBuild,
        toolFailed,
        classifyThoughtText,
        deriveSignal,
        pickLocalLine,
        shouldUseLlm,
        stepWalker,
        bubblePlacement,
        walkFlip,
        peekLineFor,
        toObservation,
      },
    };
  },
});
