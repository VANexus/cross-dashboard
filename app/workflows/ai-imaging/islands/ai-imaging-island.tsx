import { AiImagingClient } from "../ai-imaging-client";
import { WorkflowService } from "@/lib/services";
import { getDbAsync } from "@/lib/db";

export async function AiImagingIsland() {
  await getDbAsync();
  const service = new WorkflowService();
  return (
    <AiImagingClient
      mainImages={await service.getImages("main")}
      sceneImages={await service.getImages("scene")}
      storyboardFrames={await service.getStoryboardFrames()}
    />
  );
}
