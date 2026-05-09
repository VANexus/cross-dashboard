"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { businessMetrics } from "@/lib/mock-data";
import { Megaphone, TrendingUp, MousePointerClick, Headphones, DollarSign, Target } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const adCampaigns = [
  { name: "宠物用品-精准词", spend: 3200, sales: 12800, acos: 25.0, status: "active" },
  { name: "宠物用品-泛词", spend: 2100, sales: 5600, acos: 37.5, status: "paused" },
  { name: "智能宠物设备", spend: 4500, sales: 18900, acos: 23.8, status: "active" },
  { name: "宠物护理套装", spend: 2780, sales: 9200, acos: 30.2, status: "active" },
];

const csQueue = [
  { customer: "John D.", topic: "退货申请", priority: "high", waitTime: "3分钟", language: "EN" },
  { customer: "田中太郎", topic: "产品咨询", priority: "medium", waitTime: "5分钟", language: "JP" },
  { customer: "Maria S.", topic: "物流查询", priority: "low", waitTime: "8分钟", language: "DE" },
];

const adSpendTrend = [
  { day: "5/3", spend: 3800, sales: 15200 },
  { day: "5/4", spend: 4100, sales: 16400 },
  { day: "5/5", spend: 3600, sales: 14400 },
  { day: "5/6", spend: 4300, sales: 17200 },
  { day: "5/7", spend: 4000, sales: 16000 },
  { day: "5/8", spend: 4500, sales: 18900 },
  { day: "5/9", spend: 4200, sales: 16800 },
];

export default function MarketingPage() {
  const mk = businessMetrics.marketing;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">营销中心</h1>
        <p className="text-sm text-muted-foreground">文案、广告、客服和营销数据分析</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">广告花费(月)</p>
                <p className="text-2xl font-bold">${mk.adSpend.toLocaleString()}</p>
              </div>
              <DollarSign className="h-5 w-5 text-indigo-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">广告 ROI</p>
                <p className="text-2xl font-bold">{mk.adRoi}x</p>
              </div>
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">转化率</p>
                <p className="text-2xl font-bold">{mk.conversionRate}%</p>
              </div>
              <MousePointerClick className="h-5 w-5 text-amber-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">客服响应(分)</p>
                <p className="text-2xl font-bold">{mk.csResponseTime}</p>
              </div>
              <Headphones className="h-5 w-5 text-sky-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="ads">
        <TabsList>
          <TabsTrigger value="ads">广告管理</TabsTrigger>
          <TabsTrigger value="copy">文案生成</TabsTrigger>
          <TabsTrigger value="cs">客服队列</TabsTrigger>
        </TabsList>
        <TabsContent value="ads" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">广告花费趋势</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={adSpendTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="day" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                    <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                    <Tooltip contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }} />
                    <Area type="monotone" dataKey="sales" name="销售额" stroke="#6366f1" fill="#6366f1" fillOpacity={0.1} />
                    <Area type="monotone" dataKey="spend" name="花费" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">广告活动</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {adCampaigns.map((c) => (
                  <div key={c.name} className="flex items-center gap-4 rounded-lg border p-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{c.name}</span>
                        <Badge variant={c.status === "active" ? "success" : "secondary"}>
                          {c.status === "active" ? "投放中" : "已暂停"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span>花费: ${c.spend}</span>
                        <span>销售: ${c.sales}</span>
                        <span className={c.acos > 30 ? "text-amber-500" : "text-emerald-500"}>ACOS: {c.acos}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="copy" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">AI 文案生成器</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { product: "宠物智能喂食器Pro", lang: "EN", version: "A", status: "approved", score: 92 },
                  { product: "宠物智能喂食器Pro", lang: "EN", version: "B", status: "testing", score: 88 },
                  { product: "宠物智能喂食器Pro", lang: "DE", version: "A", status: "approved", score: 90 },
                  { product: "猫咪自动饮水机", lang: "JP", version: "A", status: "generating", score: 0 },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4 rounded-lg border p-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{item.product}</span>
                        <Badge variant="outline" className="text-[10px]">{item.lang} v{item.version}</Badge>
                      </div>
                      {item.score > 0 && (
                        <div className="text-xs text-muted-foreground mt-0.5">AI评分: {item.score}/100</div>
                      )}
                    </div>
                    <Badge variant={item.status === "approved" ? "success" : item.status === "testing" ? "warning" : "default"}>
                      {item.status === "approved" ? "已采纳" : item.status === "testing" ? "测试中" : "生成中"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="cs" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">客服待处理队列</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {csQueue.map((item, i) => (
                  <div key={i} className="flex items-center gap-4 rounded-lg border p-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{item.customer}</span>
                        <Badge variant="outline" className="text-[10px]">{item.language}</Badge>
                        <Badge variant={item.priority === "high" ? "danger" : item.priority === "medium" ? "warning" : "secondary"} className="text-[10px]">
                          {item.priority === "high" ? "高" : item.priority === "medium" ? "中" : "低"}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {item.topic} · 等待: {item.waitTime}
                      </div>
                    </div>
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
