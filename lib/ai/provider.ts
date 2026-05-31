/**
 * FlowMind RAK — AI Provider interface
 * Abstract interface for AI capabilities
 */

export interface GenerateParams {
  prompt: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

export interface GenerateResult {
  content: string;
  usage: { input: number; output: number };
  model: string;
  latency: number;
}

export interface AnalyzeParams {
  prompt: string;
  data: unknown;
  schema?: string; // Zod schema description for structured output
}

export interface ImageParams {
  prompt: string;
  model?: string;
  style?: string;
  size?: string;
  count?: number;
}

export interface ImageResult {
  url: string;
  model: string;
  seed?: number;
}

export interface AIProvider {
  readonly name: string;

  generate(params: GenerateParams): Promise<GenerateResult>;
  analyze<T>(params: AnalyzeParams): Promise<T>;
  generateImage?(params: ImageParams): Promise<ImageResult>;
}

export type AIProviderName = "mock" | "claude" | "openai";
