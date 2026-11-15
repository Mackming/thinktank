import os
import re
import time
import httpx
from typing import Dict, Any, Tuple, Optional
from dotenv import load_dotenv

# Ensure environment variables are loaded
load_dotenv()

DEFAULT_CONFIGS = {
    "deepseek": {
        "name": "DeepSeek",
        "default_base_url": "https://api.deepseek.com",
        "default_model": "deepseek-chat",
        "env_keys": ["DEEPSEEK_API_KEY"],
        "env_base": "DEEPSEEK_API_BASE",
        "env_model": "DEEPSEEK_MODEL",
        "openrouter_model": "deepseek/deepseek-chat",
        "openai_model": "gpt-4o"
    },
    "qwen": {
        "name": "Qwen",
        "default_base_url": "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
        "default_model": "qwen-plus",
        "env_keys": ["DASHSCOPE_API_KEY", "QWEN_API_KEY"],
        "env_base": "QWEN_API_BASE",
        "env_model": "QWEN_MODEL",
        "openrouter_model": "qwen/qwen-2.5-72b-instruct",
        "openai_model": "gpt-4o-mini"
    },
    "glm": {
        "name": "GLM (Zhipu AI)",
        "default_base_url": "https://open.bigmodel.cn/api/paas/v4",
        "default_model": "glm-4-flash",
        "env_keys": ["ZHIPUAI_API_KEY", "GLM_API_KEY"],
        "env_base": "GLM_API_BASE",
        "env_model": "GLM_MODEL",
        "openrouter_model": "thudm/glm-4-9b-chat",
        "openai_model": "gpt-4o-mini"
    }
}


class APIEngine:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(APIEngine, cls).__new__(cls)
            cls._instance._custom_config = {}
        return cls._instance

    def _normalize_endpoint(self, base_url: str) -> str:
        url = base_url.strip().rstrip('/')
        if url.endswith('/chat/completions'):
            return url
        return f"{url}/chat/completions"

    def get_agent_config(self, agent_name: str) -> Dict[str, Any]:
        """
        Resolve the effective API key, base_url, model, and provider for an agent.
        Precedence:
          1. In-memory custom config (if set via UI)
          2. Direct environment variables for the agent (e.g. DEEPSEEK_API_KEY)
          3. Universal fallback: OPENROUTER_API_KEY
          4. Universal fallback: OPENAI_API_KEY
        """
        agent = agent_name.lower().strip()
        custom = self._custom_config.get(agent, {})
        def_cfg = DEFAULT_CONFIGS.get(agent, {})

        # 1. Custom / in-memory config check
        if custom.get("api_key"):
            return {
                "agent": agent,
                "api_key": custom["api_key"],
                "base_url": custom.get("base_url") or def_cfg.get("default_base_url", "https://api.openai.com/v1"),
                "model": custom.get("model") or def_cfg.get("default_model", "gpt-4o"),
                "provider": "custom_override",
                "is_configured": True
            }

        # 2. Direct agent environment variables
        if def_cfg:
            for env_key in def_cfg["env_keys"]:
                val = os.getenv(env_key)
                if val and val.strip():
                    base_url = os.getenv(def_cfg["env_base"]) or def_cfg["default_base_url"]
                    model = os.getenv(def_cfg["env_model"]) or def_cfg["default_model"]
                    return {
                        "agent": agent,
                        "api_key": val.strip(),
                        "base_url": base_url.strip(),
                        "model": model.strip(),
                        "provider": "direct",
                        "is_configured": True
                    }

        # 3. Universal OpenRouter fallback
        openrouter_key = os.getenv("OPENROUTER_API_KEY") or self._custom_config.get("openrouter", {}).get("api_key")
        if openrouter_key and openrouter_key.strip():
            or_model = def_cfg.get("openrouter_model", "openai/gpt-4o") if def_cfg else "openai/gpt-4o"
            return {
                "agent": agent,
                "api_key": openrouter_key.strip(),
                "base_url": "https://openrouter.ai/api/v1",
                "model": or_model,
                "provider": "openrouter",
                "is_configured": True
            }

        # 4. Universal OpenAI fallback
        openai_key = os.getenv("OPENAI_API_KEY") or self._custom_config.get("openai", {}).get("api_key")
        if openai_key and openai_key.strip():
            oa_model = def_cfg.get("openai_model", "gpt-4o-mini") if def_cfg else "gpt-4o-mini"
            return {
                "agent": agent,
                "api_key": openai_key.strip(),
                "base_url": "https://api.openai.com/v1",
                "model": oa_model,
                "provider": "openai",
                "is_configured": True
            }

        # Not configured
        return {
            "agent": agent,
            "api_key": "",
            "base_url": def_cfg.get("default_base_url", ""),
            "model": def_cfg.get("default_model", ""),
            "provider": "none",
            "is_configured": False
        }

    def check_agent_configured(self, agent_name: str) -> Tuple[bool, str]:
        cfg = self.get_agent_config(agent_name)
        if cfg["is_configured"] and cfg["api_key"]:
            return True, f"Configured via {cfg['provider']}"
        def_keys = DEFAULT_CONFIGS.get(agent_name.lower(), {}).get("env_keys", [])
        return False, f"Missing API key. Set {' or '.join(def_keys)} or OPENROUTER_API_KEY/OPENAI_API_KEY"

    def get_status(self) -> Dict[str, Any]:
        """Returns safe configuration summary without leaking full secret keys."""
        agents_status = {}
        for agent_id, def_cfg in DEFAULT_CONFIGS.items():
            cfg = self.get_agent_config(agent_id)
            key = cfg.get("api_key", "")
            masked_key = ""
            if key:
                masked_key = f"{key[:4]}...{key[-4:]}" if len(key) > 8 else "••••••••"
            agents_status[agent_id] = {
                "name": def_cfg["name"],
                "configured": cfg["is_configured"],
                "masked_key": masked_key,
                "base_url": cfg["base_url"],
                "model": cfg["model"],
                "provider": cfg["provider"]
            }

        or_key = os.getenv("OPENROUTER_API_KEY") or self._custom_config.get("openrouter", {}).get("api_key", "")
        oa_key = os.getenv("OPENAI_API_KEY") or self._custom_config.get("openai", {}).get("api_key", "")

        return {
            "engine": "api",
            "agents": agents_status,
            "universal": {
                "openrouter_configured": bool(or_key),
                "openai_configured": bool(oa_key)
            }
        }

    def update_config(self, updates: Dict[str, Any], persist_to_env: bool = True):
        """
        Updates in-memory config and optionally saves to .env file.
        Format of updates:
        {
          "deepseek": {"api_key": "...", "base_url": "...", "model": "..."},
          "qwen": {"api_key": "...", ...},
          "glm": {"api_key": "...", ...},
          "openrouter": {"api_key": "..."},
          "openai": {"api_key": "..."}
        }
        """
        for k, v in updates.items():
            if isinstance(v, dict):
                self._custom_config[k.lower()] = v
                # Also set in os.environ if api_key given
                api_key = v.get("api_key")
                if api_key:
                    if k.lower() == "deepseek":
                        os.environ["DEEPSEEK_API_KEY"] = api_key
                    elif k.lower() == "qwen":
                        os.environ["DASHSCOPE_API_KEY"] = api_key
                    elif k.lower() == "glm":
                        os.environ["ZHIPUAI_API_KEY"] = api_key
                    elif k.lower() == "openrouter":
                        os.environ["OPENROUTER_API_KEY"] = api_key
                    elif k.lower() == "openai":
                        os.environ["OPENAI_API_KEY"] = api_key

                if v.get("base_url"):
                    if k.lower() == "deepseek":
                        os.environ["DEEPSEEK_API_BASE"] = v["base_url"]
                    elif k.lower() == "qwen":
                        os.environ["QWEN_API_BASE"] = v["base_url"]
                    elif k.lower() == "glm":
                        os.environ["GLM_API_BASE"] = v["base_url"]

                if v.get("model"):
                    if k.lower() == "deepseek":
                        os.environ["DEEPSEEK_MODEL"] = v["model"]
                    elif k.lower() == "qwen":
                        os.environ["QWEN_MODEL"] = v["model"]
                    elif k.lower() == "glm":
                        os.environ["GLM_MODEL"] = v["model"]

        if persist_to_env:
            self._save_to_env_file()

    def _save_to_env_file(self):
        """Persist current configuration to .env in backend directory."""
        env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
        lines = []
        existing_keys = set()

        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    match = re.match(r'^\s*([A-Za-z_0-9]+)\s*=', line)
                    if match:
                        existing_keys.add(match.group(1))
                    lines.append(line)

        # Mapping of env variable to desired value
        target_vars = {}
        for agent_id, def_cfg in DEFAULT_CONFIGS.items():
            custom = self._custom_config.get(agent_id, {})
            if custom.get("api_key"):
                target_vars[def_cfg["env_keys"][0]] = custom["api_key"]
            if custom.get("base_url"):
                target_vars[def_cfg["env_base"]] = custom["base_url"]
            if custom.get("model"):
                target_vars[def_cfg["env_model"]] = custom["model"]

        if self._custom_config.get("openrouter", {}).get("api_key"):
            target_vars["OPENROUTER_API_KEY"] = self._custom_config["openrouter"]["api_key"]
        if self._custom_config.get("openai", {}).get("api_key"):
            target_vars["OPENAI_API_KEY"] = self._custom_config["openai"]["api_key"]

        # Write or update lines
        new_lines = []
        updated_keys = set()
        for line in lines:
            match = re.match(r'^\s*([A-Za-z_0-9]+)\s*=', line)
            if match and match.group(1) in target_vars:
                key = match.group(1)
                new_lines.append(f"{key}={target_vars[key]}\n")
                updated_keys.add(key)
            else:
                new_lines.append(line)

        for key, val in target_vars.items():
            if key not in updated_keys:
                if not new_lines or not new_lines[-1].endswith("\n"):
                    new_lines.append("\n")
                new_lines.append(f"{key}={val}\n")

        with open(env_path, "w", encoding="utf-8") as f:
            f.writelines(new_lines)

    async def verify_connection(self, agent_name: str) -> Dict[str, Any]:
        """Performs a lightweight verification call to test connectivity and credentials."""
        cfg = self.get_agent_config(agent_name)
        if not cfg["is_configured"]:
            return {
                "success": False,
                "agent": agent_name,
                "error": "No API key configured for this agent."
            }

        start_time = time.time()
        url = self._normalize_endpoint(cfg["base_url"])
        headers = {
            "Authorization": f"Bearer {cfg['api_key']}",
            "Content-Type": "application/json"
        }
        if "openrouter.ai" in url:
            headers["HTTP-Referer"] = "https://github.com/thinktank"
            headers["X-Title"] = "ThinkTank"

        payload = {
            "model": cfg["model"],
            "messages": [
                {"role": "user", "content": "Respond with the word OK."}
            ],
            "max_tokens": 10,
            "temperature": 0.1
        }

        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=10.0)) as client:
                resp = await client.post(url, json=payload, headers=headers)
                latency = round((time.time() - start_time) * 1000)
                if resp.status_code == 200:
                    return {
                        "success": True,
                        "agent": agent_name,
                        "latency_ms": latency,
                        "model": cfg["model"],
                        "provider": cfg["provider"]
                    }
                else:
                    return {
                        "success": False,
                        "agent": agent_name,
                        "latency_ms": latency,
                        "status_code": resp.status_code,
                        "error": f"API returned status {resp.status_code}: {resp.text[:200]}"
                    }
        except Exception as e:
            latency = round((time.time() - start_time) * 1000)
            return {
                "success": False,
                "agent": agent_name,
                "latency_ms": latency,
                "error": str(e)
            }

    async def query(self, agent_name: str, prompt: str, timeout_seconds: int = 150) -> Dict[str, Any]:
        """
        Sends prompt to the configured API provider for the agent.
        Returns:
          {
            "text": str,
            "native_reasoning": Optional[str],
            "latency_ms": int,
            "model": str
          }
        """
        cfg = self.get_agent_config(agent_name)
        if not cfg["is_configured"]:
            raise ValueError(f"Agent '{agent_name}' has no API key configured.")

        url = self._normalize_endpoint(cfg["base_url"])
        headers = {
            "Authorization": f"Bearer {cfg['api_key']}",
            "Content-Type": "application/json"
        }
        if "openrouter.ai" in url:
            headers["HTTP-Referer"] = "https://github.com/thinktank"
            headers["X-Title"] = "ThinkTank"

        payload = {
            "model": cfg["model"],
            "messages": [
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.7
        }

        start_time = time.time()
        print(f"\n[API→{agent_name.upper()} ({cfg['model']})]\nEndpoint: {url}\n{prompt[:150]}...\n")

        async with httpx.AsyncClient(timeout=httpx.Timeout(float(timeout_seconds), connect=15.0)) as client:
            resp = await client.post(url, json=payload, headers=headers)
            latency = round((time.time() - start_time) * 1000)

            if resp.status_code != 200:
                raise Exception(f"API call to {agent_name} ({cfg['model']}) failed with HTTP {resp.status_code}: {resp.text[:300]}")

            data = resp.json()
            choice = data.get("choices", [{}])[0]
            message = choice.get("message", {})
            raw_content = message.get("content", "") or ""

            # Check for native reasoning in message response (e.g. DeepSeek reasoner or OpenRouter)
            native_reasoning = message.get("reasoning_content") or message.get("reasoning")

            # Also check for <think> tags in the raw content
            think_match = re.search(r'<think>(.*?)</think>', raw_content, re.DOTALL | re.IGNORECASE)
            if think_match:
                extracted = think_match.group(1).strip()
                raw_content = re.sub(r'<think>.*?</think>', '', raw_content, flags=re.DOTALL | re.IGNORECASE).strip()
                if not native_reasoning:
                    native_reasoning = extracted

            print(f"[API RESPONSE] {len(raw_content)} chars from {agent_name} in {latency}ms")
            return {
                "text": raw_content,
                "native_reasoning": native_reasoning,
                "latency_ms": latency,
                "model": cfg["model"]
            }


api_engine = APIEngine()
