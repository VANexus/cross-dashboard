/**
 * FlowMind RAK — Mesh Executor
 * DAG-based parallel task execution
 */
import * as rakRepo from "../repositories/rak.repository";
import type { DAGNode } from "../repositories/rak.repository";
import type { DAGDefinition, DAGNodeDefinition } from "./protocol";

export class MeshExecutor {
  // ========== DAG Management ==========

  createDAG(taskId: string, definition: DAGDefinition): DAGNode[] {
    // Create start node
    rakRepo.saveDAGNode({
      id: `${taskId}-start`,
      taskId,
      name: "开始",
      type: "start",
      dependencies: [],
    });

    // Create task nodes
    for (const node of definition.nodes) {
      const deps = definition.edges
        .filter((e) => e.to === node.id)
        .map((e) => `${taskId}-${e.from}`);

      rakRepo.saveDAGNode({
        id: `${taskId}-${node.id}`,
        taskId,
        name: node.name,
        type: node.type,
        assignedAgent: node.assignedAgent,
        dependencies: deps.length > 0 ? deps : [`${taskId}-start`],
        config: node.config,
      });
    }

    // Create end node
    const endDeps = definition.edges
      .filter((e) => !definition.edges.some((e2) => e2.from === e.to))
      .map((e) => `${taskId}-${e.to}`);
    if (endDeps.length === 0) {
      endDeps.push(`${taskId}-${definition.nodes[definition.nodes.length - 1]?.id ?? "start"}`);
    }

    rakRepo.saveDAGNode({
      id: `${taskId}-end`,
      taskId,
      name: "完成",
      type: "end",
      dependencies: endDeps,
    });

    return rakRepo.getDAGForTask(taskId);
  }

  getDAG(taskId: string): DAGNode[] {
    return rakRepo.getDAGForTask(taskId);
  }

  // ========== Execution ==========

  getReadyNodes(taskId: string): DAGNode[] {
    const nodes = rakRepo.getDAGForTask(taskId);
    return nodes.filter((n) => {
      if (n.status !== "pending") return false;
      // All dependencies must be completed
      return n.dependencies.every((depId) => {
        const dep = nodes.find((n2) => n2.id === depId);
        return dep?.status === "completed" || dep?.status === "skipped";
      });
    });
  }

  startNode(nodeId: string, taskId: string): void {
    rakRepo.updateDAGNodeStatus(nodeId, taskId, "running");
  }

  completeNode(nodeId: string, taskId: string, result?: unknown): void {
    rakRepo.updateDAGNodeStatus(nodeId, taskId, "completed", result);
  }

  failNode(nodeId: string, taskId: string, error: unknown): void {
    rakRepo.updateDAGNodeStatus(nodeId, taskId, "failed", { error });
  }

  skipNode(nodeId: string, taskId: string): void {
    rakRepo.updateDAGNodeStatus(nodeId, taskId, "skipped");
  }

  // ========== DAG Analysis ==========

  isComplete(taskId: string): boolean {
    const nodes = rakRepo.getDAGForTask(taskId);
    return nodes.every((n) =>
      n.status === "completed" || n.status === "skipped" || n.type === "end",
    );
  }

  hasFailures(taskId: string): boolean {
    const nodes = rakRepo.getDAGForTask(taskId);
    return nodes.some((n) => n.status === "failed");
  }

  getExecutionOrder(taskId: string): string[][] {
    // Topological sort with parallel grouping
    const nodes = rakRepo.getDAGForTask(taskId);
    const levels: string[][] = [];
    const visited = new Set<string>();

    const remaining = [...nodes];
    while (remaining.length > 0) {
      const ready = remaining.filter((n) =>
        n.dependencies.every((dep) => visited.has(dep)),
      );
      if (ready.length === 0) break; // cycle or error
      levels.push(ready.map((n) => n.id));
      for (const n of ready) {
        visited.add(n.id);
        remaining.splice(remaining.indexOf(n), 1);
      }
    }

    return levels;
  }
}
