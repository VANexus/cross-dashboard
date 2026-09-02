import type { Metadata } from "next";
import { JourneyRunClient } from "./journey-run-client";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `旅程执行 | ${id} | FlowMind` };
}

export default async function JourneyRunPage({ params }: Props) {
  const { id } = await params;
  return <JourneyRunClient journeyId={id} />;
}
