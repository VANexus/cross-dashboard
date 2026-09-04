"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { AgentStatus } from "@/lib/shared/types";

export interface TopologyAgent {
  id: string;
  name: string;
  status: AgentStatus;
  type?: string;
}

interface AgentTopologyProps {
  agents: TopologyAgent[];
  /** agentId → 所属团队名列表（协同拓扑按团队分组展示） */
  teamMap?: Record<string, string[]>;
}

const STATUS_COLOR: Record<AgentStatus, string> = {
  online: "var(--success)",
  busy: "var(--warning)",
  error: "var(--destructive)",
  offline: "var(--muted-foreground)",
};

const STATUS_LABEL: Record<AgentStatus, string> = {
  online: "在线",
  busy: "忙碌",
  error: "异常",
  offline: "离线",
};

const HUB_COLOR = "var(--warning)";
const HUB_LABEL = "主 Agent";
const HUB_SUB = "Web 对话内核";

const TEAM_PALETTE = [
  "#f43f5e",
  "#8b5cf6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#3b82f6",
  "#ec4899",
  "#84cc16",
];

/** 团队色：按团队名哈希到稳定调色板 */
export function teamHue(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return TEAM_PALETTE[h % TEAM_PALETTE.length];
}

/** 解析 CSS 变量为 THREE 可用的 hex（无 DOM / 解析失败时回退）；THREE.Color 不认 var(--x) */
function resolveColor(v: string, fallback: string): string {
  if (!v.startsWith("var(")) return v;
  try {
    const name = v.slice(4, -1).trim();
    const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return val || fallback;
  } catch {
    return fallback;
  }
}

/** 三.js 多智能体协同拓扑：星形 + 环形网格，节点色 = 状态，环色 = 团队，拖拽旋转 + 悬停高亮 */
export function AgentTopology({ agents, teamMap }: AgentTopologyProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof window === "undefined") return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const W = container.clientWidth || 720;
    const H = container.clientHeight || 280;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 100);
    camera.position.set(0, 0.4, 14);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H);
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const key = new THREE.PointLight(0xf59e0b, 1.4, 60);
    key.position.set(5, 7, 9);
    scene.add(key);
    const fill = new THREE.PointLight(0x60a5fa, 0.8, 60);
    fill.position.set(-6, -4, 6);
    scene.add(fill);

    const group = new THREE.Group();
    scene.add(group);

    // —— 节点：中心主 Agent + 环形 Agent（环色 = 团队，无团队则用状态色） ——
    const hubColorHex = resolveColor(HUB_COLOR, "#f59e0b");
    const hubGeo = new THREE.SphereGeometry(0.56, 32, 32);
    const hubMat = new THREE.MeshStandardMaterial({ color: hubColorHex, roughness: 0.28, metalness: 0.18 });
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.userData = { label: HUB_LABEL, sub: HUB_SUB, color: hubColorHex, base: 0.56 };
    group.add(hub);

    // 主 Agent 外圈光环
    const hubRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.78, 0.035, 12, 48),
      new THREE.MeshStandardMaterial({ color: hubColorHex, transparent: true, opacity: 0.5, roughness: 0.3 }),
    );
    hubRing.rotation.x = Math.PI / 2;
    group.add(hubRing);

    const nodes: THREE.Mesh[] = [hub];
    const rings: THREE.Mesh[] = [hubRing];
    const n = agents.length;
    const radius = Math.max(4.6, 6.0 - Math.max(0, n - 8) * 0.14);
    agents.forEach((agent, i) => {
      const ang = (i / Math.max(n, 1)) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(ang) * radius;
      const y = Math.sin(ang) * radius * 0.72;
      const z = Math.sin(ang * 2) * 0.9;
      const color = resolveColor(STATUS_COLOR[agent.status] ?? HUB_COLOR, "#22c55e");
      const teams = teamMap?.[agent.id] ?? [];
      const teamColor = teams.length > 0 ? teamHue(teams[0]) : null;
      const r = 0.3;
      const geo = new THREE.SphereGeometry(r, 28, 28);
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.12 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.userData = {
        label: agent.name,
        sub: STATUS_LABEL[agent.status],
        color,
        base: r,
        teams,
        type: agent.type ?? "",
      };
      group.add(mesh);
      nodes.push(mesh);

      // 团队环：属于团队则套上对应色环
      if (teamColor) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(r + 0.14, 0.02, 8, 40),
          new THREE.MeshStandardMaterial({ color: teamColor, transparent: true, opacity: 0.85, roughness: 0.3 }),
        );
        ring.position.set(x, y, z);
        ring.rotation.x = Math.PI / 2;
        group.add(ring);
        rings.push(ring);
      }
    });

    // —— 连线：主 Agent → 每个 Agent；同团队 Agent 之间加高亮连线 ——
    const linePts: THREE.Vector3[] = [];
    const teamLinePts: THREE.Vector3[] = [];
    const teamPairs = new Set<string>();
    for (let i = 1; i < nodes.length; i++) {
      linePts.push(hub.position, nodes[i].position);
      for (let j = i + 1; j < nodes.length; j++) {
        const ai = agents[i - 1];
        const aj = agents[j - 1];
        const ti = teamMap?.[ai.id] ?? [];
        const tj = teamMap?.[aj.id] ?? [];
        const shared = ti.find((t) => tj.includes(t));
        if (shared) {
          const pairKey = `${ai.id}::${aj.id}`;
          if (!teamPairs.has(pairKey)) {
            teamPairs.add(pairKey);
            teamLinePts.push(nodes[i].position, nodes[j].position);
          }
        }
      }
    }
    const edgeGeo = new THREE.BufferGeometry().setFromPoints(linePts);
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.22 });
    group.add(new THREE.LineSegments(edgeGeo, edgeMat));

    if (teamLinePts.length > 0) {
      const teamEdgeGeo = new THREE.BufferGeometry().setFromPoints(teamLinePts);
      const teamEdgeMat = new THREE.LineBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.4 });
      group.add(new THREE.LineSegments(teamEdgeGeo, teamEdgeMat));
    }

    // —— 交互：悬停高亮 + 拖拽旋转 ——
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let hovered: THREE.Mesh | null = null;
    let dragging = false;
    let lastPointerX = 0;
    let autoRotate = true;

    const setMouse = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerDown = (ev: PointerEvent) => {
      dragging = true;
      autoRotate = false;
      lastPointerX = ev.clientX;
      renderer.domElement.setPointerCapture(ev.pointerId);
    };
    const onPointerMove = (ev: PointerEvent) => {
      setMouse(ev);
      if (!dragging) return;
      const dx = ev.clientX - lastPointerX;
      lastPointerX = ev.clientX;
      group.rotation.y += dx * 0.006;
    };
    const onPointerUp = () => {
      dragging = false;
      autoRotate = true;
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    const clock = new THREE.Clock();
    let raf = 0;
    let running = false;

    const dispose = () => {
      cancelAnimationFrame(raf);
      running = false;
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      if (ro) ro.disconnect();
      resizeObserver.disconnect();
      nodes.forEach((m) => {
        m.geometry.dispose();
        m.material.dispose();
      });
      rings.forEach((m) => {
        m.geometry.dispose();
        m.material.dispose();
      });
      edgeGeo.dispose();
      edgeMat.dispose();
      hubGeo.dispose();
      hubMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };

    const animate = () => {
      if (!running) return;
      raf = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      if (autoRotate) group.rotation.y += 0.0016;
      group.rotation.x = Math.sin(t * 0.15) * 0.06;

      nodes.forEach((m) => {
        if (m === hovered) {
          m.scale.setScalar((m.userData.base as number) * 1.6);
          return;
        }
        if (reduced) return;
        const base = m.userData.base as number;
        m.scale.setScalar(base * (1 + Math.sin(t * 2 + m.position.x) * 0.12));
      });

      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(nodes);
      const hit = hits.length ? (hits[0].object as THREE.Mesh) : null;
      if (hit !== hovered) {
        if (hovered) {
          hovered.material.emissive.set("#000000");
          hovered.material.emissiveIntensity = 1;
        }
        hovered = hit;
        if (hovered) {
          hovered.material.emissive.set(hovered.userData.color as string);
          hovered.material.emissiveIntensity = 0.55;
        }
      }

      const tip = tipRef.current;
      if (hovered && tip) {
        const ud = hovered.userData as { label: string; sub?: string; teams?: string[] };
        const teamText = ud.teams && ud.teams.length > 0 ? ` · ${ud.teams.join("、")}` : "";
        tip.style.opacity = "1";
        tip.textContent = `${ud.label}${ud.sub ? " · " + ud.sub : ""}${teamText}`;
        const v = hovered.position.clone().applyMatrix4(group.matrixWorld).project(camera);
        tip.style.left = `${((v.x * 0.5 + 0.5) * renderer.domElement.clientWidth).toFixed(1)}px`;
        tip.style.top = `${((-v.y * 0.5 + 0.5) * renderer.domElement.clientHeight).toFixed(1)}px`;
      } else if (tip) {
        tip.style.opacity = "0";
      }

      renderer.render(scene, camera);
    };

    const start = () => {
      if (reduced || running) return;
      running = true;
      animate();
    };

    // 视口内才渲染，离屏省资源
    const ro = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => (e.isIntersecting ? start() : (running = false)));
      },
      { threshold: 0.05 }
    );
    ro.observe(container);

    // 容器尺寸变化（侧栏折叠 / 窗口缩放）时同步画布
    const resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      if (reduced) renderer.render(scene, camera);
    });
    resizeObserver.observe(container);

    if (reduced) {
      running = true;
      renderer.render(scene, camera);
    } else {
      start();
    }

    return dispose;
  }, [agents, teamMap]);

  // —— 状态图例 + 团队图例（React 渲染） ——
  const counts = agents.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {});
  const teamNames = collectTeamNames(teamMap);

  return (
    <div ref={containerRef} className="relative h-full min-h-[140px] w-full overflow-hidden rounded-2xl">
      <div
        ref={tipRef}
        className="pointer-events-none absolute left-0 top-0 z-10 -translate-x-1/2 -translate-y-[140%] whitespace-nowrap rounded-lg border border-border bg-card/95 px-2.5 py-1.5 text-xs font-medium opacity-0 transition-opacity duration-150"
      />
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex max-w-[90%] flex-wrap gap-1.5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/85 px-2.5 py-1 font-mono text-caption text-muted-foreground backdrop-blur">
          <i className="h-1.5 w-1.5 rounded-full" style={{ background: HUB_COLOR }} />
          {HUB_LABEL} · {HUB_SUB}
        </span>
        {Object.entries(counts).map(([status, count]) => (
          <span
            key={status}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/85 px-2.5 py-1 font-mono text-caption text-muted-foreground backdrop-blur"
          >
            <i className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLOR[status as AgentStatus] }} />
            {STATUS_LABEL[status as AgentStatus]} · {count}
          </span>
        ))}
        {teamNames.map((name) => (
          <span
            key={name}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/85 px-2.5 py-1 font-mono text-caption text-muted-foreground backdrop-blur"
          >
            <i className="h-1.5 w-1.5 rounded-full" style={{ background: teamHue(name) }} />
            团队·{name}
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-full border border-border bg-card/85 px-2.5 py-1 font-mono text-caption text-muted-foreground backdrop-blur">
        拖拽旋转 · 悬停查看
      </div>
    </div>
  );
}

function collectTeamNames(teamMap?: Record<string, string[]>): string[] {
  const names = new Set<string>();
  if (teamMap) {
    for (const teams of Object.values(teamMap)) teams.forEach((t) => names.add(t));
  }
  return Array.from(names);
}
