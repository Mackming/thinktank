import fitz
import re

def clean_and_chunk_pdf(file_path: str, chunk_size_tokens=600):
    doc = fitz.open(file_path)
    total_pages = len(doc)
    
    # Strip first 15 and last 20 pages if book is long enough
    start_page = 15 if total_pages > 40 else 0
    end_page = total_pages - 20 if total_pages > 40 else total_pages
    
    chunks = []
    current_chunk = ""
    approx_chars_per_token = 4
    max_chunk_chars = chunk_size_tokens * approx_chars_per_token
    
    metadata = {
        "title": doc.metadata.get("title", ""),
        "author": doc.metadata.get("author", "")
    }

    for page_num in range(start_page, end_page):
        page = doc[page_num]
        text = page.get_text()
        
        # Noise removal heuristics
        # 1. Strip standalone numbers (page numbers) at start/end of text
        text = re.sub(r'^\s*\d+\s*\n', '', text)
        text = re.sub(r'\n\s*\d+\s*$', '', text)
        
        # Split into paragraphs to preserve semantics
        paragraphs = text.split('\n\n')
        
        for p in paragraphs:
            p = p.strip()
            if not p:
                continue
                
            # Noise removal: if it's a very short line and all caps, it's likely a header
            if len(p) < 40 and p.isupper():
                continue
                
            # Accumulate chunk
            if len(current_chunk) + len(p) > max_chunk_chars:
                if current_chunk:
                    chunks.append({"text": current_chunk.strip(), "page": page_num + 1})
                current_chunk = p + "\n\n"
            else:
                current_chunk += p + "\n\n"
                
    if current_chunk.strip():
        chunks.append({"text": current_chunk.strip(), "page": end_page})
        
    doc.close()
    return metadata, chunks
