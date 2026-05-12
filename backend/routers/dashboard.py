from __future__ import annotations

from fastapi import APIRouter

import copy

from mock_data import (
    ALERTS,
    BUSINESS_METRICS,
    DASHBOARD_STATS,
    SYSTEM_METRICS,
    TRENDS,
    WORKFLOW_STATUSES,
)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
async def get_dashboard():
    return {
        "success": True,
        "data": {
            "stats": copy.deepcopy(DASHBOARD_STATS),
            "businessMetrics": copy.deepcopy(BUSINESS_METRICS),
            "workflows": copy.deepcopy(WORKFLOW_STATUSES),
            "alerts": copy.deepcopy(ALERTS),
            "trends": copy.deepcopy(TRENDS),
        },
    }
