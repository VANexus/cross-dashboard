"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { businessMetrics } from "@/lib/mock-data";
import { TrendingUp, Package, MonitorSmartphone, Star, AlertTriangle, ArrowUpRight, ArrowDownRight } from "lucide-react";

const topProducts = [
  { name: "宠物智能喂食器Pro", sku: "SKU-3291", bsr: 128, sales: 580, profit: 32.5, trend: "up" },
  { name: "猫咪自动饮水机", sku: "SKU-5572", bsr: 256, sales: 420, profit: 28.1, trend: "up" },
  { name: "狗狗训练响片套装", sku: "SKU-8834", bsr: 512, sales: 315, profit: 45.2, trend: "down" },
  { name: "宠物GPS追踪器", sku: "SKU-1123", bsr: 89, sales: 680, profit: 22.8, trend: "up" },
  { name: "猫抓板豪华版", sku: "SKU-4456", bsr: 345, sales: 290, profit: 38.6, trend: "stable" },
];

const inventoryAlerts = [
  { sku: "SKU-7842", name: "宠物毛刷套装", stock: 23, dailySales: 12, daysLeft: 2, status: "critical" },
  { sku: "SKU-3291", name: "宠物智能喂食器Pro", stock: 45, dailySales: 8, daysLeft: 6, status: "warning" },
  { sku: "SKU-5572", name: "猫咪自动饮水机", stock: 120, dailySales: 6, daysLeft: 20, status: "normal" },
];

export default function OperationsPage() {
  const ops = businessMetrics.operations;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">运营分析</h1>
        <p className="text-sm text-muted-foreground">选品、库存、上架和账号健康监控</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">在售产品</p>
                <p className="text-2xl font-bold">{ops.productCount}</p>
              </div>
              <Package className="h-5 w-5 text-indigo-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">库存周转率</p>
                <p className="text-2xl font-bold">{ops.inventoryTurnover}x</p>
              </div>
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">上架成功率</p>
                <p className="text-2xl font-bold">{ops.listingSuccessRate}%</p>
              </div>
              <Star className="h-5 w-5 text-amber-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">账号健康</p>
                <p className="text-2xl font-bold">{ops.accountHealth}%</p>
              </div>
              <MonitorSmartphone className="h-5 w-5 text-sky-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">选品分析</TabsTrigger>
          <TabsTrigger value="inventory">库存监控</TabsTrigger>
          <TabsTrigger value="listing">AI 上架</TabsTrigger>
        </TabsList>
        <TabsContent value="products" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">热销产品 Top 5</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topProducts.map((p, i) => (
                  <div key={p.sku} className="flex items-center gap-4 rounded-lg border p-3 hover:bg-muted/30 transition-colors">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{p.name}</span>
                        <span className="text-[10px] text-muted-foreground">{p.sku}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-[11px] text-muted-foreground">
                        <span>BSR: #{p.bsr}</span>
                        <span>月销: {p.sales}</span>
                        <span>利润率: {p.profit}%</span>
                      </div>
                    </div>
                    {p.trend === "up" ? (
                      <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                    ) : p.trend === "down" ? (
                      <ArrowDownRight className="h-4 w-4 text-red-500" />
                    ) : null}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="inventory" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">库存预警</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {inventoryAlerts.map((item) => (
                  <div key={item.sku} className="flex items-center gap-4 rounded-lg border p-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{item.name}</span>
                        <span className="text-[10px] text-muted-foreground">{item.sku}</span>
                        <Badge variant={item.status === "critical" ? "danger" : item.status === "warning" ? "warning" : "success"}>
                          {item.status === "critical" ? "紧急" : item.status === "warning" ? "预警" : "正常"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                        <span>库存: {item.stock}</span>
                        <span>日均: {item.dailySales}</span>
                        <span className={item.daysLeft <= 3 ? "text-red-500 font-medium" : ""}>可售: {item.daysLeft}天</span>
                      </div>
                      <Progress value={Math.min((item.daysLeft / 30) * 100, 100)} className="h-1.5 mt-2" />
                    </div>
                    {item.status === "critical" && <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="listing" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">AI 上架队列</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { name: "宠物智能项圈V2", status: "generating", lang: "EN/DE/JP" },
                  { name: "可折叠宠物背包", status: "reviewing", lang: "EN/DE" },
                  { name: "宠物指甲剪升级版", status: "completed", lang: "EN/DE/JP/FR" },
                ].map((item) => (
                  <div key={item.name} className="flex items-center gap-4 rounded-lg border p-3">
                    <div className="flex-1">
                      <span className="text-sm font-medium">{item.name}</span>
                      <div className="text-[11px] text-muted-foreground mt-0.5">目标语言: {item.lang}</div>
                    </div>
                    <Badge variant={item.status === "completed" ? "success" : item.status === "reviewing" ? "warning" : "default"}>
                      {item.status === "completed" ? "已完成" : item.status === "reviewing" ? "审核中" : "生成中"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
