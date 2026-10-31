import asyncio
import re
from playwright.async_api import async_playwright
from playwright_stealth import Stealth

_stealth = Stealth()

# ─────────────────────────────────────────────────────────────────
# Site-specific configuration
# ─────────────────────────────────────────────────────────────────
SITE_CONFIG = {
    "chat.deepseek.com": {
        "input":    ['div[contenteditable="true"]'],
        "send":     ['button[aria-label*="Send"]', 'button[aria-label*="send"]'],
        "stop":     ['button[aria-label*="Stop"]', 'button[aria-label*="stop"]'],
        "response": ['div.ds-markdown', 'div[class*="ds-markdown"]', 'div[class*="markdown"]'],
    },
    "chat.qwen.ai": {
        "input":    ['textarea', 'div[contenteditable="true"]'],
        "send":     ['button[class*="send"]', 'button[aria-label*="Send"]', 'button[type="submit"]'],
        "stop":     ['button[class*="stop"]', 'button[aria-label*="Stop"]'],
        "response": ['div[class*="message-content"]', 'div[class*="bubble"]', 'div[class*="markdown"]'],
    },
    "chat.z.ai": {
        "input":    ['div[contenteditable="true"]', 'textarea'],
        "send":     ['button[aria-label*="Send"]', 'button[type="submit"]', 'button[class*="send"]'],
        "stop":     ['button[aria-label*="Stop"]', 'button[class*="stop"]'],
        "response": ['div[class*="markdown"]', 'div[class*="message"]', 'div[class*="response"]'],
    },
}

def _get_site_config(url: str) -> dict:
    for domain, cfg in SITE_CONFIG.items():
        if domain in url:
            return cfg
    # Generic fallback
    return {
        "input":    ['div[contenteditable="true"]', 'textarea'],
        "send":     ['button[aria-label*="Send"]', 'button[type="submit"]'],
        "stop":     ['button[aria-label*="Stop"]'],
        "response": ['div[class*="markdown"]', 'div[class*="message"]'],
    }


class BrowserEngine:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(BrowserEngine, cls).__new__(cls)
            cls._instance.playwright = None
            cls._instance.context = None
            cls._instance.pages = {}
            cls._instance._pre_send_lengths = {}
        return cls._instance

    async def init_browser(self):
        if self.context is None:
            self.playwright = await async_playwright().start()
            self.context = await self.playwright.chromium.launch_persistent_context(
                user_data_dir='./browser_data',
                headless=False,
                args=['--disable-blink-features=AutomationControlled']
            )

    async def setup_agents(self, urls: list):
        if self.context is None:
            await self.init_browser()
        for url in urls:
            await self.get_page_for_url(url)

    async def get_page_for_url(self, url: str):
        if self.context is None:
            await self.init_browser()

        if url not in self.pages or self.pages[url].is_closed():
            existing = self.context.pages
            reuse = next((p for p in existing if p.url in ("about:blank", "") and p not in self.pages.values()), None)
            page = reuse if reuse else await self.context.new_page()
            await _stealth.apply_stealth_async(page)
            await page.goto(url)
            self.pages[url] = page
            await asyncio.sleep(3)
        return self.pages[url]

    # ─────────────────────────────────────────────────────────────
    # Intelligence Layer
    # ─────────────────────────────────────────────────────────────

    async def diagnose_page(self, url: str) -> dict:
        """
        Analyze page state. Returns dict with:
          - healthy: bool
          - issues: list of {type, message, severity}
        Only checks things send_prompt cannot self-heal:
        login walls, rate limits, and hard page errors.
        """
        page = await self.get_page_for_url(url)
        issues = []

        # Give the page a moment to stabilize
        await asyncio.sleep(1)

        try:
            body_text = (await page.inner_text("body") or "").lower()
        except:
            body_text = ""

        # 1. Login wall — only flag if BOTH login text exists AND no input is found
        login_kw = ["sign in to continue", "please log in", "please sign in",
                    "you need to log in", "login to continue", "create account to continue"]
        if any(kw in body_text for kw in login_kw):
            # Double check there's no input — if there is, login is optional/already done
            has_any_input = await page.evaluate("""
                () => {
                    const ce = document.querySelectorAll('[contenteditable="true"]');
                    const ta = document.querySelectorAll('textarea');
                    return ce.length + ta.length;
                }
            """)
            if has_any_input == 0:
                issues.append({
                    "type": "login_required",
                    "severity": "critical",
                    "message": f"Login wall detected on {url}. Please log in manually and click 'Confirm Login' again."
                })

        # 2. Rate limit
        rate_kw = ["rate limit", "too many requests", "try again later",
                   "quota exceeded", "usage limit", "requests per minute"]
        if any(kw in body_text for kw in rate_kw):
            issues.append({
                "type": "rate_limit",
                "severity": "warning",
                "message": f"Rate limit on {url}. Wait ~30 seconds and try again."
            })

        # 3. Popup/modal visible — auto-dismiss, warn only
        modal_sels = ['[role="dialog"]', '[class*="modal"]', '[class*="popup"]',
                      '[class*="overlay"]', '[class*="alert-dialog"]']
        for sel in modal_sels:
            try:
                el = await page.query_selector(sel)
                if el and await el.is_visible():
                    modal_text = (await el.inner_text() or "")[:120]
                    issues.append({
                        "type": "popup",
                        "severity": "warning",
                        "message": f"Popup on {url}: \"{modal_text.strip()}\". Auto-dismissing..."
                    })
                    break
            except:
                continue

        # 4. Hard page error (404, 502, etc.)
        error_kw = ["page not found", "404", "502 bad gateway", "503 service unavailable"]
        if any(kw in body_text[:300] for kw in error_kw):
            issues.append({
                "type": "page_error",
                "severity": "critical",
                "message": f"Page error on {url}. The site may be down — try refreshing the tab manually."
            })

        return {"url": url, "healthy": len(issues) == 0, "issues": issues}


    async def dismiss_popups(self, page):
        """Attempt to auto-dismiss common popups before interacting."""
        dismiss_sels = [
            'button[aria-label*="Close"]', 'button[aria-label*="close"]',
            'button[aria-label*="Dismiss"]', '[class*="close-btn"]',
            'button:has-text("Got it")', 'button:has-text("OK")',
            'button:has-text("Accept")', 'button:has-text("Continue")',
            'button:has-text("Skip")', 'button:has-text("×")',
        ]
        for sel in dismiss_sels:
            try:
                btn = await page.query_selector(sel)
                if btn and await btn.is_visible():
                    await btn.click()
                    print(f"[POPUP] Dismissed: {sel}")
                    await asyncio.sleep(0.5)
            except:
                continue

    # ─────────────────────────────────────────────────────────────
    # Core Interaction
    # ─────────────────────────────────────────────────────────────

    async def _get_total_length(self, page) -> int:
        try:
            return len(await page.inner_text("body") or "")
        except:
            return 0

    async def _type_into_input(self, page, prompt: str, cfg: dict) -> bool:
        # Strategy 1: Use site-specific selectors with locator
        for sel in cfg["input"]:
            try:
                loc = page.locator(sel).last
                await loc.wait_for(state="visible", timeout=8000)
                await loc.click()
                await asyncio.sleep(0.5)
                # Clear
                await page.keyboard.press("Control+a")
                await asyncio.sleep(0.1)
                await page.keyboard.press("Backspace")
                await asyncio.sleep(0.2)
                # Type — use fill() for long prompts (faster, more reliable)
                if len(prompt) > 200:
                    await loc.fill(prompt)
                else:
                    await page.keyboard.type(prompt, delay=8)
                await asyncio.sleep(0.5)
                print(f"[TYPE] Typed with selector: {sel}")
                return True  # Trust the typing — baseline check will catch failures
            except Exception as e:
                print(f"[TYPE] Selector {sel} failed: {e}")
                continue

        # Strategy 2: execCommand on the focused active element
        try:
            await page.evaluate("""
                () => {
                    const inputs = [...document.querySelectorAll('[contenteditable="true"], textarea')];
                    if (inputs.length > 0) { inputs[inputs.length - 1].focus(); }
                }
            """)
            await asyncio.sleep(0.3)
            await page.evaluate("document.execCommand('selectAll', false, null)")
            await page.evaluate(f"document.execCommand('insertText', false, {repr(prompt)})")
            await asyncio.sleep(0.3)
            print("[TYPE] execCommand strategy succeeded")
            return True
        except Exception as e:
            print(f"[TYPE] execCommand failed: {e}")

        return False

    async def _click_send(self, page, cfg: dict):
        for sel in cfg["send"]:
            try:
                btn = await page.query_selector(sel)
                if btn and await btn.is_visible() and await btn.is_enabled():
                    await btn.click()
                    print(f"[SEND] Clicked: {sel}")
                    return
            except:
                continue
        await page.keyboard.press("Enter")
        print("[SEND] Pressed Enter")

    async def send_prompt(self, url: str, prompt: str):
        page = await self.get_page_for_url(url)
        cfg = _get_site_config(url)

        # Pre-send: dismiss any popups
        await self.dismiss_popups(page)

        # Record baseline
        self._pre_send_lengths[url] = await self._get_total_length(page)
        print(f"[BASELINE] {url} — {self._pre_send_lengths[url]} chars")

        print(f"\n[PROMPT→{url}]\n{prompt[:150]}...\n")

        typed = await self._type_into_input(page, prompt, cfg)
        if not typed:
            raise Exception(f"Failed to type into input on {url}. Page may need re-login or has changed layout.")

        await self._click_send(page, cfg)
        await asyncio.sleep(2)

    async def wait_for_completion(self, url: str, timeout: int = 180, stop_event: asyncio.Event = None):
        page = await self.get_page_for_url(url)
        cfg = _get_site_config(url)
        baseline = self._pre_send_lengths.get(url, 0)
        print(f"[WAIT] {url} — baseline={baseline}")

        # Phase 1: Wait for total page to grow past baseline
        await asyncio.sleep(3)
        for _ in range(60):
            if stop_event and stop_event.is_set():
                raise asyncio.CancelledError("User stopped debate")
            cur = await self._get_total_length(page)
            if cur > baseline + 50:
                print(f"[WAIT] Response started: {cur} chars (was {baseline})")
                break
            print(f"[WAIT] Waiting for response: {cur} chars (need >{baseline+50})")
            await asyncio.sleep(1)

        # Phase 2: Wait for site-specific stop button to vanish
        for sel in cfg["stop"]:
            try:
                el = await page.query_selector(sel)
                if el and await el.is_visible():
                    print(f"[WAIT] Stop button found ({sel}), waiting...")
                    wait_task = asyncio.create_task(page.wait_for_selector(sel, state="hidden", timeout=timeout * 1000))
                    while not wait_task.done():
                        if stop_event and stop_event.is_set():
                            wait_task.cancel()
                            raise asyncio.CancelledError("User stopped debate")
                        await asyncio.sleep(0.5)
                    print("[WAIT] Done generating.")
                    await asyncio.sleep(1.5)
                    return
            except:
                continue

        # Phase 3: Stability check on total length
        print("[WAIT] Using stability check...")
        last = 0
        stable = 0
        for _ in range(timeout):
            if stop_event and stop_event.is_set():
                raise asyncio.CancelledError("User stopped debate")
            cur = await self._get_total_length(page)
            if cur > baseline + 50 and cur == last:
                stable += 1
                if stable >= 5:
                    print(f"[WAIT] Stable at {cur} chars.")
                    return
            else:
                stable = 0
                last = cur
            await asyncio.sleep(1)

        print("[WAIT] Timeout — proceeding.")

    async def _extract_page_text(self, page) -> str:
        """Extract the last AI response using site-specific then generic selectors."""
        url = page.url
        cfg = _get_site_config(url)

        # Preferentially look for code/pre blocks inside the response bubble
        for sel in cfg["response"]:
            try:
                els = await page.query_selector_all(sel)
                if els:
                    last_bubble = els[-1]
                    code_block = await last_bubble.query_selector('pre, code')
                    if code_block:
                        text = await code_block.inner_text()
                    else:
                        text = await last_bubble.inner_text()
                        
                    if text and len(text.strip()) > 20:
                        return text.strip()
            except:
                continue

        # Generic fallbacks
        for sel in ['div[class*="markdown"]', 'div[class*="message"]:last-child',
                    'div[class*="assistant"]:last-child']:
            try:
                els = await page.query_selector_all(sel)
                if els:
                    text = await els[-1].inner_text()
                    if text and len(text.strip()) > 20:
                        return text.strip()
            except:
                continue

        # Nuclear: last 4000 chars of body
        try:
            body = await page.inner_text("body")
            return body[-4000:].strip() if body else ""
        except:
            return ""

    async def get_last_response(self, url: str) -> str:
        page = await self.get_page_for_url(url)
        text = await self._extract_page_text(page)
        print(f"[RESPONSE] {len(text)} chars from {url}")
        return text if len(text) > 10 else "No response found."

    async def get_native_reasoning(self, url: str) -> str:
        page = self.pages.get(url)
        if not page:
            return None
        
        try:
            # Evaluate JS to find reasoning using the fallback logic
            reasoning = await page.evaluate("""
                () => {
                    // 1. Try to find native details/summary tags
                    const details = Array.from(document.querySelectorAll('details'));
                    for (let i = details.length - 1; i >= 0; i--) {
                        const text = details[i].innerText || "";
                        if (text.toLowerCase().includes('thought') || text.toLowerCase().includes('thinking') || text.toLowerCase().includes('reasoning')) {
                            return text.trim();
                        }
                    }
                    
                    // 2. Try to find generic text containers based on class names
                    const allDivs = Array.from(document.querySelectorAll('div'));
                    for (let i = allDivs.length - 1; i >= 0; i--) {
                        const el = allDivs[i];
                        const cls = el.className || '';
                        if (typeof cls === 'string' && (cls.includes('think') || cls.includes('thought') || cls.includes('reasoning'))) {
                            if (el.innerText && el.innerText.length > 20) {
                                return el.innerText.trim();
                            }
                        }
                    }
                    
                    // 3. Try finding the main response and grab its preceding sibling
                    const responseDivs = Array.from(document.querySelectorAll('div[class*="markdown"]'));
                    if (responseDivs.length > 0) {
                        // find the last one's parent or preceding sibling
                        const lastResponse = responseDivs[responseDivs.length - 1];
                        const prev = lastResponse.previousElementSibling;
                        if (prev && prev.innerText && prev.innerText.length > 20) {
                            return prev.innerText.trim();
                        }
                    }
                    
                    return null;
                }
            """)
            return reasoning if reasoning else None
        except Exception as e:
            print(f"[REASONING] Failed to extract native reasoning: {e}")
            return None


browser_engine = BrowserEngine()
