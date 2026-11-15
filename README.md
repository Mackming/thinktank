# 🏛️ ThinkTank: Autonomous Multi-Agent Deliberation Platform

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Playwright](https://img.shields.io/badge/Playwright-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)](https://playwright.dev)
[![HTTPX](https://img.shields.io/badge/HTTPX-0.28-1f425f?style=for-the-badge)](https://www.python-httpx.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

**ThinkTank** is an autonomous multi-agent reasoning and deliberation platform. It orchestrates frontier AI models (such as **DeepSeek**, **Qwen**, and **GLM / Zhipu AI**) simultaneously to debate, critique, collaborate, and synthesize solutions for complex strategic problems.

ThinkTank supports **Dual Execution Engines**:
1. **🌐 Browser Mode (Web Sessions):** Zero token fees. Drives persistent, stealth browser sessions to turn consumer-facing AI chat portals into a synchronized council of AI advisors.
2. **🔑 API Mode (Direct API Keys):** High-speed, headless, and deterministic execution via official APIs (DeepSeek, Alibaba DashScope Qwen, Zhipu AI GLM) or universal fallbacks (OpenRouter, OpenAI).

---

## ⚡ Key Highlights

* **🔄 Dual Execution Engine (Browser vs. API Mode):** Toggle effortlessly between free local stealth browser automation and fast, headless direct API calls. Configure keys and endpoints in the in-app modal or via `.env`.
* **⚔️ 4 Orchestrated Workflows:**
  * **Debate Mode:** Alternating rounds between a visionary *Proposer* and a relentless *Critic* (hunting for logical fallacies and edge cases), auto-converging when confidence is high and severity drops, concluded by a *Synthesizer*.
  * **Collaborate Mode:** Parallel task decomposition across multiple models merged into a unified master strategy.
  * **Refine Mode:** Sequential pipeline passing drafts through *Drafter* ➔ *Editor* ➔ *Polisher*.
  * **Coach Mode:** Socratic probing and mentoring utilizing structured psychological and philosophical frameworks.
* **👔 Co-Pilot Mode & CEO Directives:** Real-time human-in-the-loop controls. Pause between turns to review arguments, inject overrides, or redirect agent reasoning on the fly.
* **📚 Knowledge Vault & Spaces (RAG):** Upload PDF literature and domain dossiers. Text is automatically cleaned, chunked, and embedded into **ChromaDB**. Agents cite claims directly using format: `[Book Title, Page X]`.
* **🧠 Corporate Memory:** Automatically saves past winning strategies into vector memory, allowing the council to recall historical context for future deliberations.
* **🛡️ Self-Healing JSON Engine:** Output is enclosed in `<THINK_JSON>` boundaries and validated with Pydantic. If a model hallucinates malformed syntax, an automated repair loop triggers an immediate correction turn across both Browser and API modes.
* **🕵️ Native Reasoning Capture:** Captures native thinking/reasoning traces directly from the browser DOM or API reasoning streams (`reasoning_content` / `<think>...</think>`) and displays them in the UI.

---

## 🏗️ Architecture

```mermaid
flowchart TD
    User(["User / CEO"]) <-->|WebSockets & REST| UI["React 19 + Tailwind UI"]
    UI <--> Backend["FastAPI Orchestrator"]

    subgraph Deliberation_Engine ["Deliberation Engine"]
        Backend --> Proposer["Proposer Agent"]
        Backend --> Critic["Critic Agent"]
        Backend --> Synthesizer["Synthesizer Agent"]
    end

    subgraph Knowledge_Persistence ["Knowledge & Persistence"]
        Backend <--> SQLite[("SQLite / Sessions & Spaces")]
        Backend <--> Chroma[("ChromaDB / Vector Memory")]
        PDFs["PDF Dossiers"] --> PDFCleaner["PDF Cleaner & Chunker"] --> Chroma
    end

    subgraph Dual_Engines ["Execution Engines"]
        direction TB
        subgraph Browser_Engine ["Browser Mode (Playwright Stealth)"]
            B1["chat.deepseek.com"]
            B2["chat.qwen.ai"]
            B3["chat.z.ai"]
        end
        subgraph API_Engine ["API Mode (HTTPX Async Client)"]
            A1["DeepSeek API (api.deepseek.com)"]
            A2["Qwen API (DashScope)"]
            A3["GLM API (open.bigmodel.cn)"]
            A4["Universal Fallback (OpenRouter / OpenAI)"]
        end
    end

    Proposer -.-> Browser_Engine
    Critic -.-> Browser_Engine
    Synthesizer -.-> Browser_Engine

    Proposer -.-> API_Engine
    Critic -.-> API_Engine
    Synthesizer -.-> API_Engine
```

---

## 📁 Project Structure

```
ThinkTank/
├── backend/
│   ├── api_engine.py       # Direct API engine & connection verifier
│   ├── automation.py       # Playwright browser engine & stealth automation
│   ├── database.py         # SQLite models & session/space persistence
│   ├── json_utils.py       # Bulletproof JSON repair & tag extraction
│   ├── main.py             # FastAPI entrypoint, REST API & WebSocket server
│   ├── memory.py           # ChromaDB vector store (Corporate Memory & Vault)
│   ├── models.py           # Pydantic schemas for agent thoughts & critiques
│   ├── orchestrator.py     # Deliberation workflows (Debate, Refine, Collaborate, Coach)
│   ├── pdf_cleaner.py      # Noise removal & semantic chunking for PDFs
│   ├── prompts.py          # Structured system prompts and role schemas
│   ├── requirements.txt    # Python dependencies
│   ├── run.py              # Windows ProactorEventLoop-safe launcher
│   └── .env.example        # Environment variable template for API keys
├── frontend/
│   ├── src/
│   │   ├── components/     # UI components (ApiKeyConfigModal, History, Library, etc.)
│   │   ├── hooks/          # useWebSocket and lifecycle hooks
│   │   ├── App.tsx         # Central mission-control interface with Engine Mode toggle
│   │   └── main.tsx        # React entrypoint
│   ├── package.json        # Node dependencies & scripts
│   └── vite.config.ts      # Vite configuration & dev proxy
├── .env.example            # Root environment variable template
├── .gitignore              # Ignores browser data, caches, DBs, and venvs
├── LICENSE                 # MIT License
└── README.md
```

---

## 🚀 Quickstart Guide

### Prerequisites

* **Python 3.10+** (Python 3.11 or 3.12 recommended)
* **Node.js 18+** & **npm**
* Google Chrome installed on your machine (only required if using **Browser Mode**)

---

### 1. Backend Setup

1. Open a terminal in the project directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   # Windows (PowerShell)
   python -m venv venv
   .\venv\Scripts\Activate.ps1

   # macOS / Linux
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install backend dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. *(Optional - for Browser Mode)* Install Playwright browser binaries:
   ```bash
   playwright install chromium
   ```
5. *(Optional - for API Mode)* Configure environment variables:
   ```bash
   cp .env.example .env
   # Open .env and add your DEEPSEEK_API_KEY, DASHSCOPE_API_KEY, ZHIPUAI_API_KEY, or OPENROUTER_API_KEY
   ```
   *(Note: You can also configure API keys directly inside the web UI at any time!)*
6. Launch the backend server:
   ```bash
   python run.py
   ```
   *The backend will start at `http://127.0.0.1:8001`.*

---

### 2. Frontend Setup

1. In a new terminal, navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to:
   ```
   http://localhost:5173
   ```

---

## 🖥️ Operating Instructions

### Selecting Your Engine Mode

In the top-left panel of ThinkTank, choose your preferred **Engine Mode**:

#### Option A: 🔑 API Mode (Direct API Keys)
1. Select **API Mode**.
2. Click **Configure API Keys** (or the **Keys** badge).
3. Enter your API credentials:
   * **DeepSeek API Key** (`sk-...` from [DeepSeek Platform](https://platform.deepseek.com))
   * **Qwen / DashScope Key** from [Alibaba Cloud DashScope](https://dashscope.console.aliyun.com)
   * **GLM / Zhipu AI Key** from [Zhipu AI BigModel](https://open.bigmodel.cn)
   * *Or use a universal key* like **OpenRouter** or **OpenAI** to power all agents simultaneously.
4. Click **Test** to verify connection latency and credentials, then **Save & Apply** (persisted locally to `.env`).
5. When the status displays **API READY**, click **Deploy ThinkTank** to run immediately without browser popups!

#### Option B: 🌐 Browser Mode (Local Web Sessions)
1. Select **Browser Mode**.
2. Click **Setup Agents**.
3. A persistent Chromium browser window will launch with tabs for DeepSeek, Qwen, and GLM.
4. If prompted, sign in manually to each platform in that browser window (login cookies are securely preserved locally in your `browser_data` folder).
5. Once logged in, click **Confirm Login** in the ThinkTank UI.
6. Click **Deploy ThinkTank**.

---

### Deliberation Controls

1. **Select Execution Strategy:** Choose between **Debate**, **Collaborate**, **Refine**, or **Coach**.
2. **Knowledge Spaces (RAG):** Create a Knowledge Space and upload reference PDFs to anchor the council's arguments in your domain literature.
3. **Co-Pilot Mode:** Enable the toggle if you want deliberation to pause after every turn for your executive review and steering directives.
4. **Deploy & Steer:** Enter your problem statement or prompt. Watch the agents autonomously deliberate, challenge fallacies, and synthesize an executive roadmap. Use the **Interject** bar or Co-Pilot modal to redirect agents on the fly.

---

## 🛠️ Tech Stack

| Component | Technology |
| :--- | :--- |
| **Backend Framework** | [FastAPI](https://fastapi.tiangolo.com/) + [Uvicorn](https://www.uvicorn.org/) |
| **Direct API Engine** | [HTTPX](https://www.python-httpx.org/) (Async Client) |
| **Browser Automation** | [Playwright](https://playwright.dev/) + [playwright-stealth](https://github.com/AtuboDad/playwright_stealth) |
| **Vector Database** | [ChromaDB](https://www.trychroma.com/) + [Sentence Transformers](https://sbert.net/) |
| **Relational Database** | [SQLite](https://www.sqlite.org/) via [SQLAlchemy](https://www.sqlalchemy.org/) |
| **Document Processing** | [PyMuPDF (fitz)](https://pymupdf.readthedocs.io/) |
| **Frontend Framework** | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vite.dev/) |
| **Styling & Components**| [Tailwind CSS](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/) + [Lucide Icons](https://lucide.dev/) |

---

## ⚖️ Disclaimer

This project is created for research and educational purposes to explore multi-agent deliberation patterns and human-in-the-loop orchestration. Ensure you review and adhere to the respective terms of service for any external web platforms accessed via automated tooling.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
