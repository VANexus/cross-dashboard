from __future__ import annotations

import copy
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from mock_data import MEMORY_ENTRIES, paginate, gen_id, now_iso

router = APIRouter(prefix="/api/memory", tags=["memory"])


@router.get("")
async def get_memories(
    zone: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    verified: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1),
    pageSize: int = Query(50),
):
    result = copy.deepcopy(MEMORY_ENTRIES)
    if zone:
        result = [m for m in result if m["zone"] == zone]
    if type:
        result = [m for m in result if m["type"] == type]
    if verified is not None:
        is_verified = verified.lower() == "true"
        result = [m for m in result if m["verified"] == is_verified]
    if search:
        q = search.lower()
        result = [m for m in result if q in m["title"].lower() or q in m["content"].lower()]
    paged = paginate(result, page, pageSize)
    return {"success": True, "data": paged["items"], "pagination": paged["pagination"]}


@router.post("")
async def create_memory(body: dict):
    new_memory = {
        "id": gen_id("mem"),
        "zone": body.get("zone", "dev"),
        "title": body.get("title", ""),
        "content": body.get("content", ""),
        "type": body.get("type", "script"),
        "version": 1,
        "createdAt": now_iso(),
        "updatedAt": now_iso(),
        "verified": False,
        "tags": body.get("tags", []),
    }
    MEMORY_ENTRIES.append(new_memory)
    return {"success": True, "data": copy.deepcopy(new_memory)}


@router.get("/{memory_id}")
async def get_memory(memory_id: str):
    memory = next((m for m in MEMORY_ENTRIES if m["id"] == memory_id), None)
    if not memory:
        raise HTTPException(status_code=404, detail=f"Memory {memory_id} not found")
    return {"success": True, "data": copy.deepcopy(memory)}


@router.put("/{memory_id}")
async def update_memory(memory_id: str, body: dict):
    memory = next((m for m in MEMORY_ENTRIES if m["id"] == memory_id), None)
    if not memory:
        raise HTTPException(status_code=404, detail=f"Memory {memory_id} not found")
    for key in ["zone", "title", "content", "type", "tags"]:
        if key in body:
            memory[key] = body[key]
    memory["version"] += 1
    memory["updatedAt"] = now_iso()
    return {"success": True, "data": copy.deepcopy(memory)}


@router.delete("/{memory_id}")
async def delete_memory(memory_id: str):
    idx = next((i for i, m in enumerate(MEMORY_ENTRIES) if m["id"] == memory_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail=f"Memory {memory_id} not found")
    MEMORY_ENTRIES.pop(idx)
    return {"success": True, "data": {"id": memory_id, "deleted": True}}


@router.get("/{memory_id}/usage")
async def get_memory_usage(memory_id: str):
    memory = next((m for m in MEMORY_ENTRIES if m["id"] == memory_id), None)
    if not memory:
        raise HTTPException(status_code=404, detail=f"Memory {memory_id} not found")
    return {
        "success": True,
        "data": {
            "memoryId": memory_id,
            "count": 47,
            "trend": [3, 5, 2, 4, 6, 3, 4],
            "created": memory["createdAt"],
            "modified": memory["updatedAt"],
            "workflows": ["Product Research", "AI Listing", "Competitor Ads"],
        },
    }
