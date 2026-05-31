/**
 * FlowMind RAK — Image Generator
 * Uses OpenAI DALL-E API for product image generation
 */
import type { ImageGenerationParams, GeneratedImage } from "./types";

const DEFAULT_MODEL = "dall-e-3";
const DEFAULT_SIZE = "1024x1024";

export class ImageGenerator {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(config: { apiKey: string; baseUrl?: string; model?: string }) {
    this.apiKey = config.apiKey;
    const rawBase = config.baseUrl || "https://api.openai.com";
    // Strip trailing /v1 to avoid double path — we add /v1/images/generations ourselves
    this.baseUrl = rawBase.replace(/\/v1\/?$/, "");
    this.defaultModel = config.model || DEFAULT_MODEL;
  }

  /**
   * Generate product images
   */
  async generate(params: ImageGenerationParams): Promise<GeneratedImage[]> {
    const model = params.model || this.defaultModel;
    const size = params.size || DEFAULT_SIZE;
    const count = Math.min(params.count || 1, 4);

    // Enhance prompt based on image type
    const enhancedPrompt = this.enhancePrompt(params.prompt, params.type, params.style);

    return this.generateWithDallE(enhancedPrompt, size, count, model);
  }

  /**
   * Enhance prompt based on image type and style
   */
  private enhancePrompt(prompt: string, type: string, style?: string): string {
    const styleModifiers: Record<string, string> = {
      realistic: "professional product photography, studio lighting, white background, high resolution",
      artistic: "creative artistic rendering, vibrant colors, stylized illustration",
      minimalist: "clean minimalist design, simple composition, neutral background",
    };

    const typeModifiers: Record<string, string> = {
      main: "Amazon product listing main image, centered product, white background, no text",
      scene: "lifestyle product photo, in-use context, natural environment",
      aplus: "A+ content banner, professional marketing material, brand storytelling",
    };

    const styleMod = style ? styleModifiers[style] || "" : styleModifiers.realistic;
    const typeMod = typeModifiers[type] || "";

    return `${prompt}, ${typeMod}, ${styleMod}, 8k quality, professional commercial photography`;
  }

  /**
   * Generate images using DALL-E API
   */
  private async generateWithDallE(
    prompt: string,
    size: string,
    count: number,
    model: string,
  ): Promise<GeneratedImage[]> {
    const isDallE = model.startsWith("dall-e");
    const isSiliconFlow = this.baseUrl.includes("siliconflow");

    let body: Record<string, unknown>;
    if (isSiliconFlow) {
      body = {
        model,
        prompt,
        image_size: size,
        batch_size: count,
        num_inference_steps: 20,
        guidance_scale: 7.5,
      };
    } else {
      body = {
        model,
        prompt,
        n: count,
        size,
        response_format: "url",
      };
      if (isDallE) body.quality = "hd";
    }

    const url = `${this.baseUrl}/v1/images/generations`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Image API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as {
      data: { url?: string; b64_json?: string; image_file?: string; revised_prompt?: string }[];
      images?: { url?: string }[];
    };

    // SiliconFlow may return data.data or data.images
    const images = data.data ?? data.images ?? [];
    return images.map((img) => ({
      url: img.url || (img.b64_json ? `data:image/png;base64,${img.b64_json}` : img.image_file || ""),
      model,
      revisedPrompt: img.revised_prompt,
    }));
  }

  /**
   * Generic image generation API
   */
  private async generateGeneric(
    prompt: string,
    size: string,
    count: number,
    model: string,
  ): Promise<GeneratedImage[]> {
    // Placeholder for other image generation APIs (Stable Diffusion, Midjourney, etc.)
    // In production, implement specific API integration here
    throw new Error(`Unsupported image generation model: ${model}`);
  }
}
