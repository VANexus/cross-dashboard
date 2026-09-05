/**
 * 生图画布服务（T4 v1）— ComfyUI 式「项目 × 版本 × 分支」流水线
 *
 * 数据模型：wf_image_projects，每行 = 一次生成的「版本节点」：
 * - root_id：所属项目（根节点即项目本体）；
 * - parent_id：来源版本（NULL = 根）；分支 = 在旧版本上再生成一条新线；
 * - branch_tag：分支名（主线 /root、分支 B1/B2…），UI 树状展示用；
 * - status：draft（已登记未出图）→ done（已出图）。
 *
 * 诚实纪律：分支出图仍是「以父版本 prompt 为底重新生成变体」，是否支持图生图
 * 由生成后端决定（阶段 1 = 继承 prompt 再生成；图生图/局部重绘在后续迭代接入）。
 */
import { randomUUID } from "crypto";
import { prisma } from "../db";
import { parseJsonField } from "../repositories/base";

export interface ImageCanvasNode {
  id: string;
  title: string;
  rootId: string;
  parentId: string | null;
  branchTag: string;
  depth: number;
  status: string;
  prompt: string;
  negative: string;
  params: Record<string, unknown>;
  imageUrl: string;
  thumbnail: string;
  createdAt: string;
  updatedAt: string;
}

function rowToNode(row: {
  id: string; title: string; root_id: string; parent_id: string | null; branch_tag: string;
  depth: number; status: string; prompt: string; negative: string; params: string;
  image_url: string; thumbnail: string; created_at: string; updated_at: string;
}): ImageCanvasNode {
  return {
    id: row.id,
    title: row.title,
    rootId: row.root_id,
    parentId: row.parent_id,
    branchTag: row.branch_tag,
    depth: row.depth,
    status: row.status,
    prompt: row.prompt,
    negative: row.negative,
    params: parseJsonField(row.params, {}),
    imageUrl: row.image_url,
    thumbnail: row.thumbnail,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ImageCanvasService {
  /** 某项目（root）的全部版本节点（主线+分支，按创建时间升序）。 */
  async listByRoot(rootId: string): Promise<ImageCanvasNode[]> {
    const rows = await prisma.wf_image_projects.findMany({
      where: { root_id: rootId },
      orderBy: { created_at: "asc" },
    });
    return rows.map((r) => rowToNode(r as never));
  }

  /** 最近项目列表（每个 root 一条，按更新时间倒序）。 */
  async listProjects(limit = 30): Promise<Array<{ id: string; title: string; createdAt: string; updatedAt: string; count: number }>> {
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT root_id AS id,
              (array_agg(title ORDER BY created_at ASC))[1] AS title,
              min(created_at) AS "createdAt",
              max(updated_at) AS "updatedAt",
              count(*)::int AS count
       FROM wf_image_projects
       GROUP BY root_id
       ORDER BY max(updated_at) DESC
       LIMIT $1`,
      limit,
    );
    return rows.map((r) => ({
      id: String(r.id),
      title: String(r.title ?? ""),
      createdAt: String(r.createdAt ?? ""),
      updatedAt: String(r.updatedAt ?? ""),
      count: Number(r.count ?? 0),
    }));
  }

  /** 创建根节点（新项目）；也可在未落根时直接建。 */
  async createRoot(input: { title?: string; prompt: string; negative?: string; params?: Record<string, unknown> }): Promise<ImageCanvasNode> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const prompt = (input.prompt ?? "").trim();
    if (!prompt) throw new Error("提示词不能为空");
    await prisma.wf_image_projects.create({
      data: {
        id,
        title: (input.title ?? prompt.slice(0, 32)).trim() || "未命名项目",
        root_id: id,
        parent_id: null,
        branch_tag: "root",
        depth: 0,
        status: "draft",
        prompt,
        negative: input.negative ?? "",
        params: JSON.stringify(input.params ?? {}),
        created_at: now,
        updated_at: now,
      },
    });
    return this.getNode(id);
  }

  /** 分支：基于父版本开新线（继承其 prompt 与参数，可改）。 */
  async createChild(parentId: string, input: { prompt?: string; title?: string; params?: Record<string, unknown> }): Promise<ImageCanvasNode> {
    const parent = await this.getNode(parentId);
    if (!parent) throw new Error(`父版本不存在：${parentId}`);
    const id = randomUUID();
    const now = new Date().toISOString();
    // 分支序号：同 root 下 branch_tag 形如 B1/B2…
    const siblings = await prisma.wf_image_projects.count({ where: { root_id: parent.rootId, parent_id: parentId } });
    const branchTag = `B${siblings + 1}`;
    const mergedPrompt = (input.prompt ?? parent.prompt).trim();
    if (!mergedPrompt) throw new Error("提示词不能为空（分支默认继承父版本）");
    await prisma.wf_image_projects.create({
      data: {
        id,
        title: input.title?.trim() || (branchTag === "B1" ? `${parent.title} · ${branchTag}` : `${branchTag}`),
        root_id: parent.rootId,
        parent_id: parentId,
        branch_tag: branchTag,
        depth: parent.depth + 1,
        status: "draft",
        prompt: mergedPrompt,
        negative: parent.negative,
        params: JSON.stringify(input.params ?? parent.params),
        created_at: now,
        updated_at: now,
      },
    });
    return this.getNode(id);
  }

  async getNode(id: string): Promise<ImageCanvasNode | null> {
    const row = await prisma.wf_image_projects.findUnique({ where: { id } }).catch(() => null);
    return row ? rowToNode(row as never) : null;
  }

  /** 出图后回填 image/imgUrl 或用 户改名/改 prompt。 */
  async updateNode(id: string, patch: Partial<Pick<ImageCanvasNode, "title" | "prompt" | "negative" | "status" | "imageUrl" | "thumbnail" | "params">>): Promise<ImageCanvasNode | null> {
    const data: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.title !== undefined) data.title = patch.title;
    if (patch.prompt !== undefined) data.prompt = patch.prompt;
    if (patch.negative !== undefined) data.negative = patch.negative;
    if (patch.status !== undefined) data.status = patch.status;
    if (patch.imageUrl !== undefined) data.image_url = patch.imageUrl;
    if (patch.thumbnail !== undefined) data.thumbnail = patch.thumbnail;
    if (patch.params !== undefined) data.params = JSON.stringify(patch.params);
    await prisma.wf_image_projects.update({ where: { id }, data }).catch(() => null);
    return this.getNode(id);
  }

  async removeNode(id: string): Promise<boolean> {
    // 仅允许删除叶子（无子节点），保护分支线
    const children = await prisma.wf_image_projects.count({ where: { parent_id: id } });
    if (children > 0) throw new Error("该版本存在子版本（分支/续作），请先删除子树");
    await prisma.wf_image_projects.delete({ where: { id } }).catch(() => null);
    return true;
  }
}