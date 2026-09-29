import { PrismaClient } from '@prisma/client';
import { matchKb } from './knowledge';

// ---------------------------------------------------------------------------
// Standard RAG knowledge base: Qdrant (vector DB) + LLM embeddings.
// Replaces keyword-only retrieval. The LLM searches this vector store and
// answers grounded strictly on what it finds (see ai.ts hallucination rules).
//
// No third-party HTTP client — we use built-in `fetch` against the Qdrant REST
// API and the provider's OpenAI-compatible /embeddings endpoint, so the Docker
// build stays dependency-free.
//
// Best-effort: if Qdrant / embeddings are unavailable, all vector helpers throw
// or return empty, and callers silently fall back to the keyword `matchKb`.
// ---------------------------------------------------------------------------

const QDRANT_URL = (process.env.QDRANT_URL || 'http://127.0.0.1:6333').replace(/\/+$/, '');
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || '';
const COLLECTION = 'kb_chunks';

const BAILIAN_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

export interface EmbedConfig {
  provider: 'openai' | 'bailian';
  baseUrl: string;
  apiKey: string;
  model: string;
  dim: number;
}

function qdrantHeaders(): Record<string, string> {
  return QDRANT_API_KEY ? { 'api-key': QDRANT_API_KEY } : {};
}

// ---- embeddings config (mirrors ai.ts provider settings) --------------------
async function readEmbedConfig(prisma: PrismaClient): Promise<EmbedConfig> {
  const rows = await prisma.setting.findMany({ where: { key: { startsWith: 'ai' } } });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const provider = map.get('aiProvider') === 'bailian' ? 'bailian' : 'openai';

  let baseUrl = '';
  let apiKey = '';
  if (provider === 'bailian') {
    baseUrl = BAILIAN_BASE_URL;
    apiKey = map.get('aiBailianApiKey') || '';
  } else {
    baseUrl = (map.get('aiOpenaiBaseUrl') || 'https://api.openai.com/v1').replace(/\/+$/, '');
    apiKey = map.get('aiOpenaiApiKey') || '';
  }

  const embedModel =
    map.get('aiEmbeddingModel') ||
    (provider === 'bailian' ? 'text-embedding-v4' : 'text-embedding-3-small');

  const mappedDim = () => {
    if (embedModel.includes('text-embedding-v4')) return 1024;
    if (embedModel.includes('text-embedding-3')) {
      return embedModel.includes('large') ? 3072 : 1536;
    }
    return 1536;
  };
  const dim = Number(map.get('aiEmbeddingDim') || mappedDim());

  return { provider, baseUrl, apiKey, model: embedModel, dim };
}

async function embedTexts(cfg: EmbedConfig, texts: string[]): Promise<number[][]> {
  const url = `${cfg.baseUrl}/embeddings`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({ model: cfg.model, input: texts }),
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`embedding http ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
    const json: any = await resp.json();
    if (!Array.isArray(json?.data)) throw new Error('embedding response missing data');
    return json.data.map((d: any) => d.embedding as number[]);
  } finally {
    clearTimeout(timer);
  }
}

/** Ensure the Qdrant collection exists with the right vector size/distance. */
async function ensureCollection(cfg: EmbedConfig): Promise<void> {
  const url = `${QDRANT_URL}/collections/${COLLECTION}`;
  const resp = await fetch(url, { method: 'GET', headers: qdrantHeaders() });
  if (resp.ok) return;
  if (resp.status !== 404) throw new Error(`qdrant status ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  const create = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...qdrantHeaders() },
    body: JSON.stringify({
      vectors: { size: cfg.dim, distance: 'Cosine' },
    }),
  });
  if (!create.ok) throw new Error(`qdrant create failed ${create.status}: ${(await create.text()).slice(0, 200)}`);
}

// ---- chunking ---------------------------------------------------------------
// One point per KB entry is enough for our grounded Q&A store. Long answers are
// split on sentence boundaries so each chunk stays semantically tight. Each
// chunk carries the original question + its own answer slice as payload.
export interface KbChunk {
  pointId: string; // deterministic qdrant id: `kb-<entryId>[-<i>]`
  text: string; // embedded text (question + chunk answer)
  payload: { kbId: string; category: string; question: string; answer: string };
}

export function chunkKbEntry(entry: { id: string; category: string; question: string; answer: string }): KbChunk[] {
  const MAX = 300;
  const sentences = (entry.answer || '')
    .split(/(?<=[。！？!?\n])/g)
    .map((s) => s.trim())
    .filter(Boolean);
  let buf = '';
  const parts: string[] = [];
  for (const s of sentences) {
    if (buf && (buf + s).length > MAX) {
      parts.push(buf);
      buf = s;
    } else {
      buf += s;
    }
  }
  if (buf) parts.push(buf);
  const chunks = parts.length ? parts : [entry.answer || ''];
  return chunks.map((answer, i) => ({
    pointId: chunks.length > 1 ? `kb-${entry.id}-${i}` : `kb-${entry.id}`,
    text: `${entry.question} ${answer}`.trim(),
    payload: { kbId: entry.id, category: entry.category, question: entry.question, answer: answer.trim() },
  }));
}

// ---- sync helpers (idempotent upsert / delete) -------------------------------
export async function upsertKbChunks(cfg: EmbedConfig, chunks: KbChunk[]): Promise<void> {
  if (!chunks.length) return;
  await ensureCollection(cfg);
  const vectors = await embedTexts(cfg, chunks.map((c) => c.text));
  const points = chunks.map((c, i) => ({
    id: c.pointId,
    vector: vectors[i],
    payload: c.payload,
  }));
  const resp = await fetch(`${QDRANT_URL}/collections/${COLLECTION}/points?wait=true`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...qdrantHeaders() },
    body: JSON.stringify({ points }),
  });
  if (!resp.ok) throw new Error(`qdrant upsert failed ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
}

export async function deleteKbChunks(cfg: EmbedConfig, kbIds: string[]): Promise<void> {
  const resp = await fetch(`${QDRANT_URL}/collections/${COLLECTION}/points/delete?wait=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...qdrantHeaders() },
    body: JSON.stringify({ filter: { should: kbIds.map((id) => ({ key: 'kbId', match: { value: id } })) } }),
  });
  if (!resp.ok) throw new Error(`qdrant delete failed ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
}

// ---- full re-sync (used at boot after seedKb) --------------------------------
export async function vectorizeKb(prisma: PrismaClient): Promise<number> {
  const cfg = await readEmbedConfig(prisma);
  if (!cfg.apiKey) return 0;
  const entries = await prisma.kbEntry.findMany({ where: { enabled: true } });
  if (!entries.length) return 0;
  await ensureCollection(cfg);
  // Reset the collection points for KbEntries owned by the store, then re-upsert.
  const kbIds = entries.map((e) => e.id);
  await deleteKbChunks(cfg, kbIds).catch(() => {});
  const chunks = entries.flatMap((e) => chunkKbEntry(e));
  await upsertKbChunks(cfg, chunks);
  console.log(`[vector] vectorized ${entries.length} KB entries -> ${chunks.length} chunks (model=${cfg.model} dim=${cfg.dim})`);
  return chunks.length;
}

/** Sync a single entry after admin create/update (best-effort). */
export async function syncKbEntryVector(prisma: PrismaClient, entry: any): Promise<void> {
  try {
    const cfg = await readEmbedConfig(prisma);
    if (!cfg.apiKey) return;
    await deleteKbChunks(cfg, [entry.id]).catch(() => {});
    await upsertKbChunks(cfg, chunkKbEntry(entry));
  } catch (e: any) {
    console.warn('[vector] sync entry failed (fallback to keyword KB):', e?.message || e);
  }
}

/** Delete vectors for an entry (best-effort). */
export async function deleteKbEntryVector(prisma: PrismaClient, kbId: string): Promise<void> {
  try {
    const cfg = await readEmbedConfig(prisma);
    if (!cfg.apiKey) return;
    await deleteKbChunks(cfg, [kbId]);
  } catch (e: any) {
    console.warn('[vector] delete entry failed:', e?.message || e);
  }
}

// ---- retrieval --------------------------------------------------------------
/**
 * Semantic retrieval from Qdrant. Returns readable grounding text built from
 * the top-k hits, or '' when nothing relevant is found / the store is down.
 * Callers fall back to the keyword `matchKb` when this returns ''.
 */
export async function searchKbVector(prisma: PrismaClient, query: string, max = 5): Promise<string> {
  const q = String(query || '').trim();
  if (!q) return '';
  try {
    const cfg = await readEmbedConfig(prisma);
    if (!cfg.apiKey) return '';
    const [vec] = await embedTexts(cfg, [q]);
    const resp = await fetch(`${QDRANT_URL}/collections/${COLLECTION}/points/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...qdrantHeaders() },
      body: JSON.stringify({ vector: vec, limit: max, with_payload: true }),
    });
    if (!resp.ok) {
      if (resp.status === 404) return ''; // collection not created yet
      throw new Error(`qdrant search failed ${resp.status}`);
    }
    const json: any = await resp.json();
    const hits: any[] = json?.result || [];
    if (!hits.length) return '';
    return hits
      .map((h, i) => `${i + 1}. ${h.payload?.question}：${h.payload?.answer}`)
      .join('\n');
  } catch (e: any) {
    console.warn('[vector] search unavailable (fallback to keyword KB):', e?.message || e);
    return '';
  }
}

/** Combined retrieval: vector-first, keyword fallback. */
export async function retrieveKb(prisma: PrismaClient, query: string, max = 5): Promise<string> {
  const vec = await searchKbVector(prisma, query, max);
  if (vec) return vec;
  return (await matchKb(prisma, query, max)) || '';
}