"""Pop-Up Card Creator backend.

Thin FastAPI service: project persistence and (later) any geometry work that
outgrows the client. All fold kinematics currently live in the frontend's
`src/core` module; this service only stores and returns parametric designs.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .models import Project
from .storage import ProjectStore

app = FastAPI(title="Pop-Up Card Creator API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

store = ProjectStore()


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/projects")
def list_projects() -> list[Project]:
    return store.list()


@app.post("/api/projects", status_code=201)
def create_project(project: Project) -> Project:
    return store.save(project)


@app.get("/api/projects/{project_id}")
def get_project(project_id: str) -> Project:
    project = store.get(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project
