/**
 * FlowMind RAK — Image Generation Types
 */

export interface ImageGenerationParams {
  prompt: string;
  type: "main" | "scene" | "aplus";
  style?: "realistic" | "artistic" | "minimalist";
  size?: "1024x1024" | "1024x1792" | "1792x1024";
  count?: number;
  model?: string;
}

export interface GeneratedImage {
  url: string;
  model: string;
  seed?: number;
  revisedPrompt?: string;
}
