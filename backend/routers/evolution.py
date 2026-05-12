from __future__ import annotations

import copy
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from mock_data import EVOLUTION_RECORDS, paginate, gen_id, now_iso

router = APIRouter(prefix="/api/evolution", tags=["evolution"])


@router.get("/trend")
async def get_evolution_trend(months: int = Query(6)):
    trend_data = []
    base_values = [72, 75, 78, 82, 85, 88]
    for i in range(min(months, len(base_values))):
        trend_data.append({
            "month": f"2026-{str(3 - (months - 1 - i)).zfill(2)}",
            "accuracy": base_values[i],
            "latency": 320 - i * 20,
            "coverage": 60 + i * 5,
        })
    return {"success": True, "data": trend_data}


@router.get("")
async def get_evolution_records(
    stage: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1),
    pageSize: int = Query(50),
):
    result = copy.deepcopy(EVOLUTION_RECORDS)
    if stage:
        result = [e for e in result if e["stage"] == stage]
    if status:
        result = [e for e in result if e["status"] == status]
    if search:
        q = search.lower()
        result = [e for e in result if q in e["title"].lower() or q in e["description"].lower()]
    paged = paginate(result, page, pageSize)
    return {"success": True, "data": paged["items"], "pagination": paged["pagination"]}


@router.post("")
async def create_evolution(body: dict):
    new_record = {
        "id": gen_id("evo"),
        "stage": body.get("stage", "identify"),
        "title": body.get("title", ""),
        "description": body.get("description", ""),
        "agentId": body.get("agentId", ""),
        "startedAt": now_iso(),
        "completedAt": None,
        "status": "in_progress",
        "metrics": None,
    }
    EVOLUTION_RECORDS.append(new_record)
    return {"success": True, "data": copy.deepcopy(new_record)}


@router.get("/{record_id}")
async def get_evolution_record(record_id: str):
    record = next((e for e in EVOLUTION_RECORDS if e["id"] == record_id), None)
    if not record:
        raise HTTPException(status_code=404, detail=f"Evolution record {record_id} not found")
    return {"success": True, "data": copy.deepcopy(record)}


@router.patch("/{record_id}")
async def update_evolution(record_id: str, body: dict):
    record = next((e for e in EVOLUTION_RECORDS if e["id"] == record_id), None)
    if not record:
        raise HTTPException(status_code=404, detail=f"Evolution record {record_id} not found")
    for key in ["status", "completedAt", "metrics"]:
        if key in body:
            record[key] = body[key]
    return {"success": True, "data": copy.deepcopy(record)}
