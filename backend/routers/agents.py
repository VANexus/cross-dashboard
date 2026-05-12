from __future__ import annotations

import copy

from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from mock_data import AGENTS

router = APIRouter(prefix="/api/agents", tags=["agents"])


@router.get("")
async def get_agents(
    status: Optional[str] = Query(None),
    type: Optional[str] = Query(None, alias="type"),
):
    result = copy.deepcopy(AGENTS)
    if status:
        result = [a for a in result if a["status"] == status]
    if type:
        result = [a for a in result if a["type"] == type]
    return {
        "success": True,
        "data": result,
        "pagination": {"page": 1, "pageSize": 50, "total": len(result), "totalPages": 1},
    }


@router.get("/{agent_id}")
async def get_agent(agent_id: str):
    agent = next((a for a in AGENTS if a["id"] == agent_id), None)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found")
    return {"success": True, "data": copy.deepcopy(agent)}
