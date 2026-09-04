import { VideoLocalizationClient } from "../video-localization-client";
import { LocalizeService } from "@/lib/server/services";
import { getDbAsync } from "@/lib/server/db";
import { connection } from "next/server";

export async function VideoLocalizationIsland() {
  await connection();
  await getDbAsync();
  const service = new LocalizeService();
  const [tasks, health] = await Promise.all([
    service.getTasks(),
    service.getHealth(),
  ]);

  return (
    <VideoLocalizationClient
      initialTasks={tasks}
      initialHealth={health}
    />
  );
}