from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class RawSignal:
    text: str
    url: Optional[str]
    timestamp: str
    hash: str = ""
    source: str = ""
    source_id: Optional[str] = None
    source_type: Optional[str] = None
    metrics: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CompressedSignal:
    raw: RawSignal
    problem: str
    pain_level: int
    domain: str
    implicit_need: str
    keywords: List[str]


@dataclass
class MatchResult:
    signal_index: int
    match_id: Optional[str]


@dataclass
class NewIdea:
    title: str
    description: str
    mvp_scope: str
    tags: List[str]
    why_now: str
    keywords: List[str]
    initial_pain: float
    initial_novelty: float
    initial_buildability: float


@dataclass
class IdeaRecord:
    id: str
    title: str
    description: Optional[str]
    mvp_scope: Optional[str]
    tags: List[str]
    keywords: List[str]
    why_now: Optional[str]
    pain: float
    novelty: float
    buildability: float
    saturation: float
    saturation_updated_at: Optional[str]
    computed_score: float
    signal_count: int
    recent_signal_count: int
    user_score: Optional[float]
    user_status: str
    prompt_version: Optional[str]
    created_at: str
    updated_at: str
    last_signal_at: Optional[str]


@dataclass
class SourceResult:
    source_id: str
    source_type: str
    success: bool
    error: Optional[str]
    signals: List[RawSignal] = field(default_factory=list)
