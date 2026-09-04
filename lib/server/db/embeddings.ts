/**
 * FlowMind — Embedding 向量化模块
 *
 * 记忆系统稠密向量的唯一来源（Milvus dense 字段）：
 *   1. 配置了 EMBEDDING_* / LiteLLM 网关 → 走真实模型 /embeddings（OpenAI 兼容）；
 *   2. 未配置（开发机默认）→ 本地确定性向量器（768 维字符 n-gram 哈希 + L2 归一化）。
 *
 * 两者均产出真实数值向量、确定性可复算，Milvus 检索链路始终生效（无 mock / 无降级）。
 */
import { embeddingConfig } from "@/lib/cluster";

export const EMBEDDING_DIM = 768;

const DEFAULT_MODEL = "bge-m3";

// ── 本地确定性向量器（字符 n-gram 特征哈希，L2 归一化）────────────────

function hashGram(gram: string): number {
  let h = 2166136261;
  for (const ch of gram) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function localEmbed(text: string, dim = EMBEDDING_DIM): number[] {
  const v = new Array<number>(dim).fill(0);
  const s = ` ${text.trim().toLowerCase()} `;
  for (let i = 0; i < s.length - 2; i++) {
    const idx = hashGram(s.slice(i, i + 3)) % dim;
    v[idx] += 1;
  }
  for (let i = 0; i < s.length - 1; i++) {
    const idx = (hashGram(s.slice(i, i + 2)) >> 3) % dim;
    v[idx] += 0.5;
  }
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm) || 1;
  return v.map((x) => x / norm);
}

// ── 真实模型网关（OpenAI 兼容 /embeddings）──────────────────────────

async function remoteEmbed(texts: string[], cfg: { baseUrl: string; apiKey: string; model: string }): Promise<number[][]> {
  const url = `${cfg.baseUrl.replace(/\/+$/, "")}/embeddings`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({ model: cfg.model || DEFAULT_MODEL, input: texts }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`[embedding] ${res.status} ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data?: Array<{ embedding: number[] }>; error?: { message?: string } };
  if (json.error?.message) throw new Error(`[embedding] ${json.error.message}`);
  const data = json.data ?? [];
  if (data.length !== texts.length) {
    throw new Error(`[embedding] 返回条数不匹配: ${data.length} != ${texts.length}`);
  }
  return data.map((d) => d.embedding);
}

// ── 统一入口 ──────────────────────────────────────────────────────

let _cache: { cfg: string; mode: "remote" | "local" } | null = null;

function resolveMode(): "remote" | "local" {
  const cfg = embeddingConfig();
  if (cfg.baseUrl && cfg.apiKey) return "remote";
  return "local";
}

/** 批量向量化。返回与输入等长的 dim 维向量数组。
 * 模式由配置决定（无静默降级）：remote 配置了就严格走模型网关（失败即抛错）；
 * 未配置网关时默认本地确定性向量器（也是真实向量，检索链路始终生效）。 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (resolveMode() === "remote") {
    return await remoteEmbed(texts, embeddingConfig());
  }
  return texts.map((t) => localEmbed(t));
}

/** 单条向量化。 */
export async function embedText(text: string): Promise<number[]> {
  const [v] = await embedTexts([text]);
  return v;
}

/** 当前向量化模式（诊断/面板展示用）。 */
export function embeddingMode(): "remote" | "local" {
  if (!_cache || _cache.cfg !== JSON.stringify(embeddingConfig())) {
    _cache = { cfg: JSON.stringify(embeddingConfig()), mode: resolveMode() };
  }
  return _cache.mode;
}
