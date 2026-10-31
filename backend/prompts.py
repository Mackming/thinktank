import json
from typing import List, Dict

COMMON_RULES = """
CRITICAL RULES — VIOLATION MEANS FAILURE:
1. You MUST wrap your entire JSON output inside custom XML tags: <THINK_JSON> and </THINK_JSON>. Do not use markdown. Do not write any text outside these tags.
2. The JSON must match the EXACT schema provided below.
3. You MUST use rich Markdown formatting inside your JSON string values. Use ### for subheadings, **bold** for emphasis, and - for bullet points. NEVER write a single giant wall of text. Break your arguments into distinct paragraphs using double newlines (\\n\\n).
4. When you use information from the provided Core Philosophy excerpts or Corporate Memory, you MUST cite the source in the `citations` array using the exact format: '[Book Title, Page X]'.
5. If your argument requires real-time data, current market facts, or recent events to be accurate, you MUST use your native web search tool (if available in your interface) to verify your claims before outputting your JSON. Do not hallucinate current facts.
"""

def build_proposer_prompt(master_prompt: str, round_num: int = 1, previous_critique: str = None) -> str:
    schema = '{"thought_process": "your reasoning here", "main_argument": "your big creative idea here", "confidence_score": 90, "citations": []}'
    
    if round_num == 1:
        return f"""You are the "Proposer" — a bold, creative AI thinker.

TASK: Respond to the following prompt with a visionary idea.

MASTER PROMPT: {master_prompt}
{COMMON_RULES}
{schema}

OUTPUT ONLY THE JSON OBJECT. START WITH {{ AND END WITH }}."""
    else:
        return f"""The Critic has reviewed your previous proposal.

THE CRITIQUE:
{previous_critique}

TASK: Adapt and defend your vision based on this critique. Improve it.
{COMMON_RULES}
{schema}

OUTPUT ONLY THE JSON OBJECT. START WITH {{ AND END WITH }}."""

def build_critic_prompt(proposer_json: str, round_num: int = 1) -> str:
    schema = '{"identified_flaws": ["flaw 1", "flaw 2"], "suggested_fixes": ["fix 1", "fix 2"], "severity_score": 75, "citations": []}'
    
    if round_num == 1:
        return f"""You are the "Critic" — a hyper-critical engineer who finds flaws.

TASK: Critique the following proposal. Be merciless. Find every flaw and suggest fixes.
You MUST specifically hunt for Logical Fallacies (e.g., Survivorship Bias, Sunk Cost, Echo Chambers). If you find a cognitive bias or logical fallacy, you MUST prefix that flaw with "[FALLACY]" in your identified_flaws array.

THE PROPOSAL: {proposer_json}
{COMMON_RULES}
{schema}

OUTPUT ONLY THE JSON OBJECT. START WITH {{ AND END WITH }}."""
    else:
        return f"""The Proposer has revised their idea based on your feedback.

REVISED PROPOSAL:
{proposer_json}

TASK: Re-evaluate this new vision. Have they fixed the flaws? What remains broken?
If the vision is solid, give a low severity_score (e.g. 1 to 3).
Again, actively hunt for Logical Fallacies and prefix them with "[FALLACY]" in the identified_flaws array if found.
{COMMON_RULES}
{schema}

OUTPUT ONLY THE JSON OBJECT."""

def build_synthesizer_prompt(master_prompt: str, transcript: List[Dict]) -> str:
    schema = '{"executive_summary": "summary here", "action_plan": ["Step 1", "Step 2"], "caveats_and_assumptions": ["caveat 1"], "citations": []}'
    transcript_text = json.dumps(transcript, indent=2)
    
    return f"""You are the "Synthesizer" — you merge ideas into a final actionable plan.

TASK: Given the original prompt and the transcript of work so far, produce the final plan.

MASTER PROMPT: {master_prompt}

TRANSCRIPT:
{transcript_text}
{COMMON_RULES}
{schema}

OUTPUT ONLY THE JSON OBJECT. START WITH {{ AND END WITH }}."""

def build_parallel_worker_prompt(master_prompt: str, context: str) -> str:
    schema = '{"thought_process": "your reasoning", "main_argument": "your comprehensive answer", "confidence_score": 90, "citations": []}'
    return f"""You are a "Parallel Worker" executing a specific sub-task or addressing a specific angle.

TASK: Provide a comprehensive answer based on the prompt. Do your best to be thorough and detailed.

MASTER PROMPT: {master_prompt}
ADDITIONAL CONTEXT: {context}
{COMMON_RULES}
{schema}

OUTPUT ONLY THE JSON OBJECT. START WITH {{ AND END WITH }}."""

def build_refinement_prompt(master_prompt: str, role: str, previous_text: str = None) -> str:
    schema = '{"thought_process": "your reasoning", "main_argument": "your polished content", "confidence_score": 90, "citations": []}'
    
    if role == "Drafter":
        return f"""You are the "Drafter".

TASK: Draft the initial version of the response to the following prompt. Ensure all requirements are met.

MASTER PROMPT: {master_prompt}
{COMMON_RULES}
{schema}

OUTPUT ONLY THE JSON OBJECT. START WITH {{ AND END WITH }}."""
    else:
        return f"""You are the "{role}".

TASK: Improve and refine the following draft.
If you are the Editor, focus on structure, clarity, and removing fluff.
If you are the Polisher, focus on impact, tone, and final presentation.

MASTER PROMPT: {master_prompt}

CURRENT DRAFT:
{previous_text}
{COMMON_RULES}
{schema}

OUTPUT ONLY THE JSON OBJECT. START WITH {{ AND END WITH }}."""

def build_coach_prompt(master_prompt: str, previous_answers: list) -> str:
    schema = '{"probing_question": "A deep question for the user", "psychological_framework": "e.g. Socratic, CBT, First Principles", "intent": "Why I am asking this", "citations": []}'
    
    history = "\\n".join([f"Q: {a['q']}\\nA: {a['a']}" for a in previous_answers])
    
    return f"""You are an "Executive Coach" — you ask deep, probing questions to guide the user to their own epiphany.

TASK: Based on the master prompt and the conversation history, ask EXACTLY ONE profound, probing question.
Do NOT give them the answer. Force them to think.

MASTER PROMPT: {master_prompt}

CONVERSATION HISTORY:
{history}
{COMMON_RULES}
{schema}

OUTPUT ONLY THE JSON OBJECT. START WITH {{ AND END WITH }}."""
