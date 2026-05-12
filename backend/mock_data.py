from __future__ import annotations

import copy
import math
import random
import uuid
from datetime import datetime, timedelta
from typing import Any, Optional

AGENTS: list[dict] = [
    {
        "id": "sentinel-001",
        "name": "Sentinel",
        "status": "online",
        "type": "sentinel",
        "autonomyLevel": "L3",
        "reflexLevel": "claude-4-opus",
        "trustScore": 0.92,
        "lastHeartbeat": "2026-03-15T14:32:00Z",
        "currentTask": "P-2049",
        "completedToday": 12,
        "avgCompletionTime": 45,
        "apiCalls": 1240,
        "avgResponseTime": 280,
        "memoryUsage": 0.72,
        "errorsToday": 1,
        "specializations": ["Market Analysis", "Trend Detection", "Demand Forecasting"],
        "kpi": {"successRate": 0.94, "tasksToday": 12, "avgQuality": 0.87},
        "subAgents": [
            {"id": "sub-001", "parentId": "sentinel-001", "name": "Sentinel-Forecast", "status": "busy", "spawnedAt": "2026-03-15T14:00:00Z", "taskDescription": "Q2 demand forecasting for electronics category"},
            {"id": "sub-002", "parentId": "sentinel-001", "name": "Sentinel-Competitor", "status": "idle", "spawnedAt": "2026-03-15T12:30:00Z", "taskDescription": "Competitor price monitoring for top 50 ASINs"},
        ],
    },
    {
        "id": "dispatch-002",
        "name": "Dispatch",
        "status": "busy",
        "type": "dispatch",
        "autonomyLevel": "L4",
        "reflexLevel": "claude-4-sonnet",
        "trustScore": 0.88,
        "lastHeartbeat": "2026-03-15T14:31:45Z",
        "currentTask": "D-1847",
        "completedToday": 28,
        "avgCompletionTime": 12,
        "apiCalls": 890,
        "avgResponseTime": 150,
        "memoryUsage": 0.45,
        "errorsToday": 0,
        "specializations": ["Task Routing", "Agent Coordination", "Load Balancing"],
        "kpi": {"successRate": 0.98, "tasksToday": 28, "avgQuality": 0.92},
        "subAgents": [
            {"id": "sub-003", "parentId": "dispatch-002", "name": "Dispatch-Route", "status": "busy", "spawnedAt": "2026-03-15T14:30:00Z", "taskDescription": "Routing optimization for warehouse operations"},
        ],
    },
    {
        "id": "operations-003",
        "name": "Operations",
        "status": "online",
        "type": "operations",
        "autonomyLevel": "L3",
        "reflexLevel": "claude-4-sonnet",
        "trustScore": 0.95,
        "lastHeartbeat": "2026-03-15T14:32:10Z",
        "currentTask": None,
        "completedToday": 8,
        "avgCompletionTime": 90,
        "apiCalls": 560,
        "avgResponseTime": 320,
        "memoryUsage": 0.68,
        "errorsToday": 0,
        "specializations": ["Inventory Management", "Order Processing", "Supply Chain"],
        "kpi": {"successRate": 0.96, "tasksToday": 8, "avgQuality": 0.91},
        "subAgents": [],
    },
    {
        "id": "risk-004",
        "name": "RiskControl",
        "status": "error",
        "type": "risk_control",
        "autonomyLevel": "L5",
        "reflexLevel": "claude-4-opus",
        "trustScore": 0.78,
        "lastHeartbeat": "2026-03-15T14:10:00Z",
        "currentTask": None,
        "completedToday": 3,
        "avgCompletionTime": 200,
        "apiCalls": 320,
        "avgResponseTime": 450,
        "memoryUsage": 0.82,
        "errorsToday": 5,
        "specializations": ["Fraud Detection", "Compliance Monitoring", "Risk Assessment"],
        "kpi": {"successRate": 0.85, "tasksToday": 3, "avgQuality": 0.79},
        "subAgents": [],
    },
    {
        "id": "legal-005",
        "name": "Legal",
        "status": "offline",
        "type": "legal",
        "autonomyLevel": "L2",
        "reflexLevel": "claude-4-sonnet",
        "trustScore": 0.91,
        "lastHeartbeat": "2026-03-15T13:45:00Z",
        "currentTask": None,
        "completedToday": 2,
        "avgCompletionTime": 180,
        "apiCalls": 180,
        "avgResponseTime": 400,
        "memoryUsage": 0.55,
        "errorsToday": 0,
        "specializations": ["Patent Monitoring", "Brand Protection", "Compliance Review"],
        "kpi": {"successRate": 0.93, "tasksToday": 2, "avgQuality": 0.88},
        "subAgents": [],
    },
    {
        "id": "marketing-006",
        "name": "Marketing",
        "status": "online",
        "type": "marketing",
        "autonomyLevel": "L4",
        "reflexLevel": "claude-4-sonnet",
        "trustScore": 0.89,
        "lastHeartbeat": "2026-03-15T14:31:55Z",
        "currentTask": "M-0892",
        "completedToday": 15,
        "avgCompletionTime": 60,
        "apiCalls": 720,
        "avgResponseTime": 200,
        "memoryUsage": 0.61,
        "errorsToday": 0,
        "specializations": ["Ad Optimization", "Content Generation", "Market Research"],
        "kpi": {"successRate": 0.91, "tasksToday": 15, "avgQuality": 0.85},
        "subAgents": [
            {"id": "sub-004", "parentId": "marketing-006", "name": "Marketing-Content", "status": "busy", "spawnedAt": "2026-03-15T14:15:00Z", "taskDescription": "A+ content generation for new product line"},
        ],
    },
]


TASKS: list[dict] = [
    {
        "id": "task-001",
        "title": "New product demand forecasting",
        "description": "Analyze market trends for Q2 2026 electronics category and generate demand forecast report",
        "status": "completed",
        "priority": "high",
        "assignedAgents": ["sentinel-001", "operations-003"],
        "createdAt": "2026-03-15T08:00:00Z",
        "updatedAt": "2026-03-15T12:45:00Z",
        "completedAt": "2026-03-15T12:45:00Z",
        "output": "Q2 forecast complete: 15% growth expected in electronics. Top 5 ASINs identified for expansion.",
        "steps": [
            {"id": "step-001", "name": "Data Collection", "status": "completed", "agentId": "sentinel-001", "startedAt": "2026-03-15T08:05:00Z", "completedAt": "2026-03-15T09:30:00Z", "output": "Collected 45 ASINs data from 3 marketplaces"},
            {"id": "step-002", "name": "Trend Analysis", "status": "completed", "agentId": "sentinel-001", "startedAt": "2026-03-15T09:35:00Z", "completedAt": "2026-03-15T11:00:00Z", "output": "Identified 3 major trends: eco-friendly products, smart home, portable electronics"},
            {"id": "step-003", "name": "Report Generation", "status": "completed", "agentId": "operations-003", "startedAt": "2026-03-15T11:05:00Z", "completedAt": "2026-03-15T12:45:00Z", "output": "Generated comprehensive Q2 forecast report"},
        ],
    },
    {
        "id": "task-002",
        "title": "Inventory replenishment optimization",
        "description": "Optimize inventory levels for top 20 SKUs to prevent stockouts during peak season",
        "status": "running",
        "priority": "critical",
        "assignedAgents": ["operations-003"],
        "createdAt": "2026-03-15T10:00:00Z",
        "updatedAt": "2026-03-15T14:30:00Z",
        "completedAt": None,
        "output": None,
        "steps": [
            {"id": "step-004", "name": "Inventory Analysis", "status": "completed", "agentId": "operations-003", "startedAt": "2026-03-15T10:05:00Z", "completedAt": "2026-03-15T11:30:00Z", "output": "Analyzed current inventory levels for 20 SKUs"},
            {"id": "step-005", "name": "Demand Prediction", "status": "running", "agentId": "sentinel-001", "startedAt": "2026-03-15T11:35:00Z", "completedAt": None, "output": None},
            {"id": "step-006", "name": "Order Generation", "status": "pending", "agentId": "operations-003", "startedAt": None, "completedAt": None, "output": None},
        ],
    },
    {
        "id": "task-003",
        "title": "Brand risk assessment",
        "description": "Comprehensive brand risk assessment for all active listings including patent and trademark checks",
        "status": "pending",
        "priority": "high",
        "assignedAgents": ["risk-004", "legal-005"],
        "createdAt": "2026-03-15T14:00:00Z",
        "updatedAt": "2026-03-15T14:00:00Z",
        "completedAt": None,
        "output": None,
        "steps": [
            {"id": "step-007", "name": "Patent Search", "status": "pending", "agentId": "legal-005", "startedAt": None, "completedAt": None, "output": None},
            {"id": "step-008", "name": "Trademark Analysis", "status": "pending", "agentId": "legal-005", "startedAt": None, "completedAt": None, "output": None},
            {"id": "step-009", "name": "Risk Scoring", "status": "pending", "agentId": "risk-004", "startedAt": None, "completedAt": None, "output": None},
        ],
    },
    {
        "id": "task-004",
        "title": "Competitor ad monitoring",
        "description": "Monitor competitor advertising strategies across SP, SB, and SD campaigns",
        "status": "running",
        "priority": "medium",
        "assignedAgents": ["marketing-006"],
        "createdAt": "2026-03-15T09:00:00Z",
        "updatedAt": "2026-03-15T14:20:00Z",
        "completedAt": None,
        "output": None,
        "steps": [
            {"id": "step-010", "name": "Data Collection", "status": "completed", "agentId": "marketing-006", "startedAt": "2026-03-15T09:05:00Z", "completedAt": "2026-03-15T10:30:00Z", "output": "Collected ad data for 15 competitors"},
            {"id": "step-011", "name": "Strategy Analysis", "status": "running", "agentId": "marketing-006", "startedAt": "2026-03-15T10:35:00Z", "completedAt": None, "output": None},
        ],
    },
    {
        "id": "task-005",
        "title": "Listing content optimization",
        "description": "Optimize product listings for top 10 ASINs including title, bullets, and A+ content",
        "status": "failed",
        "priority": "medium",
        "assignedAgents": ["marketing-006"],
        "createdAt": "2026-03-14T16:00:00Z",
        "updatedAt": "2026-03-15T02:30:00Z",
        "completedAt": "2026-03-15T02:30:00Z",
        "output": "Failed: API rate limit exceeded during content generation. Partial results saved.",
        "steps": [
            {"id": "step-012", "name": "Content Analysis", "status": "completed", "agentId": "marketing-006", "startedAt": "2026-03-14T16:05:00Z", "completedAt": "2026-03-14T18:00:00Z", "output": "Analyzed current listing performance for 10 ASINs"},
            {"id": "step-013", "name": "Content Generation", "status": "failed", "agentId": "marketing-006", "startedAt": "2026-03-14T18:05:00Z", "completedAt": "2026-03-15T02:30:00Z", "output": "Error: API rate limit exceeded. 6 of 10 listings completed."},
        ],
    },
]


RISK_EVENTS: list[dict] = [
    {
        "id": "risk-001",
        "level": "level1",
        "title": "Top ASIN listing hijacked",
        "description": "Detected unauthorized seller on B0DFGH3456 with counterfeit products",
        "source": "Sentinel Agent",
        "timestamp": "2026-03-15T14:25:00Z",
        "resolved": False,
        "resolvedAt": None,
        "actions": ["Isolate listing", "Contact brand support", "Gather evidence"],
    },
    {
        "id": "risk-002",
        "level": "level2",
        "title": "Inventory stockout risk",
        "description": "ASIN B0ABC12345 projected to stockout within 7 days at current sales velocity",
        "source": "Operations Agent",
        "timestamp": "2026-03-15T13:15:00Z",
        "resolved": False,
        "resolvedAt": None,
        "actions": ["Trigger restock order", "Adjust ad spend"],
    },
    {
        "id": "risk-003",
        "level": "level3",
        "title": "Account health score dropped",
        "description": "ODR increased to 1.2% due to recent A-to-Z claims",
        "source": "Risk Control Agent",
        "timestamp": "2026-03-15T11:00:00Z",
        "resolved": True,
        "resolvedAt": "2026-03-15T12:30:00Z",
        "actions": ["Review A-to-Z claims", "Improve response time", "Update return policy"],
    },
    {
        "id": "risk-004",
        "level": "level2",
        "title": "Brand keyword infringement",
        "description": "Competitor using brand name in Sponsored Products targeting",
        "source": "Legal Agent",
        "timestamp": "2026-03-15T10:30:00Z",
        "resolved": False,
        "resolvedAt": None,
        "actions": ["Document infringement", "File complaint with Amazon", "Monitor competitor ads"],
    },
]


MEMORY_ENTRIES: list[dict] = [
    {
        "id": "mem-001",
        "zone": "preset",
        "title": "Amazon Listing Optimization Best Practices",
        "content": "Standard operating procedure for optimizing Amazon product listings including title formatting, bullet points, and backend keywords",
        "type": "script",
        "version": 3,
        "createdAt": "2026-02-01T08:00:00Z",
        "updatedAt": "2026-03-10T14:00:00Z",
        "verified": True,
        "tags": ["listing", "optimization", "seo"],
    },
    {
        "id": "mem-002",
        "zone": "dev",
        "title": "Inventory Reorder Point Calculation",
        "content": "Dynamic reorder point calculation algorithm considering lead time, safety stock, and seasonal demand patterns",
        "type": "code",
        "version": 5,
        "createdAt": "2026-01-15T10:00:00Z",
        "updatedAt": "2026-03-12T16:00:00Z",
        "verified": True,
        "tags": ["inventory", "algorithm", "supply-chain"],
    },
    {
        "id": "mem-003",
        "zone": "prompt",
        "title": "Product Description Generation Template",
        "content": "Structured prompt template for generating compelling product descriptions with SEO optimization and brand voice consistency",
        "type": "prompt",
        "version": 7,
        "createdAt": "2026-02-15T09:00:00Z",
        "updatedAt": "2026-03-14T11:00:00Z",
        "verified": True,
        "tags": ["content", "generation", "copywriting"],
    },
    {
        "id": "mem-004",
        "zone": "dev",
        "title": "Ad Campaign Bid Optimization",
        "content": "Machine learning model for automatic bid adjustment based on conversion probability and profit margin targets",
        "type": "skill",
        "version": 12,
        "createdAt": "2026-01-20T08:00:00Z",
        "updatedAt": "2026-03-15T10:00:00Z",
        "verified": True,
        "tags": ["advertising", "bidding", "ml"],
    },
    {
        "id": "mem-005",
        "zone": "prompt",
        "title": "Customer Review Sentiment Analysis",
        "content": "NLP pipeline configuration for analyzing customer reviews to extract product improvement insights and sentiment trends",
        "type": "script",
        "version": 4,
        "createdAt": "2026-02-20T11:00:00Z",
        "updatedAt": "2026-03-08T15:00:00Z",
        "verified": False,
        "tags": ["nlp", "reviews", "sentiment"],
    },
    {
        "id": "mem-006",
        "zone": "dev",
        "title": "Competitor Price Monitoring Rules",
        "content": "Rule-based system for monitoring competitor pricing changes and triggering automated repricing actions within defined boundaries",
        "type": "code",
        "version": 8,
        "createdAt": "2026-01-25T09:00:00Z",
        "updatedAt": "2026-03-13T13:00:00Z",
        "verified": True,
        "tags": ["pricing", "competition", "automation"],
    },
]


EVOLUTION_RECORDS: list[dict] = [
    {
        "id": "evo-001",
        "stage": "reuse",
        "title": "Listing optimization workflow standardized",
        "description": "Successfully standardized the listing optimization process based on 50+ successful iterations",
        "agentId": "marketing-006",
        "startedAt": "2026-03-10T08:00:00Z",
        "completedAt": "2026-03-14T16:00:00Z",
        "status": "success",
        "metrics": {"accuracy": 0.94, "latency": 120, "coverage": 0.87},
    },
    {
        "id": "evo-002",
        "stage": "test",
        "title": "New inventory prediction model",
        "description": "Testing improved inventory prediction model with seasonal adjustment factors",
        "agentId": "operations-003",
        "startedAt": "2026-03-12T10:00:00Z",
        "completedAt": None,
        "status": "in_progress",
        "metrics": {"accuracy": 0.88, "latency": 200, "coverage": 0.75},
    },
    {
        "id": "evo-003",
        "stage": "generate",
        "title": "Automated A/B testing framework",
        "description": "Developing automated A/B testing framework for ad creative optimization",
        "agentId": "marketing-006",
        "startedAt": "2026-03-13T09:00:00Z",
        "completedAt": None,
        "status": "in_progress",
        "metrics": None,
    },
    {
        "id": "evo-004",
        "stage": "identify",
        "title": "Customer segmentation improvements",
        "description": "Identified opportunity to improve customer segmentation for targeted advertising",
        "agentId": "sentinel-001",
        "startedAt": "2026-03-14T14:00:00Z",
        "completedAt": None,
        "status": "in_progress",
        "metrics": None,
    },
]


SYSTEM_METRICS: dict = {
    "apiCalls": 1240,
    "avgResponseTime": 280,
    "errorRate": 0.02,
    "memoryUsage": 0.72,
    "cpuUsage": 0.45,
    "activeConnections": 8,
    "queueLength": 3,
    "uptime": 99.97,
}


DASHBOARD_STATS: dict = {
    "totalAgents": 6,
    "onlineAgents": 3,
    "busyAgents": 1,
    "errorAgents": 1,
    "offlineAgents": 1,
    "totalTasks": 5,
    "runningTasks": 2,
    "completedTasks": 1,
    "failedTasks": 1,
    "riskEvents24h": 4,
    "activeCircuitBreakers": 2,
}


BUSINESS_METRICS: dict = {
    "operations": {
        "productCount": 156,
        "inventoryTurnover": 4.2,
        "listingSuccessRate": 0.94,
        "accountHealth": 98,
    },
    "marketing": {
        "adSpend": 12500,
        "adRoi": 3.8,
        "conversionRate": 0.128,
        "csResponseTime": 2.4,
    },
    "finance": {
        "revenue": 284000,
        "profit": 42600,
        "cashflow": 1.15,
        "costBreakdown": [
            {"category": "Product Cost", "amount": 98000},
            {"category": "Advertising", "amount": 12500},
            {"category": "FBA Fees", "amount": 45000},
            {"category": "Shipping", "amount": 18000},
            {"category": "Returns", "amount": 5200},
            {"category": "Storage", "amount": 8700},
        ],
    },
    "legal": {
        "patentsMonitored": 24,
        "activeContracts": 8,
        "openDisputes": 2,
        "complianceScore": 95,
    },
}


WORKFLOW_STATUSES: list[dict] = [
    {"id": "product-research", "name": "Product Research", "href": "/workflows/product-research", "status": "idle", "lastRun": "2026-03-15 10:30", "runs": 47, "success": 45},
    {"id": "ai-imaging", "name": "AI Imaging", "href": "/workflows/ai-imaging", "status": "running", "lastRun": "2026-03-15 14:20", "runs": 128, "success": 124},
    {"id": "ai-advertising", "name": "AI Advertising", "href": "/workflows/ai-advertising", "status": "idle", "lastRun": "2026-03-15 12:00", "runs": 89, "success": 82},
    {"id": "ai-listing", "name": "AI Listing", "href": "/workflows/ai-listing", "status": "warning", "lastRun": "2026-03-14 18:00", "runs": 203, "success": 198},
    {"id": "inventory", "name": "Inventory Management", "href": "/workflows/inventory", "status": "idle", "lastRun": "2026-03-15 08:00", "runs": 156, "success": 150},
    {"id": "competitor-ads", "name": "Competitor Ad Analysis", "href": "/workflows/competitor-ads", "status": "running", "lastRun": "2026-03-15 14:00", "runs": 34, "success": 31},
]


ALERTS: list[dict] = [
    {"id": "alert-001", "level": "danger", "message": "ASIN B0DFGH3456 listing hijacked — 3 unauthorized sellers detected", "time": "5 min ago", "href": "/risk"},
    {"id": "alert-002", "level": "warning", "message": "SKU WH-001 inventory < 7 days — reorder triggered", "time": "23 min ago", "href": "/workflows/inventory"},
    {"id": "alert-003", "level": "info", "message": "Listing v2.4 published successfully — 156 products optimized", "time": "1 hour ago", "href": "/workflows/ai-listing"},
]


TRENDS: dict = {
    "sales": [8200, 9100, 8800, 10200, 9600, 11000, 10500],
    "acos": [22.1, 21.5, 20.8, 19.4, 18.9, 18.2, 17.8],
    "conversion": [12.1, 12.4, 12.8, 13.1, 12.9, 13.5, 13.8],
}


HEALTH_DIMENSIONS: list[dict] = [
    {"label": "Listing Compliance", "score": 96, "value": "96%", "threshold": "> 90%", "status": "pass"},
    {"label": "Account Health", "score": 92, "value": "98/100", "threshold": "> 95", "status": "pass"},
    {"label": "Inventory Health", "score": 88, "value": "4.2 turns", "threshold": "> 4.0", "status": "warning"},
    {"label": "Brand Registry", "score": 100, "value": "Active", "threshold": "Active", "status": "pass"},
    {"label": "IP Complaints", "score": 94, "value": "2 open", "threshold": "< 5", "status": "pass"},
    {"label": "Order Defect Rate", "score": 82, "value": "1.2%", "threshold": "< 1%", "status": "warning"},
]


RISK_INDICATORS: list[dict] = [
    {"name": "Buy Box Retention", "current": "94%", "threshold": "> 90%", "status": "safe", "trend": [88, 90, 92, 91, 94, 93, 94]},
    {"name": "FBA Inventory Age", "current": "45 days", "threshold": "< 90 days", "status": "safe", "trend": [60, 55, 50, 48, 46, 44, 45]},
    {"name": "Seller Rating", "current": "4.8/5.0", "threshold": "> 4.5", "status": "safe", "trend": [4.6, 4.7, 4.7, 4.8, 4.8, 4.8, 4.8]},
    {"name": "Policy Violations", "current": "0", "threshold": "0", "status": "safe", "trend": [2, 1, 1, 0, 0, 0, 0]},
]


ISOLATION_ITEMS: list[dict] = [
    {"label": "风险 ASIN — Listing hijack suspected", "checked": True},
    {"label": "高退货率 SKU — Return rate > 10%", "checked": True},
    {"label": "疑似侵权关键词 — Brand X trademark", "checked": False},
    {"label": "低评分产品 — Rating < 3.5 stars", "checked": False},
    {"label": "账号健康预警 — ODR approaching 1%", "checked": True},
]


def paginate(items: list, page: int, page_size: int) -> dict:
    total = len(items)
    total_pages = max(1, math.ceil(total / page_size))
    start = (page - 1) * page_size
    end = start + page_size
    return {
        "items": items[start:end],
        "pagination": {"page": page, "pageSize": page_size, "total": total, "totalPages": total_pages},
    }


def gen_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:6]}"


def now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"


data_sources: list[dict] = [
    {"id": "src-001", "name": "Amazon Best Sellers", "enabled": True, "status": "completed", "progress": 100},
    {"id": "src-002", "name": "Google Trends", "enabled": True, "status": "completed", "progress": 100},
    {"id": "src-003", "name": "TikTok Shop Data", "enabled": True, "status": "scraping", "progress": 67},
    {"id": "src-004", "name": "Temu Marketplace", "enabled": False, "status": "pending", "progress": 0},
    {"id": "src-005", "name": "1688 Supplier Data", "enabled": True, "status": "completed", "progress": 100},
    {"id": "src-006", "name": "Social Media Mentions", "enabled": True, "status": "scraping", "progress": 45},
    {"id": "src-007", "name": "Patent Database", "enabled": True, "status": "completed", "progress": 100},
    {"id": "src-008", "name": "Competitor Pricing", "enabled": True, "status": "completed", "progress": 100},
    {"id": "src-009", "name": "Review Sentiment Data", "enabled": False, "status": "pending", "progress": 0},
]

product_keywords: list[dict] = [
    {"keyword": "smart home hub", "volume": 45000, "cpc": 1.24, "competition": 0.78, "supplyDemand": 3.2, "trend": [30, 35, 42, 48, 55, 62, 68], "aiTag": "potential"},
    {"keyword": "wireless earbuds pro", "volume": 120000, "cpc": 2.15, "competition": 0.92, "supplyDemand": 1.8, "trend": [80, 85, 82, 88, 90, 87, 92], "aiTag": "competitive"},
    {"keyword": "eco friendly water bottle", "volume": 38000, "cpc": 0.89, "competition": 0.45, "supplyDemand": 5.6, "trend": [20, 25, 30, 38, 42, 48, 55], "aiTag": "potential"},
    {"keyword": "led strip lights bedroom", "volume": 89000, "cpc": 1.56, "competition": 0.85, "supplyDemand": 2.1, "trend": [65, 70, 68, 72, 75, 78, 80], "aiTag": "competitive"},
    {"keyword": "portable blender usb", "volume": 28000, "cpc": 0.78, "competition": 0.38, "supplyDemand": 7.2, "trend": [15, 18, 22, 28, 35, 42, 50], "aiTag": "potential"},
    {"keyword": "yoga mat non slip", "volume": 67000, "cpc": 1.12, "competition": 0.72, "supplyDemand": 2.8, "trend": [50, 52, 55, 58, 60, 62, 65], "aiTag": "competitive"},
    {"keyword": "phone stand adjustable", "volume": 52000, "cpc": 0.65, "competition": 0.55, "supplyDemand": 4.1, "trend": [35, 38, 40, 42, 45, 48, 52], "aiTag": "potential"},
    {"keyword": "car phone mount magnetic", "volume": 41000, "cpc": 1.45, "competition": 0.88, "supplyDemand": 1.5, "trend": [40, 42, 38, 35, 33, 30, 28], "aiTag": "risky"},
]

pain_points: list[dict] = [
    {"category": "Battery Life", "count": 847, "pct": 34, "examples": ["Battery drains too fast", "Doesn't hold charge overnight", "Battery died after 2 months"]},
    {"category": "Connectivity", "count": 623, "pct": 25, "examples": ["Bluetooth keeps disconnecting", "WiFi setup is complicated", "Pairing issues with iPhone"]},
    {"category": "Build Quality", "count": 512, "pct": 21, "examples": ["Feels cheap and flimsy", "Buttons stopped working", "Cracked after minor drop"]},
    {"category": "App Issues", "count": 498, "pct": 20, "examples": ["App crashes frequently", "Firmware update failed", "No Android support"]},
]

main_images: list[dict] = [
    {"id": "img-001", "type": "主图", "clipScore": 87, "ctrScore": 72, "overall": 82, "isBest": False, "prompt": "Clean white background product shot with soft shadows, 45-degree angle, studio lighting", "model": "DALL-E 3", "seed": 42},
    {"id": "img-002", "type": "主图", "clipScore": 92, "ctrScore": 88, "overall": 91, "isBest": True, "prompt": "Hero product shot with lifestyle context, warm lighting, shallow depth of field", "model": "Midjourney v6", "seed": 128},
    {"id": "img-003", "type": "主图", "clipScore": 78, "ctrScore": 65, "overall": 74, "isBest": False, "prompt": "Minimalist product shot, flat lay perspective, neutral background", "model": "Stable Diffusion XL", "seed": 256},
    {"id": "img-004", "type": "主图", "clipScore": 85, "ctrScore": 79, "overall": 83, "isBest": False, "prompt": "Dynamic product shot with motion blur effect, modern aesthetic", "model": "DALL-E 3", "seed": 512},
]

scene_images: list[dict] = [
    {"id": "img-005", "type": "场景图", "clipScore": 91, "ctrScore": 85, "overall": 89, "isBest": True, "prompt": "Product in modern kitchen setting, natural daylight, lifestyle photography", "model": "Midjourney v6", "seed": 789},
    {"id": "img-006", "type": "场景图", "clipScore": 83, "ctrScore": 76, "overall": 81, "isBest": False, "prompt": "Outdoor adventure scene with product, golden hour lighting", "model": "DALL-E 3", "seed": 1024},
    {"id": "img-007", "type": "场景图", "clipScore": 88, "ctrScore": 82, "overall": 86, "isBest": False, "prompt": "Office desk setup with product as centerpiece, professional environment", "model": "Stable Diffusion XL", "seed": 2048},
    {"id": "img-008", "type": "场景图", "clipScore": 79, "ctrScore": 71, "overall": 77, "isBest": False, "prompt": "Cozy home environment, evening ambiance, product in use", "model": "Midjourney v6", "seed": 3072},
]

storyboard_frames: list[dict] = [
    {"id": "frame-001", "desc": "Opening hook — product reveal", "duration": "3s", "script": "Discover the future of smart home technology", "camera": "Slow zoom in from black", "source": "AI Generated"},
    {"id": "frame-002", "desc": "Problem statement", "duration": "4s", "script": "Tired of complicated setups and unreliable connections?", "camera": "Quick cuts of frustrated users", "source": "Stock footage"},
    {"id": "frame-003", "desc": "Solution introduction", "duration": "5s", "script": "Introducing our latest innovation — setup in under 60 seconds", "camera": "Smooth tracking shot of product", "source": "AI Generated"},
    {"id": "frame-004", "desc": "Feature showcase — connectivity", "duration": "4s", "script": "Seamless WiFi 6E and Bluetooth 5.3 connectivity", "camera": "Close-up of product with animated connection lines", "source": "AI Generated"},
    {"id": "frame-005", "desc": "Feature showcase — battery", "duration": "4s", "script": "72-hour battery life with fast charging", "camera": "Split screen: charging vs usage timeline", "source": "AI Generated"},
    {"id": "frame-006", "desc": "Social proof", "duration": "3s", "script": "Join 50,000+ satisfied customers worldwide", "camera": "Montage of happy customers with 5-star ratings", "source": "Stock footage"},
    {"id": "frame-007", "desc": "Comparison advantage", "duration": "4s", "script": "Why choose us? See the difference in quality and performance", "camera": "Side-by-side comparison with competitor", "source": "AI Generated"},
    {"id": "frame-008", "desc": "Call to action", "duration": "3s", "script": "Order now and transform your smart home experience", "camera": "Product hero shot with price overlay", "source": "AI Generated"},
]

ad_keywords: list[dict] = [
    {"id": "kw-001", "keyword": "smart home hub", "impressions": 45200, "clicks": 1820, "spend": 892.50, "sales": 4560.00, "acos": 19.6, "conversion": 8.2, "cpc": 0.49, "tag": "high-conversion", "type": "SP", "trend": [60, 65, 70, 72, 75, 78, 82]},
    {"id": "kw-002", "keyword": "alexa compatible devices", "impressions": 38900, "clicks": 1450, "spend": 1120.00, "sales": 3200.00, "acos": 35.0, "conversion": 5.8, "cpc": 0.77, "tag": "high-acos", "type": "SP", "trend": [45, 48, 50, 52, 55, 58, 60]},
    {"id": "kw-003", "keyword": "wifi smart speaker", "impressions": 28600, "clicks": 980, "spend": 650.00, "sales": 2890.00, "acos": 22.5, "conversion": 7.1, "cpc": 0.66, "tag": "high-conversion", "type": "SB", "trend": [35, 38, 42, 45, 48, 52, 55]},
    {"id": "kw-004", "keyword": "home automation system", "impressions": 52100, "clicks": 2100, "spend": 1580.00, "sales": 5200.00, "acos": 30.4, "conversion": 6.5, "cpc": 0.75, "tag": "high-acos", "type": "SP", "trend": [70, 72, 68, 65, 62, 58, 55]},
    {"id": "kw-005", "keyword": "smart home starter kit", "impressions": 18900, "clicks": 820, "spend": 420.00, "sales": 2100.00, "acos": 20.0, "conversion": 9.2, "cpc": 0.51, "tag": "high-conversion", "type": "SD", "trend": [25, 28, 32, 38, 42, 48, 55]},
    {"id": "kw-006", "keyword": "alexa echo accessories", "impressions": 31200, "clicks": 1200, "spend": 780.00, "sales": 1800.00, "acos": 43.3, "conversion": 4.2, "cpc": 0.65, "tag": "non-precise", "type": "SB", "trend": [40, 42, 38, 35, 32, 30, 28]},
    {"id": "kw-007", "keyword": "voice control hub", "impressions": 22400, "clicks": 950, "spend": 580.00, "sales": 3100.00, "acos": 18.7, "conversion": 8.8, "cpc": 0.61, "tag": "high-conversion", "type": "SP", "trend": [30, 35, 40, 45, 50, 55, 60]},
    {"id": "kw-008", "keyword": "smart home controller", "impressions": 15800, "clicks": 620, "spend": 410.00, "sales": 1560.00, "acos": 26.3, "conversion": 6.8, "cpc": 0.66, "tag": "non-precise", "type": "SP", "trend": [20, 22, 25, 28, 30, 32, 35]},
    {"id": "kw-009", "keyword": "bluetooth home speaker", "impressions": 41800, "clicks": 1680, "spend": 1050.00, "sales": 2400.00, "acos": 43.8, "conversion": 3.9, "cpc": 0.63, "tag": "high-acos", "type": "SB", "trend": [55, 52, 48, 45, 42, 40, 38]},
    {"id": "kw-010", "keyword": "wireless smart plug", "impressions": 26700, "clicks": 1100, "spend": 520.00, "sales": 2640.00, "acos": 19.7, "conversion": 9.5, "cpc": 0.47, "tag": "high-conversion", "type": "SP", "trend": [35, 40, 45, 50, 55, 60, 65]},
    {"id": "kw-011", "keyword": "home security smart", "impressions": 33500, "clicks": 1320, "spend": 890.00, "sales": 1980.00, "acos": 44.9, "conversion": 4.1, "cpc": 0.67, "tag": "non-precise", "type": "SD", "trend": [45, 42, 40, 38, 35, 33, 30]},
    {"id": "kw-012", "keyword": "iot hub device", "impressions": 12400, "clicks": 480, "spend": 320.00, "sales": 1440.00, "acos": 22.2, "conversion": 7.5, "cpc": 0.67, "tag": "high-conversion", "type": "SP", "trend": [18, 20, 22, 25, 28, 32, 35]},
]

infringement_words: list[dict] = [
    {"word": "Alexa", "type": "brand", "position": "Title"},
    {"word": "patented technology", "type": "sensitive", "position": "Description"},
    {"word": "Apple HomeKit", "type": "brand", "position": "Backend Keywords"},
]

category_recs: list[dict] = [
    {"path": "Electronics > Smart Home > Hubs & Controllers", "confidence": 92, "reason": "Highest BSR match with 85% keyword overlap"},
    {"path": "Electronics > Smart Home > Voice Assistants", "confidence": 78, "reason": "Strong keyword match but lower BSR alignment"},
    {"path": "Electronics > Audio > Smart Speakers", "confidence": 65, "reason": "Partial feature overlap, consider as secondary category"},
]

bullet_points: list[dict] = [
    {"title": "SEAMLESS CONNECTIVITY", "desc": "WiFi 6E + Bluetooth 5.3 dual-band connection ensures stable, lag-free smart home control with range up to 150ft", "seoScore": 92, "rufus": "friendly"},
    {"title": "VOICE CONTROL HUB", "desc": "Compatible with Alexa, Google Assistant, and Siri — control 500+ smart devices with simple voice commands", "seoScore": 88, "rufus": "friendly"},
    {"title": "EASY SETUP", "desc": "60-second plug-and-play setup with QR code scanning. No technical expertise required — works right out of the box", "seoScore": 85, "rufus": "neutral"},
    {"title": "72-HOUR BATTERY", "desc": "Built-in 5000mAh rechargeable battery provides up to 72 hours of standby time with USB-C fast charging support", "seoScore": 90, "rufus": "friendly"},
    {"title": "PRIVACY FIRST", "desc": "Local processing with end-to-end encryption. Your data stays in your home — no cloud subscription required", "seoScore": 82, "rufus": "needs-opt"},
]

inventory_items: list[dict] = [
    {"id": "inv-001", "sku": "WH-001", "name": "Smart Home Hub Pro", "stock": 342, "dailySales": 28, "ratioDays": 12, "stockoutDate": "2026-03-27", "restockQty": 500, "restockDate": "2026-03-20", "status": "warning", "trend": [45, 42, 38, 35, 32, 30, 28], "avgCost": 45.20, "shipDays": 7},
    {"id": "inv-002", "sku": "EB-002", "name": "Wireless Earbuds Elite", "stock": 1250, "dailySales": 45, "ratioDays": 28, "stockoutDate": "2026-04-12", "restockQty": 800, "restockDate": "2026-04-01", "status": "normal", "trend": [50, 48, 52, 50, 48, 46, 45], "avgCost": 18.50, "shipDays": 5},
    {"id": "inv-003", "sku": "WB-003", "name": "Eco Water Bottle 32oz", "stock": 89, "dailySales": 32, "ratioDays": 3, "stockoutDate": "2026-03-18", "restockQty": 600, "restockDate": "2026-03-16", "status": "caution", "trend": [25, 28, 30, 32, 35, 33, 32], "avgCost": 8.90, "shipDays": 3},
    {"id": "inv-004", "sku": "LS-004", "name": "LED Strip Lights 10m", "stock": 2100, "dailySales": 15, "ratioDays": 140, "stockoutDate": "2026-08-02", "restockQty": 0, "restockDate": None, "status": "stale", "trend": [20, 18, 16, 15, 14, 15, 15], "avgCost": 12.30, "shipDays": 10},
    {"id": "inv-005", "sku": "PB-005", "name": "Portable Blender USB-C", "stock": 567, "dailySales": 38, "ratioDays": 15, "stockoutDate": "2026-03-30", "restockQty": 400, "restockDate": "2026-03-25", "status": "normal", "trend": [30, 32, 35, 38, 40, 38, 38], "avgCost": 15.60, "shipDays": 5},
    {"id": "inv-006", "sku": "YM-006", "name": "Premium Yoga Mat", "stock": 45, "dailySales": 22, "ratioDays": 2, "stockoutDate": "2026-03-17", "restockQty": 300, "restockDate": "2026-03-16", "status": "warning", "trend": [18, 20, 22, 24, 22, 20, 22], "avgCost": 22.40, "shipDays": 4},
    {"id": "inv-007", "sku": "PS-007", "name": "Adjustable Phone Stand", "stock": 890, "dailySales": 25, "ratioDays": 36, "stockoutDate": "2026-04-20", "restockQty": 200, "restockDate": "2026-04-10", "status": "normal", "trend": [28, 26, 25, 24, 25, 26, 25], "avgCost": 6.80, "shipDays": 6},
    {"id": "inv-008", "sku": "CM-008", "name": "Car Phone Mount Magnetic", "stock": 0, "dailySales": 18, "ratioDays": 0, "stockoutDate": "2026-03-15", "restockQty": 400, "restockDate": "2026-03-18", "status": "stale", "trend": [22, 20, 18, 16, 14, 12, 0], "avgCost": 9.20, "shipDays": 7},
    {"id": "inv-009", "sku": "BK-009", "name": "Bamboo Kitchen Set", "stock": 2340, "dailySales": 8, "ratioDays": 293, "stockoutDate": "2027-01-02", "restockQty": 0, "restockDate": None, "status": "overstock", "trend": [12, 10, 10, 9, 8, 8, 8], "avgCost": 14.50, "shipDays": 12},
    {"id": "inv-010", "sku": "FL-010", "name": "Fidget Slider Deluxe", "stock": 456, "dailySales": 52, "ratioDays": 9, "stockoutDate": "2026-03-24", "restockQty": 700, "restockDate": "2026-03-20", "status": "warning", "trend": [35, 40, 45, 48, 50, 52, 52], "avgCost": 3.20, "shipDays": 4},
    {"id": "inv-011", "sku": "GC-011", "name": "Gaming Chair Ergonomic", "stock": 123, "dailySales": 5, "ratioDays": 25, "stockoutDate": "2026-04-09", "restockQty": 50, "restockDate": "2026-04-01", "status": "normal", "trend": [6, 5, 5, 6, 5, 5, 5], "avgCost": 89.00, "shipDays": 14},
    {"id": "inv-012", "sku": "SP-012", "name": "Solar Power Bank 20000mAh", "stock": 780, "dailySales": 30, "ratioDays": 26, "stockoutDate": "2026-04-10", "restockQty": 300, "restockDate": "2026-04-01", "status": "normal", "trend": [28, 30, 32, 30, 28, 30, 30], "avgCost": 28.90, "shipDays": 8},
]

restock_suggestions: list[dict] = [
    {"sku": "WB-003", "name": "Eco Water Bottle 32oz", "currentStock": 89, "dailySales": 32, "suggestedQty": 600, "urgency": "high", "shipMethod": "Air Express", "estimatedArrival": "2026-03-19"},
    {"sku": "YM-006", "name": "Premium Yoga Mat", "currentStock": 45, "dailySales": 22, "suggestedQty": 300, "urgency": "high", "shipMethod": "Air Express", "estimatedArrival": "2026-03-19"},
    {"sku": "WH-001", "name": "Smart Home Hub Pro", "currentStock": 342, "dailySales": 28, "suggestedQty": 500, "urgency": "medium", "shipMethod": "Air Freight", "estimatedArrival": "2026-03-22"},
    {"sku": "FL-010", "name": "Fidget Slider Deluxe", "currentStock": 456, "dailySales": 52, "suggestedQty": 700, "urgency": "medium", "shipMethod": "Air Freight", "estimatedArrival": "2026-03-22"},
    {"sku": "PB-005", "name": "Portable Blender USB-C", "currentStock": 567, "dailySales": 38, "suggestedQty": 400, "urgency": "low", "shipMethod": "Sea Freight", "estimatedArrival": "2026-04-15"},
]

competitor_keywords: dict = {
    "core": [
        {"keyword": "smart home hub", "volume": 45000, "cpc": 2.45, "trend": [38000, 39500, 41000, 42000, 43500, 45000], "type": "core"},
        {"keyword": "home automation", "volume": 38000, "cpc": 2.10, "trend": [32000, 33500, 35000, 36000, 37000, 38000], "type": "core"},
        {"keyword": "wifi smart speaker", "volume": 28000, "cpc": 1.85, "trend": [25000, 25500, 26000, 26500, 27000, 28000], "type": "core"},
        {"keyword": "voice control hub", "volume": 22000, "cpc": 1.95, "trend": [18000, 19000, 19500, 20000, 21000, 22000], "type": "core"},
        {"keyword": "smart home controller", "volume": 15000, "cpc": 1.65, "trend": [14000, 14200, 14500, 14700, 14900, 15000], "type": "core"},
        {"keyword": "iot hub device", "volume": 12000, "cpc": 1.45, "trend": [10000, 10500, 11000, 11200, 11500, 12000], "type": "core"},
    ],
    "longtail": [
        {"keyword": "smart home hub alexa compatible", "volume": 8500, "cpc": 1.20, "trend": [7000, 7300, 7600, 7900, 8200, 8500], "type": "longtail"},
        {"keyword": "wifi 6e smart home controller", "volume": 3200, "cpc": 0.85, "trend": [2500, 2700, 2800, 2900, 3000, 3200], "type": "longtail"},
        {"keyword": "best smart home hub 2026", "volume": 12000, "cpc": 1.55, "trend": [9000, 9800, 10500, 11000, 11500, 12000], "type": "longtail"},
        {"keyword": "smart home hub with voice control", "volume": 6800, "cpc": 1.10, "trend": [5500, 5800, 6000, 6200, 6500, 6800], "type": "longtail"},
        {"keyword": "affordable smart home starter kit", "volume": 9500, "cpc": 1.30, "trend": [8000, 8300, 8600, 8900, 9200, 9500], "type": "longtail"},
        {"keyword": "smart home hub for apple homekit", "volume": 5600, "cpc": 1.05, "trend": [4800, 5000, 5100, 5200, 5400, 5600], "type": "longtail"},
    ],
    "competitor": [
        {"keyword": "echo hub alternative", "volume": 7200, "cpc": 1.75, "trend": [6000, 6300, 6500, 6700, 6900, 7200], "type": "competitor"},
        {"keyword": "google nest hub competitor", "volume": 5800, "cpc": 1.60, "trend": [5000, 5200, 5300, 5400, 5600, 5800], "type": "competitor"},
        {"keyword": "best homekit hub 2026", "volume": 4500, "cpc": 1.40, "trend": [3800, 4000, 4100, 4200, 4300, 4500], "type": "competitor"},
        {"keyword": "smartthings hub vs", "volume": 9800, "cpc": 1.90, "trend": [8000, 8400, 8700, 9000, 9400, 9800], "type": "competitor"},
        {"keyword": "alexa echo show alternative", "volume": 6400, "cpc": 1.50, "trend": [5500, 5700, 5800, 6000, 6200, 6400], "type": "competitor"},
    ],
}

competitors: list[dict] = [
    {"id": "comp-001", "name": "TechHome Inc.", "spCount": 85, "sbCount": 42, "sdCount": 28, "keywords": 12, "rank": 3, "strategy": "offensive"},
    {"id": "comp-002", "name": "SmartLiving Co.", "spCount": 72, "sbCount": 38, "sdCount": 15, "keywords": 8, "rank": 5, "strategy": "complementary"},
    {"id": "comp-003", "name": "HomeAuto Pro", "spCount": 95, "sbCount": 55, "sdCount": 42, "keywords": 18, "rank": 1, "strategy": "offensive"},
    {"id": "comp-004", "name": "IoT Solutions Ltd.", "spCount": 45, "sbCount": 22, "sdCount": 10, "keywords": 5, "rank": 12, "strategy": "complementary"},
    {"id": "comp-005", "name": "VoiceFirst Tech", "spCount": 68, "sbCount": 35, "sdCount": 20, "keywords": 10, "rank": 7, "strategy": "defensive"},
]

ad_positions: list[dict] = [
    {"position": "Top of Search", "share": 42, "trend": [35, 37, 38, 40, 41, 42]},
    {"position": "Rest of Search", "share": 28, "trend": [30, 31, 30, 29, 28, 28]},
    {"position": "Product Pages", "share": 18, "trend": [20, 19, 19, 18, 18, 18]},
    {"position": "Sponsored Brands", "share": 8, "trend": [10, 9, 9, 9, 8, 8]},
    {"position": "Sponsored Display", "share": 4, "trend": [5, 5, 4, 4, 4, 4]},
]
