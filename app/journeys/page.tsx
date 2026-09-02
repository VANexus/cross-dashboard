import type { Metadata } from "next";
import { JourneysClient } from "./journeys-client";

export const metadata: Metadata = {
  title: "流程编排中心 | FlowMind",
  description: "以端到端业务旅程为主线，串联全部工作流空间",
};

export default function JourneysPage() {
  return <JourneysClient />;
}
