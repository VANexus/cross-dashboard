from __future__ import annotations

import copy
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from mock_data import TASKS, paginate, gen_id, now_iso

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.get("")
async def get_tasks(
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    agent: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1),
    pageSize: int = Query(20),
):
    result = copy.deepcopy(TASKS)
    if status:
        result = [t for t in result if t["status"] == status]
    if priority:
        result = [t for t in result if t["priority"] == priority]
    if agent:
        result = [t for t in result if agent in t["assignedAgents"]]
    if search:
        q = search.lower()
        result = [t for t in result if q in t["title"].lower() or q in t["description"].lower()]
    paged = paginate(result, page, pageSize)
    return {"success": True, "data": paged["items"], "pagination": paged["pagination"]}


@router.post("")
async def create_task(body: dict):
    new_task = {
        "id": gen_id("task"),
        "title": body.get("title", ""),
        "description": body.get("description", ""),
        "status": "pending",
        "priority": body.get("priority", "medium"),
        "assignedAgents": body.get("assignedAgents", []),
        "createdAt": now_iso(),
        "updatedAt": now_iso(),
        "completedAt": None,
        "output": None,
        "steps": [],
    }
    TASKS.append(new_task)
    return {"success": True, "data": copy.deepcopy(new_task)}


@router.get("/{task_id}")
async def get_task(task_id: str):
    task = next((t for t in TASKS if t["id"] == task_id), None)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    return {"success": True, "data": copy.deepcopy(task)}


@router.patch("/{task_id}")
async def update_task(task_id: str, body: dict):
    task = next((t for t in TASKS if t["id"] == task_id), None)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    for key in ["title", "description", "status", "priority"]:
        if key in body:
            task[key] = body[key]
    task["updatedAt"] = now_iso()
    if body.get("status") == "completed":
        task["completedAt"] = now_iso()
    return {"success": True, "data": copy.deepcopy(task)}


@router.delete("/{task_id}")
async def delete_task(task_id: str):
    idx = next((i for i, t in enumerate(TASKS) if t["id"] == task_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    TASKS.pop(idx)
    return {"success": True, "data": {"id": task_id, "deleted": True}}


@router.patch("/{task_id}/steps/{step_id}")
async def update_task_step(task_id: str, step_id: str, body: dict):
    task = next((t for t in TASKS if t["id"] == task_id), None)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    step = next((s for s in task["steps"] if s["id"] == step_id), None)
    if not step:
        raise HTTPException(status_code=404, detail=f"Step {step_id} not found")
    if "status" in body:
        step["status"] = body["status"]
        if body["status"] == "completed":
            step["completedAt"] = now_iso()
            next_pending = next((s for s in task["steps"] if s["status"] == "pending"), None)
            if next_pending:
                next_pending["status"] = "running"
                next_pending["startedAt"] = now_iso()
            elif all(s["status"] == "completed" for s in task["steps"]):
                task["status"] = "completed"
                task["completedAt"] = now_iso()
                final_step = task["steps"][-1]
                task["output"] = final_step.get("output") or task.get("output")
    if "output" in body:
        step["output"] = body["output"]
    task["updatedAt"] = now_iso()
    return {"success": True, "data": copy.deepcopy(task)}
