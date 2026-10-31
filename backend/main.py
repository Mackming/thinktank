import sys
import asyncio

# CRITICAL FIX: On Windows, uvicorn defaults to SelectorEventLoop which does NOT
# support subprocesses (required by Playwright to launch Chrome).
# Force ProactorEventLoop which has full subprocess support.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, BackgroundTasks, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import json
import os
import shutil
from orchestrator import ThinkTankOrchestrator
from automation import browser_engine
from database import get_all_sessions, get_session, get_all_spaces, create_space, get_books_by_space, delete_book_db, add_book
from memory import store_knowledge, delete_knowledge
from pdf_cleaner import clean_and_chunk_pdf
from pydantic import BaseModel

app = FastAPI(title="Project ThinkTank API")

UPLOAD_DIR = "./uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for local dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.get("/api/sessions")
async def get_sessions():
    sessions = get_all_sessions()
    return [
        {
            "id": s.id,
            "timestamp": s.timestamp.isoformat(),
            "master_prompt": s.master_prompt,
            # Don't send full transcript on list to save bandwidth, unless needed
        }
        for s in sessions
    ]

@app.get("/api/sessions/{session_id}")
async def get_session_by_id(session_id: int):
    s = get_session(session_id)
    if not s:
        return {"error": "Session not found"}
    return {
        "id": s.id,
        "timestamp": s.timestamp.isoformat(),
        "master_prompt": s.master_prompt,
        "transcript": json.loads(s.transcript),
        "synthesis": json.loads(s.synthesis) if s.synthesis else None
    }

class SpaceCreate(BaseModel):
    name: str
    description: str = ""
    icon: str = "Library"

@app.get("/api/spaces")
async def api_get_spaces():
    return get_all_spaces()

@app.post("/api/spaces")
async def api_create_space(space: SpaceCreate):
    print(f"DEBUG BACKEND: Received request to create space: {space}")
    try:
        new_space = create_space(space.name, space.description, space.icon)
        return new_space
    except Exception as e:
        print(f"DEBUG BACKEND API ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/spaces/{space_id}/books")
async def api_get_books(space_id: int):
    return get_books_by_space(space_id)

@app.delete("/api/books/{book_id}")
async def api_delete_book(book_id: int):
    book = delete_book_db(book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    # Delete from memory
    delete_knowledge(book_id)
    
    # Delete physical file
    if os.path.exists(book.filename):
        os.remove(book.filename)
        
    return {"status": "deleted"}

def process_book_upload(file_path: str, space_id: int, title: str, author: str):
    print(f"[BACKGROUND] Extracting text for {title or file_path}...")
    metadata, chunks = clean_and_chunk_pdf(file_path)
    
    final_title = title or metadata.get("title", "Unknown Book")
    final_author = author or metadata.get("author", "Unknown Author")
    
    print(f"[BACKGROUND] Adding {final_title} to database...")
    book = add_book(space_id, final_title, final_author, file_path)
    
    print(f"[BACKGROUND] Vectorizing and storing chunks...")
    store_knowledge(space_id, book.id, final_title, final_author, chunks)
    print(f"[BACKGROUND] Finished processing {final_title}")

@app.post("/api/spaces/{space_id}/upload_book")
async def upload_book(
    space_id: int, 
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: str = Form(None),
    author: str = Form(None)
):
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    background_tasks.add_task(process_book_upload, file_path, space_id, title, author)
    return {"status": "Processing started", "filename": file.filename}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    await websocket.send_json({
        "type": "connection",
        "agent_name": "System",
        "message": "Connected to ThinkTank Command Center",
        "timestamp": datetime.now().isoformat()
    })
    active_orchestrator = None
    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            
            if payload.get("action") == "setup_agents":
                from orchestrator import MODELS
                active_models = payload.get("active_models", ["deepseek", "qwen", "glm"])
                
                await websocket.send_json({
                    "type": "status",
                    "agent_name": "System",
                    "message": "Opening browser tabs. Please log in manually...",
                    "timestamp": datetime.now().isoformat()
                })
                
                urls_to_open = [MODELS[m] for m in active_models if m in MODELS]
                await browser_engine.setup_agents(urls_to_open)
                await websocket.send_json({
                    "type": "status",
                    "agent_name": "System",
                    "message": "Browser opened. Please log in manually.",
                    "timestamp": datetime.now().isoformat()
                })
                
            elif payload.get("action") == "confirm_login":
                await websocket.send_json({
                    "type": "status",
                    "agent_name": "System",
                    "message": "Login confirmed. Agents are ready.",
                    "timestamp": datetime.now().isoformat()
                })
                
            elif payload.get("action") == "run_workflow":
                mode = payload.get("mode", "debate")
                master_prompt = payload.get("master_prompt", "")
                space_id = payload.get("space_id", None)
                
                # Retrieve active models configuration
                active_models = payload.get("active_models", ["deepseek", "qwen", "glm"])
                
                if not master_prompt:
                    await websocket.send_json({
                        "type": "error",
                        "agent_name": "System",
                        "message": "Master prompt cannot be empty.",
                        "timestamp": datetime.now().isoformat()
                    })
                    continue

                co_pilot_mode = payload.get("co_pilot_mode", False)
                active_orchestrator = ThinkTankOrchestrator(websocket, active_models, co_pilot_mode)
                
                # Start workflow as background task so we can receive "stop_workflow" messages
                asyncio.create_task(active_orchestrator.execute(mode, master_prompt, space_id))
                
            elif payload.get("action") == "stop_workflow":
                if active_orchestrator:
                    active_orchestrator.stop_requested.set()
                    await websocket.send_json({
                        "type": "status",
                        "agent_name": "System",
                        "message": "🛑 Interrupted! Stopping loop and forcing final synthesis...",
                        "timestamp": datetime.now().isoformat()
                    })

            elif payload.get("action") == "interject":
                if active_orchestrator:
                    message = payload.get("message", "")
                    active_orchestrator.interjection_queue.put_nowait(message)
                    await websocket.send_json({
                        "type": "status",
                        "agent_name": "System",
                        "message": f"CEO Override received: '{message[:50]}...'",
                        "timestamp": datetime.now().isoformat()
                    })

            elif payload.get("action") == "continue_turn":
                if active_orchestrator:
                    feedback = payload.get("feedback", "")
                    if feedback:
                        active_orchestrator.interjection_queue.put_nowait(feedback)
                    active_orchestrator.continue_event.set()
    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        import traceback
        traceback.print_exc()
        await websocket.send_json({
            "type": "error",
            "agent_name": "System",
            "message": str(e),
            "timestamp": datetime.now().isoformat()
        })
