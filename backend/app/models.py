"""Pydantic mirrors of the frontend's `src/core/types.ts`.

Dimensions are millimetres throughout, matching the laser-native units used
by the flat-pattern engine.
"""

from uuid import uuid4

from pydantic import BaseModel, Field


class CardParams(BaseModel):
    panel_width_mm: float = Field(gt=0, default=130)
    height_mm: float = Field(gt=0, default=180)


class Project(BaseModel):
    id: str = Field(default_factory=lambda: uuid4().hex)
    name: str = "Untitled card"
    card: CardParams = CardParams()
    # Mechanism parameter lists (V-folds, parallel folds) are added here as
    # the corresponding frontend types land.
