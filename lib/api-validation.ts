import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamSchema = z.object({
  id: z.string().min(1),
});

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).default(""),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  assignedAgents: z.array(z.string()).default([]),
});

export const updateTaskSchema = z.object({
  status: z.enum(["pending", "running", "completed", "failed", "cancelled"]).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  output: z.string().optional(),
});

export const updateStepSchema = z.object({
  status: z.enum(["pending", "running", "completed", "failed"]).optional(),
  output: z.string().optional(),
});

export const createMemorySchema = z.object({
  zone: z.enum(["preset", "dev", "prompt"]),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  type: z.enum(["script", "code", "prompt", "skill"]),
  tags: z.array(z.string()).default([]),
});

export const updateMemorySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  type: z.enum(["script", "code", "prompt", "skill"]).optional(),
  tags: z.array(z.string()).optional(),
  verified: z.boolean().optional(),
});

export const createRiskEventSchema = z.object({
  level: z.enum(["safe", "level3", "level2", "level1"]),
  title: z.string().min(1).max(200),
  description: z.string().max(1000),
  source: z.string().min(1),
  actions: z.array(z.string()).default([]),
});

export const updateRiskEventSchema = z.object({
  resolved: z.boolean().optional(),
  resolvedAt: z.string().optional(),
});

export const createEvolutionSchema = z.object({
  stage: z.enum(["identify", "generate", "test", "review", "reuse"]),
  title: z.string().min(1).max(200),
  description: z.string().max(1000),
  agentId: z.string().min(1),
});

export const updateEvolutionSchema = z.object({
  status: z.enum(["in_progress", "success", "failed"]).optional(),
  metrics: z
    .object({
      accuracy: z.number().min(0).max(100),
      latency: z.number().min(0),
      coverage: z.number().min(0).max(100),
    })
    .optional(),
  completedAt: z.string().optional(),
});

export const updateAdKeywordSchema = z.object({
  cpc: z.number().min(0).optional(),
  tag: z.enum(["high-acos", "high-conversion", "non-precise"]).optional(),
});

export const generateImageSchema = z.object({
  type: z.enum(["main", "scene", "aplus"]),
  prompt: z.string().min(1),
  model: z.string().default("stable-diffusion"),
  style: z.string().optional(),
  count: z.number().int().min(1).max(4).default(1),
});

export const updateImageSchema = z.object({
  isBest: z.boolean().optional(),
});

export const generateListingSchema = z.object({
  keyword: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  category: z.string().optional(),
  language: z.enum(["en", "ja", "de", "fr"]).default("en"),
});

export const publishListingSchema = z.object({
  title: z.string().min(1),
  bulletPoints: z.array(
    z.object({
      title: z.string(),
      desc: z.string(),
    })
  ),
  description: z.string(),
  categoryId: z.string(),
  images: z.array(z.string().url()),
});

export const executeResearchSchema = z.object({
  sources: z.array(z.string()).min(1),
  keywords: z.array(z.string()).optional(),
  category: z.string().optional(),
  marketplace: z.enum(["US", "UK", "DE", "JP"]).default("US"),
});

export const createRestockOrderSchema = z.object({
  items: z.array(
    z.object({
      sku: z.string(),
      quantity: z.number().int().min(1),
      shipMethod: z.enum(["sea", "air", "express"]).default("sea"),
    })
  ),
});

export const analyzeCompetitorSchema = z.object({
  asins: z.array(z.string()).min(1).max(20),
  marketplace: z.enum(["US", "UK", "DE", "JP"]).default("US"),
  keywords: z.array(z.string()).optional(),
});

export const updateIsolationSchema = z.object({
  index: z.number().int().min(0).max(5),
  checked: z.boolean(),
});
