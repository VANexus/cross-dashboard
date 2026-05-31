import { AiImagingClient } from "../ai-imaging-client";
import { WorkflowService } from "@/lib/services";
import { getDbAsync } from "@/lib/db";

export async function AiImagingIsland() {
  await getDbAsync();
  const service = new WorkflowService();
  return (
    <AiImagingClient
      mainImages={service.getImages("main")}
      sceneImages={service.getImages("scene")}
      storyboardFrames={service.getStoryboardFrames()}
    />
  );
}
