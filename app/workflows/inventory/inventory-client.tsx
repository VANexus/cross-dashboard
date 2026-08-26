"use client";

import { useState, useEffect, startTransition } from "react";
import { useRouter } from "next/navigation";
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
  Package,
  Search,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  RefreshCw,
  Truck,
  Send,
  BarChart3,
  Calendar,
  X,
  ArrowRight,
} from "lucide-react";

const statusMeta = {
  normal: { label: "正常", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  warning: { label: "补货中", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  caution: { label: "预警", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
  stale: { label: "滞销", color: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/20" },
  overstock: { label: "滞销", color: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/20" },
};

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  stock: number;
  dailySales: number;
  ratioDays: number;
  stockoutDate: string;
  restockQty: number;
  restockDate: string | null;
  status: "normal" | "warning" | "caution" | "stale" | "overstock";
  trend: number[];
  avgCost: number;
  shipDays: number;
}

interface RestockSuggestion {
  id: string;
  sku: string;
  name: string;
  suggestedQty: number;
  urgency: "high" | "medium" | "low";
  method: string;
  eta: string;
  cost: number;
}

interface RestockOrder {
  id: string;
  items: Array<{ sku: string; quantity: number; shipMethod: string }>;
  status: string;
  totalItems: number;
  createdAt: string;
}

export interface InventoryClientProps {
  inventoryItems: InventoryItem[];
  restockSuggestions: RestockSuggestion[];
  recentOrders?: RestockOrder[];
}

function urgencyColor(u: string) {
  if (u === "high") return "text-red-400";
  if (u === "medium") return "text-amber-400";
  return "text-emerald-400";
}

export function InventoryClient({ inventoryItems, restockSuggestions, recentOrders = [] }: InventoryClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [orderResult, setOrderResult] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    startTransition(() => {
      setOrderResult("");
    });
  }, [selectedItem]);

  const handleCreateOrder = async () => {
    if (!selectedItem) return;
    setCreatingOrder(true);
    setOrderResult("");
    try {
      const res = await fetch("/api/workflows/inventory/restock-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{
            sku: selectedItem.sku,
            quantity: selectedItem.restockQty,
            shipMethod: selectedItem.shipDays <= 25 ? "express" : "sea",
          }],
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setOrderResult(data.error || "创建补货单失败");
      } else {
        setOrderResult(`补货单已创建: ${data.data?.orderId ?? data.data?.id ?? "成功"}`);
        router.refresh();
      }
    } catch (_err) {
      setOrderResult("网络错误，请稍后重试");
    } finally {
      setCreatingOrder(false);
    }
  };

  const filteredItems = inventoryItems.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) || item.sku.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (statusFilter === "all") return true;
    if (statusFilter === "预警") return item.status === "caution" || item.status === "warning";
    if (statusFilter === "正常") return item.status === "normal";
    if (statusFilter === "滞销") return item.status === "stale" || item.status === "overstock";
    return true;
  });

  const warningCount = inventoryItems.filter((i) => i.status === "warning" || i.status === "caution").length;
  const totalStock = inventoryItems.reduce((a, b) => a + b.stock, 0);
  const avgRatio = Math.round(inventoryItems.reduce((a, b) => a + b.ratioDays, 0) / inventoryItems.length);

  return (
    <PageTransition className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--wf-inventory)]/20 to-[var(--wf-inventory)]/5">
          <Package className="h-5 w-5 text-[var(--wf-inventory)]" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">库存规划</h1>
          <p className="text-xs text-muted-foreground">解决断货/滞销问题 — 智能预警 + 补货建议 + 库龄分析</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="搜索 SKU 或产品名称..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <div className="flex gap-2">
          {(["全部", "预警", "正常", "滞销"] as const).map((f) => (
            <Badge
              key={f}
              variant="outline"
              className={cn(
                "cursor-pointer text-xs transition-colors",
                statusFilter === f
                  ? "bg-primary/15 text-primary border-primary/40"
                  : "hover:bg-primary/10 hover:text-primary hover:border-primary/30"
              )}
              onClick={() => setStatusFilter(f)}
            >
              {f}
            </Badge>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setStatusFilter("滞销")}>
            <BarChart3 className="h-3.5 w-3.5" /> 库龄报告
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setStatusFilter("预警")}>
            <Calendar className="h-3.5 w-3.5" /> 断货预测
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                      <th className="text-left px-4 py-2.5 font-medium">产品</th>
                      <th className="text-right px-4 py-2.5 font-medium">库存</th>
                      <th className="text-right px-4 py-2.5 font-medium">日销</th>
                      <th className="text-right px-4 py-2.5 font-medium">可售天数</th>
                      <th className="text-right px-4 py-2.5 font-medium">断货日</th>
                      <th className="text-right px-4 py-2.5 font-medium">建议补货</th>
                      <th className="text-center px-4 py-2.5 font-medium">趋势</th>
                      <th className="text-center px-4 py-2.5 font-medium">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => {
                      const meta = statusMeta[item.status];
                      return (
                        <tr
                          key={item.id}
                          className={cn("border-b hover:bg-muted/50 cursor-pointer transition-colors", selectedItem?.id === item.id && "bg-muted/50")}
                          onClick={() => setSelectedItem(selectedItem?.id === item.id ? null : item)}
                        >
                          <td className="px-4 py-2.5">
                            <div>
                              <span className="font-medium">{item.name}</span>
                              <p className="text-[10px] text-muted-foreground">SKU: {item.sku}</p>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right metric-value">{item.stock.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right metric-value">{item.dailySales}</td>
                          <td className={cn("px-4 py-2.5 text-right font-medium", item.ratioDays < 14 ? "text-red-400" : item.ratioDays < 21 ? "text-amber-400" : "text-emerald-400")}>
                            {item.ratioDays}天
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">{item.stockoutDate}</td>
                          <td className="px-4 py-2.5 text-right metric-value">{item.restockQty.toLocaleString()}</td>
                          <td className="px-4 py-2.5">
                            <Sparkline quiet data={item.trend} width={60} height={18} color={item.trend[item.trend.length - 1] < item.trend[0] ? "var(--destructive)" : "var(--success)"} />
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <Badge variant="outline" className={cn("text-[10px]", meta.color, meta.bg, meta.border)}>
                              {meta.label}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {selectedItem && (() => {
            const meta = statusMeta[selectedItem.status];
            const daysToOut = selectedItem.ratioDays;
            const shipDays = selectedItem.shipDays;
            const latestTrend = selectedItem.trend[selectedItem.trend.length - 1];
            const prevTrend = selectedItem.trend[selectedItem.trend.length - 2];
            const trendDirection = latestTrend > prevTrend ? "up" : latestTrend < prevTrend ? "down" : "flat";

            return (
              <Card className="border-l-2 border-l-[var(--wf-inventory)]">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{selectedItem.name}</h3>
                      <Badge variant="outline" className={cn("text-[10px]", meta.color, meta.bg, meta.border)}>{meta.label}</Badge>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedItem(null)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Package className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">当前库存</span>
                      </div>
                      <AnimatedNumber value={selectedItem.stock} className="text-lg font-bold" />
                      <p className="text-[10px] text-muted-foreground">可售 {selectedItem.ratioDays} 天</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-1.5 mb-1">
                        <TrendingDown className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">日均销量</span>
                      </div>
                      <AnimatedNumber value={selectedItem.dailySales} className="text-lg font-bold" />
                      <p className={cn("text-[10px]", trendDirection === "up" ? "text-emerald-400" : "text-red-400")}>
                        {trendDirection === "up" ? "↑" : "↓"} {Math.abs(latestTrend - prevTrend)} 件/天
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">平均成本</span>
                      <span className="font-medium">${selectedItem.avgCost}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">运输天数</span>
                      <span className="font-medium">{selectedItem.shipDays} 天</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">建议补货</span>
                      <span className="font-medium text-primary">{selectedItem.restockQty.toLocaleString()} 件</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border border-dashed bg-muted/20">
                    <div className="flex items-center gap-2 mb-1">
                      {daysToOut < shipDays ? (
                        <AlertTriangle className="h-4 w-4 text-red-400" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      )}
                      <span className={cn("text-sm font-medium", daysToOut < shipDays ? "text-red-400" : "text-emerald-400")}>
                        {daysToOut < shipDays ? "紧急: 建议空运" : "正常: 海运可行"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {daysToOut < shipDays
                        ? `断货风险高，建议 ${selectedItem.restockQty.toLocaleString()} 件补货订单，运输 ${shipDays} 天`
                        : `库存充足，可在 ${selectedItem.restockDate ?? "合适时间"} 安排 ${selectedItem.restockQty.toLocaleString()} 件补货`
                      }
                    </p>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      className="gap-1.5 h-8 text-xs bg-[var(--wf-inventory)] hover:bg-[var(--wf-inventory)]/90"
                      onClick={handleCreateOrder}
                      disabled={creatingOrder}
                    >
                      {creatingOrder ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Truck className="h-3.5 w-3.5" />
                      )}
                      {creatingOrder ? "创建中..." : "创建补货单"}
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={handleCreateOrder} disabled={creatingOrder}>
                      <ArrowRight className="h-3.5 w-3.5" /> 发送到采购
                    </Button>
                  </div>
                  {orderResult && (
                    <p className={cn("mt-2 text-xs", orderResult.includes("已创建") ? "text-emerald-400" : "text-red-400")}>
                      {orderResult}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })()}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">库存概览</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">总库存</span>
                <AnimatedNumber value={totalStock} className="font-medium" />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">预警商品</span>
                <span className="font-medium text-amber-400">{warningCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">平均可售天数</span>
                <span className="font-medium">{avgRatio} 天</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">补货建议</CardTitle>
                <Button variant="outline" size="sm" className="h-6 gap-1 text-[10px]" onClick={async () => {
                  if (restockSuggestions.length === 0) return;
                  try {
                    const res = await fetch("/api/workflows/inventory/restock-order", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        items: restockSuggestions.map((s) => ({
                          sku: s.sku, quantity: s.suggestedQty, shipMethod: s.method,
                        })),
                      }),
                    });
                    const data = await res.json();
                    if (data.success) {
                      alert(`已创建补货单: ${data.data?.orderId ?? "成功"}`);
                      router.refresh();
                    }
                  } catch { /* silent */ }
                }}>
                  <Send className="h-3 w-3" /> 一键推送
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {restockSuggestions.map((s) => (
                <div key={s.id} className="p-2.5 rounded-lg border bg-muted/20">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{s.name}</span>
                    <Badge variant="outline" className={cn("text-[10px]", urgencyColor(s.urgency))}>
                      {s.urgency === "high" ? "紧急" : s.urgency === "medium" ? "一般" : "可选"}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>建议: {s.suggestedQty.toLocaleString()} 件</span>
                    <span>{s.method} · {s.eta}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">最近补货单</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentOrders.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">暂无补货记录</p>
              ) : (
                recentOrders.map((order) => (
                  <div key={order.id} className="p-2 rounded-lg border text-xs">
                    <div className="flex justify-between mb-1.5">
                      <span className="font-medium">{order.id}</span>
                      <Badge variant="outline" className={cn("text-[10px] h-4", order.status === "created" ? "text-amber-400" : "text-emerald-400")}>
                        {order.status === "created" ? "已创建" : order.status}
                      </Badge>
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{order.totalItems} 件商品</span>
                      <span>{new Date(order.createdAt).toLocaleDateString("zh-CN")}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageTransition>
  );
}
