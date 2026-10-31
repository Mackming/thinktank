from pydantic import BaseModel, Field
from typing import List, Optional, Union, Dict, Any
from datetime import datetime

class AgentThought(BaseModel):
    thought_process: str = Field(description="Internal reasoning and analysis before answering.")
    main_argument: str = Field(description="The primary argument or idea being put forward.")
    confidence_score: int = Field(description="A confidence score between 0 and 100.")
    citations: List[str] = Field(default_factory=list, description="List of book citations e.g. '[Book Title, Page X]'")
    native_reasoning: Optional[str] = Field(default=None, description="Native model reasoning extracted from DOM.")
class Critique(BaseModel):
    identified_flaws: List[str]
    suggested_fixes: List[str]
    severity_score: int
    citations: List[str] = Field(default_factory=list)
    native_reasoning: Optional[str] = Field(default=None)
class FinalSynthesis(BaseModel):
    executive_summary: str
    action_plan: List[str]
    caveats_and_assumptions: List[str]
    citations: List[str] = Field(default_factory=list)

class CoachQuestion(BaseModel):
    probing_question: str = Field(description="The actual probing question for the user.")
    psychological_framework: Optional[str] = Field(default=None, description="The psychological or philosophical framework being applied.")
    intent: str = Field(description="The hidden intent or goal behind asking this question.")
    citations: List[str] = Field(default_factory=list)
    native_reasoning: Optional[str] = Field(default=None)

class WebSocketMessage(BaseModel):
    type: str
    agent_name: str
    content: Union[Dict[str, Any], str]
    timestamp: datetime
