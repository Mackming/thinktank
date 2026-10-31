"""
ThinkTank Backend Entry Point
------------------------------
This module must be used to start the server (not `uvicorn main:app --reload`).

The `--reload` flag on Windows forces asyncio to use SelectorEventLoop, which
does NOT support subprocesses. Playwright requires ProactorEventLoop to launch
Chrome. This script sets the correct policy BEFORE uvicorn starts, then runs
uvicorn programmatically without --reload.

Usage:
    python run.py
"""
import sys
import asyncio

# Set BEFORE any other imports - forces ProactorEventLoop on Windows
# This is required for Playwright to spawn subprocess (Chrome)
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8001,  # Changed from 8000 to avoid ghost socket issue
        reload=False,  # CRITICAL: reload=True forces SelectorEventLoop on Windows
        loop="asyncio"
    )
