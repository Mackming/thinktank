import json
import asyncio
from typing import Any, Dict, List
from datetime import datetime
from automation import browser_engine
from models import AgentThought, Critique, FinalSynthesis, CoachQuestion
import prompts
import database
import memory

MODELS = {
    "deepseek": "https://chat.deepseek.com",
    "qwen": "https://chat.qwen.ai/",
    "glm": "https://chat.z.ai/"
}

class ThinkTankOrchestrator:
    def __init__(self, websocket, active_models=None, co_pilot_mode: bool = False):
        self.ws = websocket
        self.active_models = active_models or ["deepseek", "qwen", "glm"]
        self.interjection_queue = asyncio.Queue()
        self.co_pilot_mode = co_pilot_mode
        self.continue_event = asyncio.Event()
        self.stop_requested = asyncio.Event()

    async def broadcast(self, msg_type: str, agent_name: str, message: str, content: Any = None):
        payload = {
            "type": msg_type,
            "agent_name": agent_name.capitalize(),
            "message": message,
            "content": content,
            "timestamp": datetime.now().isoformat()
        }
        print(f"[ORCHESTRATOR] {agent_name} ({msg_type}): {message}")
        if content:
            print(f"[CONTENT] {content}")
        await self.ws.send_json(payload)

    async def enforce_json(self, url: str, agent_name: str, model_class, response_text: str, max_retries=2):
        from json_utils import bulletproof_parse
        for attempt in range(max_retries):
            try:
                parsed = bulletproof_parse(response_text)
                validated = model_class(**parsed)
                return validated.model_dump()
            except Exception as e:
                if attempt == max_retries - 1:
                    raise Exception(f"Failed to parse JSON from {agent_name} after {max_retries} attempts. Error: {str(e)}")
                await self.broadcast("error", agent_name, f"JSON parsing failed. Requesting repair (Attempt {attempt+1})...")
                repair_prompt = f"Your previous response was not valid JSON. Please fix it and output ONLY valid JSON wrapped in <THINK_JSON> tags. Error: {str(e)}"
                await browser_engine.send_prompt(url, repair_prompt)
                await browser_engine.wait_for_completion(url)
                response_text = await browser_engine.get_last_response(url)

    async def _check_agent_health(self, url: str, agent_name: str) -> bool:
        diag = await browser_engine.diagnose_page(url)
        if diag["healthy"]:
            return True
        for issue in diag["issues"]:
            severity = issue["severity"]
            msg_type = "error" if severity == "critical" else "warning"
            await self.broadcast(msg_type, agent_name, f"⚠️ {issue['message']}")
        page = await browser_engine.get_page_for_url(url)
        await browser_engine.dismiss_popups(page)
        has_critical = any(i["severity"] == "critical" for i in diag["issues"])
        return not has_critical

    def _check_interjections(self) -> str:
        interjections = []
        try:
            while True:
                interjections.append(self.interjection_queue.get_nowait())
        except asyncio.QueueEmpty:
            pass
        if interjections:
            combined = " ".join(interjections)
            return f"\n\n🚨 CEO DIRECTIVE (from Co-Pilot Review): {combined}\n\n"
        return ""
        
    async def _handle_co_pilot_pause(self):
        if self.co_pilot_mode:
            await self.broadcast("status", "System", "Awaiting CEO Review...")
            self.continue_event.clear()
            await self.continue_event.wait()
            return self._check_interjections()
        return ""

    async def _fetch_context(self, master_prompt: str, space_id: int = None) -> str:
        past_memories = memory.query_memory(master_prompt, k=2)
        corporate_memory_prompt = ""
        if past_memories:
            corporate_memory_prompt = "\n\nCORPORATE MEMORY (Past successful strategies):\n" + "\n---\n".join(past_memories)
            await self.broadcast("status", "System", "Loaded Corporate Memory into context.")
            
        dossier_prompt = ""
        if space_id:
            excerpts = memory.query_knowledge(master_prompt, space_id, k=5)
            if excerpts:
                dossier_prompt = f"\n\nCORE PHILOSOPHY EXCERPTS (Context Dossier):\n{excerpts}\n\nINSTRUCTION: You are the user's personal Council of Mentors. Base your arguments heavily on the provided Core Philosophy excerpts."
                await self.broadcast("status", "System", "Loaded Context Dossier from Library into context.")
        return corporate_memory_prompt + dossier_prompt

    async def _run_agent_turn(self, agent_name: str, url: str, prompt: str, schema_class, role_badge: str):
        if not await self._check_agent_health(url, agent_name):
            raise Exception(f"{agent_name} agent has a critical issue. Check the browser and retry.")
            
        await self.broadcast("status", agent_name, f"Generating response for role: {role_badge}...")
        await browser_engine.send_prompt(url, prompt)
        await browser_engine.wait_for_completion(url, stop_event=self.stop_requested)
        raw_resp = await browser_engine.get_last_response(url)
        await self.broadcast("status", agent_name, "Enforcing JSON schema...")
        data = await self.enforce_json(url, agent_name, schema_class, raw_resp)
        
        native_reasoning = await browser_engine.get_native_reasoning(url)
        if native_reasoning:
            data["native_reasoning"] = native_reasoning
            
        data["current_role"] = role_badge
        await self.broadcast("success", agent_name, "Turn generated successfully.", data)
        return data

    async def _run_debate(self, master_prompt: str, combined_context: str):
        transcript = []
        max_rounds = 4
        ceo_feedback = ""
        proposer = self.active_models[0]
        critic = self.active_models[1] if len(self.active_models) > 1 else self.active_models[0]
        synthesizer = self.active_models[-1]
        
        prop_url = MODELS[proposer]
        crit_url = MODELS[critic]
        synth_url = MODELS[synthesizer]
        
        arch_data = None
        vision_data = None
        
        try:
            for round_num in range(1, max_rounds + 1):
                await self.broadcast("round_update", "System", f"Starting Round {round_num}/{max_rounds}", {"round": round_num, "max": max_rounds})

                # Proposer Turn
                if round_num == 1:
                    prop_prompt = prompts.build_proposer_prompt(master_prompt + combined_context, round_num=1)
                else:
                    prop_prompt = prompts.build_proposer_prompt(master_prompt, round_num=round_num, previous_critique=json.dumps(arch_data))
                prop_prompt += ceo_feedback + self._check_interjections()
                
                vision_data = await self._run_agent_turn(proposer, prop_url, prop_prompt, AgentThought, "Proposer")
                transcript.append({"round": round_num, "role": proposer, "content": vision_data})
                ceo_feedback = await self._handle_co_pilot_pause()

                # Critic Turn
                crit_prompt = prompts.build_critic_prompt(json.dumps(vision_data), round_num=round_num)
                crit_prompt += combined_context + ceo_feedback + self._check_interjections()
                
                arch_data = await self._run_agent_turn(critic, crit_url, crit_prompt, Critique, "Critic")
                transcript.append({"round": round_num, "role": critic, "content": arch_data})
                ceo_feedback = await self._handle_co_pilot_pause()

                # Convergence
                if arch_data.get("severity_score", 100) <= 3 and vision_data.get("confidence_score", 0) > 85:
                    await self.broadcast("status", "System", "🔥 Debate converged! Severity low, confidence high.")
                    break

        except asyncio.CancelledError:
            await self.broadcast("warning", "System", "🚨 Debate abruptly halted. Forcing immediate synthesis.")

        # Synthesizer Turn
        synth_prompt = prompts.build_synthesizer_prompt(master_prompt, transcript)
        if self.stop_requested.is_set():
            synth_prompt = f"🚨 CEO OVERRIDE: The debate was halted. Synthesize based ONLY on the transcript provided.\n\nTranscript: {json.dumps(transcript)}"
        synth_prompt += combined_context + ceo_feedback + self._check_interjections()
        
        synth_data = await self._run_agent_turn(synthesizer, synth_url, synth_prompt, FinalSynthesis, "Synthesizer")
        return transcript, synth_data

    async def _run_collaborate(self, master_prompt: str, combined_context: str):
        transcript = []
        if len(self.active_models) == 1:
            worker = self.active_models[0]
            await self.broadcast("status", "System", "Only 1 model active. Falling back to sequential solo work.")
            prompt = prompts.build_parallel_worker_prompt(master_prompt, combined_context)
            data = await self._run_agent_turn(worker, MODELS[worker], prompt, AgentThought, "Solo Worker")
            transcript.append({"role": worker, "content": data})
            return transcript, {"executive_summary": data.get("main_argument"), "action_plan": [], "caveats_and_assumptions": []}
            
        await self.broadcast("status", "System", "Splitting task for parallel execution...")
        tasks = []
        for i, model in enumerate(self.active_models):
            prompt = prompts.build_parallel_worker_prompt(master_prompt, f"Focus on angle/perspective {i+1} of {len(self.active_models)}.\\n{combined_context}")
            tasks.append(self._run_agent_turn(model, MODELS[model], prompt, AgentThought, f"Parallel Worker {i+1}"))
            
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for i, res in enumerate(results):
            if isinstance(res, Exception):
                await self.broadcast("error", self.active_models[i], f"Parallel execution failed: {str(res)}")
            else:
                transcript.append({"role": self.active_models[i], "content": res})

        # Final Merge by last active model
        synthesizer = self.active_models[-1]
        synth_prompt = prompts.build_synthesizer_prompt(master_prompt, transcript) + combined_context
        synth_data = await self._run_agent_turn(synthesizer, MODELS[synthesizer], synth_prompt, FinalSynthesis, "Merge Synthesizer")
        
        return transcript, synth_data

    async def _run_refine(self, master_prompt: str, combined_context: str):
        transcript = []
        roles = ["Drafter", "Editor", "Polisher"]
        models = self.active_models
        # if only 1 model, it plays all 3 roles
        ceo_feedback = ""
        current_text = ""
        
        for i, role in enumerate(roles):
            model = models[i % len(models)]
            prompt = prompts.build_refinement_prompt(master_prompt, role, current_text)
            prompt += combined_context + ceo_feedback + self._check_interjections()
            
            data = await self._run_agent_turn(model, MODELS[model], prompt, AgentThought, role)
            transcript.append({"round": i+1, "role": model, "content": data})
            current_text = data.get("main_argument", "")
            ceo_feedback = await self._handle_co_pilot_pause()
            
            if self.stop_requested.is_set():
                break

        synth_data = {"executive_summary": current_text, "action_plan": ["Refinement complete"], "caveats_and_assumptions": []}
        return transcript, synth_data

    async def _run_coach(self, master_prompt: str, combined_context: str):
        transcript = []
        max_turns = 5
        models = self.active_models
        previous_answers = []
        ceo_feedback = ""
        
        for turn in range(max_turns):
            model = models[turn % len(models)]
            prompt = prompts.build_coach_prompt(master_prompt, previous_answers)
            prompt += combined_context + ceo_feedback + self._check_interjections()
            
            data = await self._run_agent_turn(model, MODELS[model], prompt, CoachQuestion, "Coach")
            transcript.append({"round": turn+1, "role": model, "content": data})
            
            # Force co-pilot pause for user answer
            self.co_pilot_mode = True
            await self.broadcast("status", "System", "Coach is waiting for your answer...")
            answer = await self._handle_co_pilot_pause()
            previous_answers.append({"q": data.get("probing_question"), "a": answer})
            
            if self.stop_requested.is_set():
                break
                
        synth_data = {"executive_summary": "Coaching session completed.", "action_plan": [], "caveats_and_assumptions": []}
        return transcript, synth_data

    async def execute(self, mode: str, master_prompt: str, space_id: int = None):
        try:
            combined_context = await self._fetch_context(master_prompt, space_id)
            
            if mode == "debate":
                transcript, synth_data = await self._run_debate(master_prompt, combined_context)
            elif mode == "collaborate":
                transcript, synth_data = await self._run_collaborate(master_prompt, combined_context)
            elif mode == "refine":
                transcript, synth_data = await self._run_refine(master_prompt, combined_context)
            elif mode == "coach":
                transcript, synth_data = await self._run_coach(master_prompt, combined_context)
            else:
                raise ValueError(f"Unknown mode: {mode}")

            # Save to Vault and Memory
            try:
                session_id = database.save_session(master_prompt, json.dumps(transcript), json.dumps(synth_data))
                memory.store_memory(master_prompt, json.dumps(synth_data), str(session_id))
                await self.broadcast("status", "System", f"Session saved to Vault (ID {session_id}) and Corporate Memory.")
            except Exception as e:
                await self.broadcast("error", "System", f"Failed to save session: {e}")

            await self.broadcast("status", "System", "✅ Workflow complete.")
            
        except asyncio.CancelledError:
            pass # Already handled gracefully
        except Exception as e:
            await self.broadcast("error", "System", f"Workflow failed: {str(e)}")
