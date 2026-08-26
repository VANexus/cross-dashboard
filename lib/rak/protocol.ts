/**
 * FlowMind RAK — Protocol types and constants
 * RAK v1 protocol specification
 */

export const RAK_PROTOCOL_VERSION = "rak-v1";

export type MessageType = "request" | "response" | "event" | "heartbeat";
export type MessageStatus = "pending" | "delivered" | "acknowledged" | "failed";
export type DAGNodeType = "task" | "decision" | "merge" | "start" | "end";
export type DAGNodeStatus = "pending" | "ready" | "running" | "completed" | "failed" | "skipped";

export interface RAKMessagePayload {
  action: string;
  data: unknown;
  correlationId?: string;
}

export interface RAKMessageInput {
  from: string;
  to: string;            // agent ID or '*' for broadcast
  type: MessageType;
  payload: RAKMessagePayload;
  ttl?: number;          // ms, default 30000
}

export interface DAGDefinition {
  nodes: DAGNodeDefinition[];
  edges: { from: string; to: string }[];
}

export interface DAGNodeDefinition {
  id: string;
  name: string;
  type: DAGNodeType;
  assignedAgent?: string;
  config?: Record<string, unknown>;
}
