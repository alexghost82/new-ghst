"""Pydantic models for local VLM (vLLM/Ollama) scene-analysis JSON."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

RiskLevel = Literal["none", "low", "medium", "high", "critical", "unknown"]


class LocalVlmObject(BaseModel):
    """A single detected entity in a local VLM scene analysis."""

    name: str = ""
    object_type: str = ""
    description: str = ""
    confidence: Optional[float] = None
    position: str = ""


class LocalVlmSceneAnalysis(BaseModel):
    """Structured scene analysis returned by :func:`analyze_scene_structured`."""

    summary: str = ""
    risk_level: RiskLevel = "unknown"
    objects: list[LocalVlmObject] = Field(default_factory=list)
    actions: list[str] = Field(default_factory=list)
    recommended_alert: bool = False
    raw_text: Optional[str] = None

    @classmethod
    def empty(cls, *, raw_text: str | None = None) -> LocalVlmSceneAnalysis:
        return cls(
            summary="",
            risk_level="unknown",
            objects=[],
            actions=[],
            recommended_alert=False,
            raw_text=raw_text,
        )

    def to_dict(self) -> dict:
        return self.model_dump(exclude_none=True)
