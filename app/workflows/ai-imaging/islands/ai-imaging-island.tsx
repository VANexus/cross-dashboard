import { backendGet } from "@/lib/backend-client";
import { AiImagingClient } from "../ai-imaging-client";

export async function AiImagingIsland() {
  const [mainRes, sceneRes, storyboardRes] = await Promise.all([
    backendGet("/api/workflows/ai-imaging/images?type=main"),
    backendGet("/api/workflows/ai-imaging/images?type=scene"),
    backendGet("/api/workflows/ai-imaging/storyboard"),
  ]);

  return (
    <AiImagingClient
      mainImages={mainRes.data ?? []}
      sceneImages={sceneRes.data ?? []}
      storyboardFrames={storyboardRes.data ?? []}
    />
  );
}
