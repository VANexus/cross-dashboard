"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { PageTransition } from "@/components/ui/page-transition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const AnimatedNumber = dynamic(() => import("@/components/ui/animated-number").then((m) => ({ default: m.AnimatedNumber })), { ssr: false });
const Sparkline = dynamic(() => import("@/components/ui/sparkline").then((m) => ({ default: m.Sparkline })), { ssr: false });
import {
  Boxes,
  Search,
  AlertTriangle,
  Package,
  Truck,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  RefreshCw,
  Calendar,
  BarChart3,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
} from "lucide-react";

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  stock: number;
  dailySales: number;
  ratioDays: number;
  stockoutDate: string;
  restockQty: number;
  restockDate: string;
  status: "normal" | "warning" | "caution" | "stale" | "overstock";
  trend: number[];
  avgCost: number;
  shipDays: number;
}

const inventoryItems: InventoryItem[] = [
  { id: "inv-1", sku: "PF-001-BK", name: "Smart Pet Fountain Pro — Black", stock: 1250, dailySales: 45, ratioDays: 28, stockoutDate: "2026-06-06", restockQty: 2000, restockDate: "2026-05-15", status: "normal", trend: [30, 32, 35, 38, 40, 42, 45, 48, 50, 52, 55, 58, 60, 62], avgCost: 12.5, shipDays: 30 },
  { id: "inv-2", sku: "PF-001-WH", name: "Smart Pet Fountain Pro — White", stock: 820, dailySales: 38, ratioDays: 22, stockoutDate: "2026-05-31", restockQty: 1500, restockDate: "2026-05-10", status: "warning", trend: [25, 28, 30, 32, 35, 38, 40, 42, 45, 40, 38, 36, 38, 40], avgCost: 12.5, shipDays: 30 },
  { id: "inv-3", sku: "PF-002-BK", name: "Mini Pet Fountain — Black", stock: 3200, dailySales: 25, ratioDays: 128, stockoutDate: "2026-10-14", restockQty: 0, restockDate: "-", status: "overstock", trend: [35, 30, 28, 25, 22, 20, 22, 25, 28, 25, 22, 20, 22, 25], avgCost: 8.2, shipDays: 30 },
  { id: "inv-4", sku: "FT-001", name: "UV Replacement Filter (3-Pack)", stock: 450, dailySales: 62, ratioDays: 7, stockoutDate: "2026-05-16", restockQty: 3000, restockDate: "2026-05-09", status: "warning", trend: [40, 42, 45, 48, 50, 52, 55, 58, 60, 58, 62, 65, 68, 70], avgCost: 3.2, shipDays: 25 },
  { id: "inv-5", sku: "WP-001", name: "Water Pump Replacement Kit", stock: 180, dailySales: 8, ratioDays: 23, stockoutDate: "2026-06-01", restockQty: 500, restockDate: "2026-05-20", status: "normal", trend: [10, 12, 10, 8, 12, 10, 8, 10, 12, 10, 8, 10, 12, 10], avgCost: 5.8, shipDays: 30 },
  { id: "inv-6", sku: "SB-001", name: "Smart Water Bowl — Standard", stock: 2100, dailySales: 5, ratioDays: 420, stockoutDate: "2027-07-04", restockQty: 0, restockDate: "-", status: "stale", trend: [15, 12, 10, 8, 6, 5, 5, 4, 5, 4, 3, 4, 5, 5], avgCost: 9.0, shipDays: 30 },
  { id: "inv-7", sku: "PF-003-BK", name: "Outdoor Pet Fountain — Black", stock: 680, dailySales: 22, ratioDays: 31, stockoutDate: "2026-06-09", restockQty: 1200, restockDate: "2026-05-18", status: "normal", trend: [18, 20, 22, 25, 28, 30, 32, 28, 25, 22, 20, 22, 25, 28], avgCost: 14.5, shipDays: 35 },
  { id: "inv-8", sku: "FT-002", name: "Carbon Filter (6-Pack)", stock: 5600, dailySales: 18, ratioDays: 311, stockoutDate: "2027-03-16", restockQty: 0, restockDate: "-", status: "overstock", trend: [20, 18, 16, 18, 15, 18, 16, 18, 20, 18, 16, 18, 20, 18], avgCost: 2.1, shipDays: 25 },
  { id: "inv-9", sku: "PF-001-GR", name: "Smart Pet Fountain Pro — Green", stock: 350, dailySales: 32, ratioDays: 11, stockoutDate: "2026-05-20", restockQty: 1800, restockDate: "2026-05-09", status: "warning", trend: [20, 22, 25, 28, 30, 32, 35, 38, 40, 42, 45, 48, 50, 52], avgCost: 12.5, shipDays: 30 },
  { id: "inv-10", sku: "CS-001", name: "Cleaning Sponge Set", stock: 2400, dailySales: 12, ratioDays: 200, stockoutDate: "2026-11-26", restockQty: 0, restockDate: "-", status: "stale", trend: [18, 15, 12, 10, 12, 10, 8, 10, 12, 10, 8, 10, 12, 12], avgCost: 1.5, shipDays: 20 },
  { id: "inv-11", sku: "PF-004-BK", name: "Catit-Style Fountain — Black", stock: 950, dailySales: 40, ratioDays: 24, stockoutDate: "2026-06-02", restockQty: 1500, restockDate: "2026-05-12", status: "normal", trend: [28, 30, 32, 35, 38, 40, 42, 45, 42, 40, 38, 40, 42, 45], avgCost: 11.0, shipDays: 28 },
  { id: "inv-12", sku: "AD-001", name: "Power Adapter USB-C", stock: 850, dailySales: 15, ratioDays: 57, stockoutDate: "2026-07-05", restockQty: 500, restockDate: "2026-06-10", status: "caution", trend: [12, 14, 15, 18, 20, 18, 15, 14, 15, 18, 20, 18, 15, 15], avgCost: 4.5, shipDays: 25 },
];

const statusMeta = {
  normal: { label: "正常", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", dot: "bg-emerald-500" },
  warning: { label: "预警", color: "bg-amber-500/10 text-amber-400 border-amber-500/20", dot: "bg-amber-500" },
  caution: { label: "注意", color: "bg-orange-500/10 text-orange-400 border-orange-500/20", dot: "bg-orange-500" },
  stale: { label: "滞销", color: "bg-red-500/10 text-red-400 border-red-500/20", dot: "bg-red-500" },
  overstock: { label: "冗余", color: "bg-purple-500/10 text-purple-400 border-purple-500/20", dot: "bg-purple-500" },
};

function ratioColor(days: number) {
  if (days >= 60) return "text-red-400";
  if (days >= 45) return "text-orange-400";
  if (days >= 30) return "text-amber-400";
  return "text-emerald-400";
}

function ratioBarColor(days: number) {
  if (days >= 60) return "bg-red-500";
  if (days >= 45) return "bg-orange-500";
  if (days >= 30) return "bg-amber-500";
  return "bg-emerald-500";
}

export default function InventoryPage() {
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const normalCount = inventoryItems.filter((i) => i.status === "normal").length;
  const warningCount = inventoryItems.filter((i) => i.status === "warning").length;
  const staleCount = inventoryItems.filter((i) => i.status === "stale").length;
  const overstockCount = inventoryItems.filter((i) => i.status === "overstock").length;

  const filteredItems = inventoryItems.filter((item) => {
    if (filterStatus !== "all" && item.status !== filterStatus) return false;
    if (searchTerm && !item.name.toLowerCase().includes(searchTerm.toLowerCase()) && !item.sku.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const selectedItem = selectedSku ? inventoryItems.find((i) => i.id === selectedSku) : null;

  return (
    <PageTransition className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--wf-inventory)]/20 to-[var(--wf-inventory)]/5">
          <Boxes className="h-5 w-5 text-[var(--wf-inventory)]" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">库销比管理</h1>
          <p className="text-xs text-muted-foreground">解决库存管理精准度问题 — AI预测补货 + 滞销预警 + 冗余处理</p>
        </div>
      </div>

      {(staleCount > 0 || overstockCount > 0) && (
        <div className="flex items-center gap-4 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
          <p className="text-xs">
            <span className="text-red-400 font-medium">⚠️ {staleCount} 个 SKU 滞销</span>
            <span className="text-muted-foreground mx-2">|</span>
            <span className="text-orange-400 font-medium">{overstockCount} 个 SKU 冗余</span>
            <span className="text-muted-foreground ml-2">— 建议及时处理，避免长期仓储费及资金占用</span>
          </p>
        </div>
      )}

      <div className="grid gap-3 grid-cols-5">
        {[
          { label: "总 SKU", value: inventoryItems.length, icon: Package, color: "text-foreground" },
          { label: "正常", value: normalCount, icon: CheckCircle2, color: "text-emerald-400" },
          { label: "预警", value: warningCount, icon: AlertTriangle, color: "text-amber-400" },
          { label: "滞销", value: staleCount, icon: XCircle, color: "text-red-400" },
          { label: "冗余", value: overstockCount, icon: Clock, color: "text-orange-400" },
        ].map((stat) => (
          <Card key={stat.label} className="workflow-card cursor-pointer hover:bg-muted/30" onClick={() => setFilterStatus(stat.label === "总 SKU" ? "all" : stat.label === "正常" ? "normal" : stat.label === "预警" ? "warning" : stat.label === "滞销" ? "stale" : "overstock")}>
            <CardContent className="p-3 text-center">
              <stat.icon className={cn("h-4 w-4 mx-auto mb-1", stat.color)} />
              <p className={cn("text-lg font-bold metric-value", stat.color)}>
                <AnimatedNumber value={stat.value} />
              </p>
              <p className="text-[10px] text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="搜索 SKU 或产品名..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 h-9" />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="flex h-9 rounded-md border bg-transparent px-3 py-1 text-xs shadow-sm">
          <option value="all">全部状态</option>
          <option value="normal">正常</option>
          <option value="warning">预警</option>
          <option value="caution">注意</option>
          <option value="stale">滞销</option>
          <option value="overstock">冗余</option>
        </select>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">SKU</th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">产品名</th>
                    <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">库存</th>
                    <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">日销</th>
                    <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">库销比</th>
                    <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">预计断货</th>
                    <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">建议补货量</th>
                    <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">建议补货日</th>
                    <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">状态</th>
                    <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">趋势</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems
                    .sort((a, b) => a.ratioDays - b.ratioDays)
                    .map((item) => {
                      const meta = statusMeta[item.status];
                      return (
                        <tr
                          key={item.id}
                          className={cn("border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors", selectedSku === item.id && "bg-muted/50")}
                          onClick={() => setSelectedSku(selectedSku === item.id ? null : item.id)}
                        >
                          <td className="px-3 py-2 font-mono text-[11px]">{item.sku}</td>
                          <td className="px-3 py-2 max-w-[180px] truncate">{item.name}</td>
                          <td className="px-3 py-2 text-right">{item.stock.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right">{item.dailySales}</td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div className={cn("h-full rounded-full", ratioBarColor(item.ratioDays))} style={{ width: `${Math.min(item.ratioDays / 90 * 100, 100)}%` }} />
                              </div>
                              <span className={cn("font-bold", ratioColor(item.ratioDays))}>{item.ratioDays}天</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right text-muted-foreground">{item.stockoutDate}</td>
                          <td className="px-3 py-2 text-right">
                            {item.restockQty > 0 ? (
                              <span className="font-medium">{item.restockQty.toLocaleString()}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {item.restockDate !== "-" ? (
                              <span className="text-[var(--wf-inventory)] font-medium">{item.restockDate}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Badge className={cn("text-[9px] px-1.5 py-0", meta.color)}>{meta.label}</Badge>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Sparkline data={item.trend} width={50} height={16} color={item.status === "stale" || item.status === "overstock" ? "#ef4444" : item.status === "warning" ? "#f59e0b" : "#22c55e"} />
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {selectedItem ? (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">SKU 详情</CardTitle>
                    <Badge className={cn("text-[10px]", statusMeta[selectedItem.status].color)}>{statusMeta[selectedItem.status].label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-medium">{selectedItem.name}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{selectedItem.sku}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md bg-muted/30 p-2 text-center">
                      <p className="text-sm font-bold metric-value">{selectedItem.stock.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">库存</p>
                    </div>
                    <div className="rounded-md bg-muted/30 p-2 text-center">
                      <p className="text-sm font-bold metric-value">{selectedItem.dailySales}</p>
                      <p className="text-[10px] text-muted-foreground">日销</p>
                    </div>
                    <div className="rounded-md bg-muted/30 p-2 text-center">
                      <p className={cn("text-sm font-bold metric-value", ratioColor(selectedItem.ratioDays))}>{selectedItem.ratioDays}天</p>
                      <p className="text-[10px] text-muted-foreground">库销比</p>
                    </div>
                    <div className="rounded-md bg-muted/30 p-2 text-center">
                      <p className="text-sm font-bold metric-value">${selectedItem.avgCost}</p>
                      <p className="text-[10px] text-muted-foreground">平均成本</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-[var(--wf-inventory)]" /> 销量趋势 (近14天)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Sparkline data={selectedItem.trend} width={280} height={50} color="var(--wf-inventory)" />
                  <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
                    <span>14天前: {selectedItem.trend[0]}</span>
                    <span>今日: {selectedItem.trend[selectedItem.trend.length - 1]}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-2 border-l-[var(--wf-inventory)]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs flex items-center gap-2">
                    <Truck className="h-4 w-4 text-[var(--wf-inventory)]" /> AI 补货建议
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {selectedItem.restockQty > 0 ? (
                    <>
                      <p className="text-sm font-medium">
                        建议在 <span className="text-[var(--wf-inventory)]">{selectedItem.restockDate}</span> 补货{" "}
                        <span className="text-[var(--wf-inventory)] metric-value">{selectedItem.restockQty.toLocaleString()}</span> 件
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        计算逻辑: 日均销量 {selectedItem.dailySales} 件 × 运输周期 {selectedItem.shipDays} 天 + 安全库存 15 天
                      </p>
                      <Button size="sm" className="w-full h-7 text-xs bg-[var(--wf-inventory)] hover:bg-[var(--wf-inventory)]/90 gap-1">
                        <Truck className="h-3 w-3" /> 生成补货订单
                      </Button>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">暂无补货需求</p>
                  )}
                </CardContent>
              </Card>

              {selectedItem.status === "stale" && (
                <Card className="border-l-2 border-l-red-500">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-medium text-red-400">滞销告警</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">库存可售 {selectedItem.ratioDays} 天（≥60天阈值），建议促销清库或转让库存</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {selectedItem.status === "overstock" && (
                <Card className="border-l-2 border-l-orange-500">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-medium text-orange-400">冗余库存告警</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">库存可售 {selectedItem.ratioDays} 天（≥60天阈值），占用资金约 ${(selectedItem.stock * selectedItem.avgCost).toLocaleString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Boxes className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-xs text-muted-foreground">点击表格行查看详情</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
