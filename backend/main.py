import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import dashboard, agents, tasks, risk, memory, evolution, workflows

app = FastAPI(title="FlowMind Test Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard.router)
app.include_router(agents.router)
app.include_router(tasks.router)
app.include_router(risk.router)
app.include_router(memory.router)
app.include_router(evolution.router)
app.include_router(workflows.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
