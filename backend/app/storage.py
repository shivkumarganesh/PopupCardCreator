"""JSON-file project persistence — deliberately simple until real needs appear."""

import json
from pathlib import Path

from .models import Project

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "projects.json"


class ProjectStore:
    def __init__(self, path: Path = DATA_FILE) -> None:
        self._path = path
        self._path.parent.mkdir(parents=True, exist_ok=True)

    def _read(self) -> dict[str, dict]:
        if not self._path.exists():
            return {}
        return json.loads(self._path.read_text())

    def _write(self, data: dict[str, dict]) -> None:
        self._path.write_text(json.dumps(data, indent=2))

    def list(self) -> list[Project]:
        return [Project(**raw) for raw in self._read().values()]

    def get(self, project_id: str) -> Project | None:
        raw = self._read().get(project_id)
        return Project(**raw) if raw else None

    def save(self, project: Project) -> Project:
        data = self._read()
        data[project.id] = project.model_dump()
        self._write(data)
        return project
