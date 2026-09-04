import { AiImagingClient } from "../ai-imaging-client";
import { WorkflowService } from "@/lib/server/services";
import { getDbAsync } from "@/lib/server/db";

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
