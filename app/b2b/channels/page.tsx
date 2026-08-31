import { B2BNav } from "../b2b-nav";
import { ChannelsClient } from "./channels-client";

export default function ChannelsPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-7">
      <B2BNav />
      <ChannelsClient />
    </div>
  );
}
