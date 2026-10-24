/**
 * Host half of the whalestory companion bundle.
 *
 * Two same-origin routes:
 * - GET/HEAD /whalestory/assets/<name>.webp  static artwork, allow-listed;
 * - POST    /whalestory/narrate             one tiny, independent, tool-less
 *                                            model call with hard budgets.
 *
 * The main Session is never touched: no sessionId is attached to the model
 * request, no Session event is appended, and no tool/prompt is registered.
 */
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import {
  MAX_OBSERVATION_BYTES,
  MAX_OUTPUT_TOKENS,
  generateNarration,
  normalizeObservation,
  shortField,
} from './narrate.js';

export const inject = ['webServer'];

const ASSET_DIR = fileURLToPath(new URL('./assets/', import.meta.url));
const ASSET_BASE = '/whalestory/assets';
const NARRATE_PATH = '/whalestory/narrate';

const ASSET_NAMES = new Set([
  'normal.webp',
  'attention.webp',
  'asking.webp',
  'writing.webp',
  'walk_1.webp',
  'walk_2.webp',
  'bubble.webp',
]);

const LLM_WINDOW_MS = 10 * 60 * 1000;
const LLM_MAX_PER_WINDOW = 20;
const LLM_GLOBAL_WINDOW_MS = 60 * 60 * 1000;
const LLM_GLOBAL_MAX = 30;
const LLM_MIN_INTERVAL_MS = 45_000;
const LLM_TIMEOUT_MS = 6000;

/** Boot-time client constants; no secrets. */
export const PUBLIC_CONFIG = Object.freeze({
  assetBase: ASSET_BASE,
  narratePath: NARRATE_PATH,
  llmEnabled: true,
  llmMinIntervalMs: LLM_MIN_INTERVAL_MS,
  llmTimeoutMs: LLM_TIMEOUT_MS,
  llmMaxOutputTokens: MAX_OUTPUT_TOKENS,
  walkSpeedPxPerSecond: 42,
  frameMs: 220,
  speechMs: 6500,
  idleSpeechMs: 24000,
  minSpeechGapMs: 3500,
  milestoneTools: 6,
  milestoneRunMs: 90_000,
});

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
function serveAsset(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' });
    res.end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
  } catch {
    res.writeHead(400);
    res.end();
    return;
  }
  const prefix = `${ASSET_BASE}/`;
  if (!pathname.startsWith(prefix)) {
    res.writeHead(404);
    res.end();
    return;
  }
  const name = pathname.slice(prefix.length);
  if (!ASSET_NAMES.has(name)) {
    res.writeHead(404);
    res.end();
    return;
  }

  const file = join(ASSET_DIR, name);
  stat(file)
    .then((info) => {
      if (!info.isFile()) throw Object.assign(new Error('not a file'), { code: 'ENOENT' });
      const headers = {
        'content-type': 'image/webp',
        'content-length': String(info.size),
        'cache-control': 'no-cache',
        'x-content-type-options': 'nosniff',
      };
      if (req.method === 'HEAD') {
        res.writeHead(200, headers);
        res.end();
        return;
      }
      res.writeHead(200, headers);
      const stream = createReadStream(file);
      stream.on('error', () => res.destroy());
      stream.pipe(res);
    })
    .catch(() => {
      if (!res.headersSent) res.writeHead(404);
      res.end();
    });
}

/**
 * Read a small JSON body. Oversized input is rejected before parsing.
 * @param {import('node:http').IncomingMessage} req
 * @param {number} maxBytes
 * @returns {Promise<unknown>}
 */
async function readJsonBody(req, maxBytes) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) throw Object.assign(new Error('body too large'), { code: 'TOO_LARGE' });
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (text.trim() === '') throw Object.assign(new Error('empty body'), { code: 'EMPTY' });
  return JSON.parse(text);
}

/**
 * Register the two routes, the optional narration route, and the boot config.
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
export function apply(ctx) {
  ctx.effect(
    () => ctx.webServer.register({ kind: 'prefix', path: ASSET_BASE, handler: serveAsset }),
    'whalestory: static artwork route',
  );

  ctx.effect(
    () => ctx.on('webserver/index-inject', (table) => {
      table.push({ kind: 'global', name: '__WHALESTORY_CONFIG__', value: PUBLIC_CONFIG });
    }),
    'whalestory: boot config',
  );

  const buckets = new Map();
  const activeControllers = new Set();
  let inFlight = false;
  let globalWindowStart = Date.now();
  let globalCount = 0;

  const allow = (key, now) => {
    if (inFlight) return { ok: false, retryAfter: 2 };
    if (now - globalWindowStart >= LLM_GLOBAL_WINDOW_MS) {
      globalWindowStart = now;
      globalCount = 0;
    }
    if (globalCount >= LLM_GLOBAL_MAX) {
      return { ok: false, retryAfter: Math.max(1, Math.ceil((globalWindowStart + LLM_GLOBAL_WINDOW_MS - now) / 1000)) };
    }

    let bucket = buckets.get(key);
    if (bucket !== undefined && now - bucket.windowStart >= LLM_WINDOW_MS) {
      bucket = undefined;
      buckets.delete(key);
    }
    if (bucket !== undefined) {
      const wait = LLM_MIN_INTERVAL_MS - (now - bucket.lastAt);
      if (wait > 0) return { ok: false, retryAfter: Math.ceil(wait / 1000) };
      if (bucket.count >= LLM_MAX_PER_WINDOW) {
        return { ok: false, retryAfter: Math.max(1, Math.ceil((bucket.windowStart + LLM_WINDOW_MS - now) / 1000)) };
      }
    }
    return { ok: true, bucket };
  };

  const commit = (key, bucket, now) => {
    inFlight = true;
    globalCount += 1;
    if (bucket === undefined) {
      buckets.set(key, { lastAt: now, count: 1, windowStart: now });
    } else {
      bucket.lastAt = now;
      bucket.count += 1;
    }
    if (buckets.size > 256) {
      for (const [id, entry] of buckets) {
        if (now - entry.lastAt > LLM_GLOBAL_WINDOW_MS) buckets.delete(id);
      }
    }
  };

  ctx.inject(['llm', 'agentDefaultModel'], (child) => {
    child.effect(() => {
      const handler = async (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405, { allow: 'POST' });
          res.end();
          return;
        }

        const origin = req.headers.origin;
        if (typeof origin === 'string') {
          let originHost;
          try {
            originHost = new URL(origin).host;
          } catch {
            originHost = '';
          }
          if (originHost === '' || (typeof req.headers.host === 'string' && originHost !== req.headers.host)) {
            res.writeHead(403);
            res.end();
            return;
          }
        }
        if (req.headers['x-whalestory'] !== '1') {
          res.writeHead(403);
          res.end();
          return;
        }
        const contentType = String(req.headers['content-type'] ?? '');
        if (!contentType.toLowerCase().startsWith('application/json')) {
          res.writeHead(415);
          res.end();
          return;
        }

        let body;
        try {
          body = await readJsonBody(req, MAX_OBSERVATION_BYTES);
        } catch (error) {
          if (error?.code === 'TOO_LARGE') {
            res.writeHead(413);
            res.end();
            return;
          }
          res.writeHead(400);
          res.end();
          return;
        }

        const observation = normalizeObservation(body?.observation);
        if (observation === null) {
          res.writeHead(400);
          res.end();
          return;
        }

        const clientId = shortField(body?.clientId, 64).replace(/[^A-Za-z0-9_-]/gu, '') || 'anon';
        const sessionKey = shortField(body?.sessionKey, 64).replace(/[^A-Za-z0-9_-]/gu, '') || 'anon';
        const bucketKey = `${clientId}:${sessionKey}`;
        const now = Date.now();
        const decision = allow(bucketKey, now);
        if (!decision.ok) {
          res.writeHead(429, { 'retry-after': String(decision.retryAfter) });
          res.end();
          return;
        }

        commit(bucketKey, decision.bucket, now);
        const controller = new AbortController();
        activeControllers.add(controller);
        const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

        try {
          const selection = child.agentDefaultModel.currentSelection();
          const diagnostics = {};
          const text = await generateNarration({
            llm: child.llm,
            selection,
            observation,
            signal: controller.signal,
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            diagnostics,
          });
          if (text === null) {
            res.writeHead(204, {
              'x-whalestory-error': String(diagnostics.reason ?? 'UNKNOWN').slice(0, 64),
            });
            res.end();
            return;
          }
          res.writeHead(200, {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
            'x-content-type-options': 'nosniff',
          });
          res.end(JSON.stringify({ text }));
        } catch (error) {
          if (!controller.signal.aborted) {
            child.logger?.warn?.('whalestory: independent narration failed', {
              name: error?.name,
              code: error?.code,
            });
          }
          if (!res.headersSent) {
            res.writeHead(204, {
              'x-whalestory-error': String(error?.code ?? error?.name ?? 'UNKNOWN').slice(0, 64),
            });
          }
          res.end();
        } finally {
          clearTimeout(timer);
          activeControllers.delete(controller);
          inFlight = false;
        }
      };

      return child.webServer.register({ kind: 'exact', path: NARRATE_PATH, handler });
    }, 'whalestory: independent narration route');

    child.effect(() => () => {
      for (const controller of activeControllers) controller.abort();
      activeControllers.clear();
      inFlight = false;
    }, 'whalestory: narration cleanup');
  });
}
