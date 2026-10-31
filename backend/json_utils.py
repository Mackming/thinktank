import re
import json_repair

def bulletproof_parse(raw_text: str) -> dict:
    """
    Bulletproof JSON parser.
    1. Extracts content from <THINK_JSON> tags (fallback to full text).
    2. Replaces smart quotes.
    3. Uses json-repair for trailing commas, syntax errors, and unescaped control chars.
    """
    # 1. Extract XML tag contents if present
    match = re.search(r'<THINK_JSON>(.*?)</THINK_JSON>', raw_text, re.DOTALL | re.IGNORECASE)
    cleaned_text = match.group(1) if match else raw_text
    
    # Also strip standard markdown blocks if they slipped in
    cleaned_text = re.sub(r'```(?:json)?\s*([\s\S]*?)\s*```', r'\1', cleaned_text)
    
    # 2. Replace smart quotes
    cleaned_text = cleaned_text.replace('“', '"').replace('”', '"')
    
    # 3. Use json-repair
    try:
        repaired = json_repair.repair_json(cleaned_text, return_objects=True)
        if isinstance(repaired, dict):
            return repaired
        if isinstance(repaired, list) and len(repaired) > 0:
            return repaired[0]
        # Fallback empty dict if repair completely failed
        return {}
    except Exception as e:
        print(f"[JSON REPAIR ERROR] Failed to parse: {e}")
        return {}
