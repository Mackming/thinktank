import os
import chromadb
from chromadb.config import Settings

# Initialize ChromaDB persistent client
chroma_client = chromadb.PersistentClient(path="./chroma_db")
collection = chroma_client.get_or_create_collection(name="corporate_memory")

def store_memory(prompt: str, synthesis: str, session_id: str):
    """Embeds and stores the master prompt and its resulting synthesis."""
    try:
        collection.add(
            documents=[synthesis],
            metadatas=[{"prompt": prompt, "session_id": session_id}],
            ids=[f"session_{session_id}"]
        )
        print(f"[MEMORY] Saved session {session_id} to Corporate Memory.")
    except Exception as e:
        print(f"[MEMORY Error] Failed to store memory: {e}")

def query_memory(prompt: str, k: int = 2) -> list[str]:
    """Retrieves the top k related past strategies."""
    try:
        results = collection.query(
            query_texts=[prompt],
            n_results=k
        )
        if not results or not results['documents'] or not results['documents'][0]:
            return []
        
        # Format the retrieved documents into a string context
        memories = []
        for i, doc in enumerate(results['documents'][0]):
            metadata = results['metadatas'][0][i]
            memories.append(f"Past Prompt: {metadata.get('prompt', 'Unknown')}\nResulting Strategy:\n{doc}")
        return memories
    except Exception as e:
        print(f"[MEMORY Error] Failed to query memory: {e}")
collection_knowledge = chroma_client.get_or_create_collection(name="knowledge_vault")

def store_knowledge(space_id: int, book_id: int, book_title: str, author: str, chunks: list):
    """Embeds and stores book chunks into the knowledge vault."""
    try:
        if not chunks: return
        documents = []
        metadatas = []
        ids = []
        for i, chunk in enumerate(chunks):
            documents.append(chunk["text"])
            metadatas.append({
                "space_id": space_id,
                "book_id": book_id,
                "book_title": book_title or "Unknown",
                "author": author or "Unknown",
                "page": chunk["page"]
            })
            ids.append(f"book_{book_id}_chunk_{i}")

        collection_knowledge.add(
            documents=documents,
            metadatas=metadatas,
            ids=ids
        )
        print(f"[MEMORY] Saved {len(chunks)} chunks for book '{book_title}' (Space {space_id}).")
    except Exception as e:
        print(f"[MEMORY Error] Failed to store knowledge: {e}")

def query_knowledge(prompt: str, space_id: int, k: int = 5) -> str:
    """Retrieves top k related excerpts from a specific space."""
    try:
        results = collection_knowledge.query(
            query_texts=[prompt],
            n_results=k,
            where={"space_id": space_id}
        )
        if not results or not results['documents'] or not results['documents'][0]:
            return ""
        
        excerpts = []
        for i, doc in enumerate(results['documents'][0]):
            metadata = results['metadatas'][0][i]
            title = metadata.get('book_title', 'Unknown')
            page = metadata.get('page', '?')
            excerpts.append(f"[{title}, Page {page}]:\n{doc}")
            
        return "\n\n".join(excerpts)
    except Exception as e:
        print(f"[MEMORY Error] Failed to query knowledge: {e}")
        return ""

def delete_knowledge(book_id: int):
    """Deletes all chunks associated with a book."""
    try:
        collection_knowledge.delete(where={"book_id": book_id})
        print(f"[MEMORY] Deleted knowledge for book_id {book_id}")
    except Exception as e:
        print(f"[MEMORY Error] Failed to delete knowledge: {e}")
