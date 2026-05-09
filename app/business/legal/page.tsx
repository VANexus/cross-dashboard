"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { businessMetrics } from "@/lib/mock-data";
import { Scale, FileText, AlertTriangle, Shield, Clock } from "lucide-react";

const patents = [
  { name: "智能宠物喂食器-出食机构", id: "PAT-2025-0891", status: "monitoring", risk: "low", filed: "2025-03-15" },
  { name: "GPS宠物追踪器-定位算法", id: "PAT-2024-1234", status: "conflict", risk: "high", filed: "2024-11-20" },
  { name: "自动宠物饮水机-过滤系统", id: "PAT-2025-0456", status: "monitoring", risk: "low", filed: "2025-01-10" },
];

const contracts = [
  { name: "深圳XX供应链合同", type: "供应商", expires: "2026-12-31", status: "active" },
  { name: "FBA物流服务协议", type: "物流", expires: "2026-06-30", status: "active" },
  { name: "XX品牌授权协议", type: "品牌", expires: "2026-03-15", status: "expiring" },
];

const disputes = [
  { id: "DSP-001", title: "Amazon Brand投诉-SKU3291", type: "知识产权", severity: "critical", opened: "2026-05-09T07:15:00Z", status: "resolved" },
  { id: "DSP-002", title: "买家差评纠纷-SKU5572", type: "客户纠纷", severity: "medium", opened: "2026-05-08T14:30:00Z", status: "open" },
];

export default function LegalPage() {
  const leg = businessMetrics.legal;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">法务中心</h1>
        <p className="text-sm text-muted-foreground">专利监控、合同管理和纠纷处理</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">专利监控</p>
                <p className="text-2xl font-bold">{leg.patentsMonitored}</p>
              </div>
              <Shield className="h-5 w-5 text-indigo-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">活跃合同</p>
                <p className="text-2xl font-bold">{leg.activeContracts}</p>
              </div>
              <FileText className="h-5 w-5 text-sky-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">未结纠纷</p>
                <p className="text-2xl font-bold">{leg.openDisputes}</p>
              </div>
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">合规评分</p>
                <p className="text-2xl font-bold">{leg.complianceScore}</p>
              </div>
              <Scale className="h-5 w-5 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="patents">
        <TabsList>
          <TabsTrigger value="patents">专利监控</TabsTrigger>
          <TabsTrigger value="contracts">合同管理</TabsTrigger>
          <TabsTrigger value="disputes">纠纷追踪</TabsTrigger>
        </TabsList>
        <TabsContent value="patents" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">专利监控列表</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {patents.map((p) => (
                  <div key={p.id} className="flex items-center gap-4 rounded-lg border p-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{p.name}</span>
                        <span className="text-[10px] text-muted-foreground">{p.id}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>申请日: {p.filed}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={p.risk === "high" ? "danger" : "success"}>
                        {p.risk === "high" ? "高风险" : "低风险"}
                      </Badge>
                      <Badge variant={p.status === "conflict" ? "warning" : "secondary"}>
                        {p.status === "conflict" ? "有冲突" : "监控中"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="contracts" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">合同管理</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {contracts.map((c) => (
                  <div key={c.name} className="flex items-center gap-4 rounded-lg border p-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{c.name}</span>
                        <Badge variant="outline" className="text-[10px]">{c.type}</Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        到期: {c.expires}
                      </div>
                    </div>
                    <Badge variant={c.status === "expiring" ? "warning" : "success"}>
                      {c.status === "expiring" ? "即将到期" : "有效"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="disputes" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">纠纷追踪</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {disputes.map((d) => (
                  <div key={d.id} className="flex items-start gap-4 rounded-lg border p-3">
                    <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${d.severity === "critical" ? "text-red-500" : "text-amber-500"}`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{d.title}</span>
                        <Badge variant="outline" className="text-[10px]">{d.type}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {new Date(d.opened).toLocaleString("zh-CN")}
                      </div>
                    </div>
                    <Badge variant={d.status === "resolved" ? "success" : "warning"}>
                      {d.status === "resolved" ? "已解决" : "处理中"}
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
