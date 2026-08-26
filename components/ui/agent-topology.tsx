"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { AgentStatus } from "@/lib/types";

export interface TopologyAgent {
  id: string;
  name: string;
  status: AgentStatus;
}

interface AgentTopologyProps {
  agents: TopologyAgent[];
}

const STATUS_COLOR: Record<AgentStatus, string> = {
  online: "#10b981",
  busy: "#f59e0b",
  error: "#ef4444",
  offline: "#94a3b8",
};

const STATUS_LABEL: Record<AgentStatus, string> = {
  online: "在线",
  busy: "忙碌",
  error: "异常",
  offline: "离线",
};

const HUB_COLOR = "#f59e0b";
const HUB_LABEL = "编排中枢";

/** 三.js 多智能体协同拓扑：星形 + 环形网格，节点色 = 状态，悬停高亮 */
export function AgentTopology({ agents }: AgentTopologyProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof window === "undefined") return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const W = container.clientWidth || 720;
    const H = container.clientHeight || 260;

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

    // —— 节点：中心枢纽 + 环形 Agent ——
    const hubGeo = new THREE.SphereGeometry(0.52, 32, 32);
    const hubMat = new THREE.MeshStandardMaterial({ color: HUB_COLOR, roughness: 0.28, metalness: 0.18 });
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.userData = { label: HUB_LABEL, color: HUB_COLOR, base: 0.52 };
    group.add(hub);

    const nodes: THREE.Mesh[] = [hub];
    const n = agents.length;
    const radius = Math.max(4.4, 5.6 - Math.max(0, n - 8) * 0.12);
    agents.forEach((agent, i) => {
      const ang = (i / Math.max(n, 1)) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(ang) * radius;
      const y = Math.sin(ang) * radius * 0.72;
      const z = Math.sin(ang * 2) * 0.9;
      const color = STATUS_COLOR[agent.status] ?? HUB_COLOR;
      const r = 0.3;
      const geo = new THREE.SphereGeometry(r, 28, 28);
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.12 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.userData = { label: agent.name, sub: STATUS_LABEL[agent.status], color, base: r };
      group.add(mesh);
      nodes.push(mesh);
    });

    // —— 连线：枢纽 → 每个 Agent，相邻 Agent 成环 ——
    const pts: THREE.Vector3[] = [];
    for (let i = 1; i < nodes.length; i++) {
      pts.push(hub.position, nodes[i].position);
      const next = i === nodes.length - 1 ? 1 : i + 1;
      pts.push(nodes[i].position, nodes[next].position);
    }
    const edgeGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.24 });
    group.add(new THREE.LineSegments(edgeGeo, edgeMat));

    // —— 交互 ——
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let hovered: THREE.Mesh | null = null;

    const onPointerMove = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    };
    renderer.domElement.addEventListener("pointermove", onPointerMove);

    const clock = new THREE.Clock();
    let raf = 0;
    let running = false;

    const dispose = () => {
      cancelAnimationFrame(raf);
      running = false;
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      if (ro) ro.disconnect();
      resizeObserver.disconnect();
      nodes.forEach((m) => {
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
      group.rotation.y += 0.0016;
      group.rotation.x = Math.sin(t * 0.15) * 0.08;

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
        tip.style.opacity = "1";
        tip.textContent = `${hovered.userData.label}${(hovered.userData.sub as string) ? " · " + (hovered.userData.sub as string) : ""}`;
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
  }, [agents]);

  // —— 状态图例（React 渲染） ——
  const counts = agents.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div ref={containerRef} className="relative h-[260px] w-full overflow-hidden rounded-2xl">
      <div
        ref={tipRef}
        className="pointer-events-none absolute left-0 top-0 z-10 -translate-x-1/2 -translate-y-[140%] whitespace-nowrap rounded-lg border border-border bg-card/95 px-2.5 py-1.5 text-xs font-medium opacity-0 transition-opacity duration-150"
      />
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex flex-wrap gap-1.5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/85 px-2.5 py-1 font-mono text-[10.5px] text-muted-foreground backdrop-blur">
          <i className="h-1.5 w-1.5 rounded-full" style={{ background: HUB_COLOR }} />
          {HUB_LABEL}
        </span>
        {Object.entries(counts).map(([status, count]) => (
          <span
            key={status}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/85 px-2.5 py-1 font-mono text-[10.5px] text-muted-foreground backdrop-blur"
          >
            <i className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLOR[status as AgentStatus] }} />
            {STATUS_LABEL[status as AgentStatus]} · {count}
          </span>
        ))}
      </div>
    </div>
  );
}
