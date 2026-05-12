from __future__ import annotations

import copy
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from mock_data import (
    HEALTH_DIMENSIONS,
    ISOLATION_ITEMS,
    RISK_EVENTS,
    RISK_INDICATORS,
    gen_id,
    now_iso,
)

router = APIRouter(prefix="/api/risk", tags=["risk"])


@router.get("/events")
async def get_risk_events(
    level: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1),
    pageSize: int = Query(50),
):
    result = copy.deepcopy(RISK_EVENTS)
    if level:
        result = [e for e in result if e["level"] == level]
    if status == "resolved":
        result = [e for e in result if e["resolved"]]
    elif status == "active":
        result = [e for e in result if not e["resolved"]]
    if search:
        q = search.lower()
        result = [e for e in result if q in e["title"].lower() or q in e["description"].lower()]
    total = len(result)
    total_pages = max(1, -(-total // pageSize))
    start = (page - 1) * pageSize
    result = result[start:start + pageSize]
    return {
        "success": True,
        "data": result,
        "pagination": {"page": page, "pageSize": pageSize, "total": total, "totalPages": total_pages},
    }


@router.post("/events")
async def create_risk_event(body: dict):
    new_event = {
        "id": gen_id("risk"),
        "level": body.get("level", "level3"),
        "title": body.get("title", ""),
        "description": body.get("description", ""),
        "source": body.get("source", ""),
        "timestamp": now_iso(),
        "resolved": False,
        "resolvedAt": None,
        "actions": body.get("actions", []),
    }
    RISK_EVENTS.append(new_event)
    return {"success": True, "data": copy.deepcopy(new_event)}


@router.patch("/events/{event_id}")
async def update_risk_event(event_id: str, body: dict):
    event = next((e for e in RISK_EVENTS if e["id"] == event_id), None)
    if not event:
        raise HTTPException(status_code=404, detail=f"Risk event {event_id} not found")
    if "resolved" in body:
        event["resolved"] = body["resolved"]
        if body["resolved"]:
            event["resolvedAt"] = body.get("resolvedAt", now_iso())
        else:
            event["resolvedAt"] = None
    return {"success": True, "data": copy.deepcopy(event)}


@router.get("/health")
async def get_risk_health():
    return {
        "success": True,
        "data": {
            "dimensions": copy.deepcopy(HEALTH_DIMENSIONS),
            "riskIndicators": copy.deepcopy(RISK_INDICATORS),
        },
    }


@router.get("/isolation")
async def get_isolation():
    return {"success": True, "data": copy.deepcopy(ISOLATION_ITEMS)}


@router.patch("/isolation")
async def update_isolation(body: dict):
    idx = body.get("index", 0)
    checked = body.get("checked", False)
    if 0 <= idx < len(ISOLATION_ITEMS):
        ISOLATION_ITEMS[idx]["checked"] = checked
    return {"success": True, "data": copy.deepcopy(ISOLATION_ITEMS)}
