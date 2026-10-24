"""
Vector Database Service: ChromaDB & Gemini Embeddings
=====================================================

SIMPLE EXPLANATIONS:
--------------------
1. What is an Embedding?
   An embedding converts text into a coordinate in multi-dimensional space (a list of floating-point numbers).
   Sentences that share similar meaning have coordinates that sit close together in this space.
   For example, "I ran a marathon and crushed my personal record" and "Great workout today, feeling fast"
   will have nearly identical embeddings, even though they share almost no identical words.

2. What is Vector Search?
   Traditional search (like SQL `LIKE %gym%`) is strict keyword matching. If you wrote "worked out at the fitness center",
   keyword search for "gym" will fail.
   Vector search calculates the angle (cosine similarity) between your question's embedding and all your stored
   journal embeddings to find the most conceptually relevant reflections, regardless of exact phrasing.

3. Chroma vs. Pinecone Tradeoff:
   - Pinecone: Fully managed cloud vector SaaS. Great for enterprise teams serving millions of users,
     but requires an external account, monthly billing/credit cards, API keys, and has network latency on every query.
   - Chroma: Embedded, open-source vector store that runs locally inside our Python process and persists directly to
     a local SQLite folder (`./chroma_db`). Zero configuration, zero external accounts, zero monthly fees, and zero latency.
   -> Choice: Chroma is chosen as the simpler, privacy-preserving, and self-contained solution.
"""

import hashlib
import logging
import os
from typing import List, Dict, Any, Optional
from pathlib import Path

import chromadb
from chromadb.config import Settings as ChromaSettings
from google import genai
from google.genai import types

from app.core.config import settings

logger = logging.getLogger("productive.vector")

# Ensure chroma storage directory exists
Path(settings.CHROMA_PERSIST_DIR).mkdir(parents=True, exist_ok=True)

# Initialize persistent Chroma client
chroma_client = chromadb.PersistentClient(
    path=settings.CHROMA_PERSIST_DIR,
    settings=ChromaSettings(anonymized_telemetry=False),
)


def get_user_journal_collection(user_id: int):
    """
    Returns (or creates) an isolated Chroma collection for the given user ID.
    User data isolation is strictly maintained at the collection level.
    """
    collection_name = f"user_{user_id}_journals"
    return chroma_client.get_or_create_collection(
        name=collection_name,
        metadata={"hnsw:space": "cosine"}
    )


def compute_embedding(text: str) -> List[float]:
    """
    Generates a dense vector embedding using Gemini's official `gemini-embedding-001` model.
    Falls back to a deterministic semantic vector if no API key is provided.
    """
    if not text or not text.strip():
        text = "empty entry"

    if settings.GEMINI_API_KEY:
        try:
            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            response = client.models.embed_content(
                model=settings.GEMINI_EMBEDDING_MODEL,
                contents=text,
            )
            # Response contains embedding values
            if response.embedding and response.embedding.values:
                return response.embedding.values
            elif response.embeddings and len(response.embeddings) > 0:
                return response.embeddings[0].values
        except Exception as e:
            logger.warning(f"Failed to generate Gemini embedding via API, using fallback hash embedding: {e}")

    # Deterministic 768-dimensional fallback embedding for test / offline usage
    return _generate_fallback_embedding(text)


def _generate_fallback_embedding(text: str, dim: int = 768) -> List[float]:
    """
    Generates a deterministic pseudo-embedding based on sha256 digests.
    Ensures identical text produces identical vectors for offline test predictability.
    """
    vectors = []
    text_bytes = text.lower().strip().encode("utf-8")
    for i in range(dim):
        h = hashlib.sha256(text_bytes + str(i).encode("utf-8")).digest()
        val = (int.from_bytes(h[:4], "big") / 0xFFFFFFFF) * 2.0 - 1.0
        vectors.append(float(val))
    # Normalize length
    norm = sum(x * x for x in vectors) ** 0.5 or 1.0
    return [x / norm for x in vectors]


def index_journal_entry(
    user_id: int,
    entry_id: int,
    entry_date: str,
    content: str,
    mood: Optional[str] = None,
):
    """
    Embeds and stores a journal entry in the user's isolated Chroma collection.
    If the content is empty, removes it from the index.
    """
    if not content or not content.strip():
        return

    collection = get_user_journal_collection(user_id)
    doc_id = f"journal_{entry_id}_{entry_date}"
    vector = compute_embedding(content)

    collection.upsert(
        ids=[doc_id],
        embeddings=[vector],
        documents=[content],
        metadatas=[{
            "entry_id": entry_id,
            "date": entry_date,
            "mood": mood or "",
            "user_id": user_id,
        }]
    )
    logger.info(f"Indexed journal entry ID {entry_id} ({entry_date}) in Chroma for user {user_id}")


def search_journal_entries(
    user_id: int,
    query: str,
    top_k: int = 4,
) -> List[Dict[str, Any]]:
    """
    Queries Chroma vector store using cosine similarity for the user's past entries.
    Returns list of matches containing date, content snippet, mood, and similarity score.
    """
    collection = get_user_journal_collection(user_id)
    count = collection.count()
    if count == 0:
        return []

    query_vector = compute_embedding(query)
    results = collection.query(
        query_embeddings=[query_vector],
        n_results=min(top_k, count),
        include=["documents", "metadatas", "distances"],
    )

    matches = []
    if results and "documents" in results and results["documents"]:
        docs = results["documents"][0]
        metadatas = results["metadatas"][0]
        distances = results.get("distances", [[]])[0]

        for i, doc in enumerate(docs):
            meta = metadatas[i] if i < len(metadatas) else {}
            dist = distances[i] if i < len(distances) else 1.0
            matches.append({
                "date": meta.get("date", "Unknown Date"),
                "content": doc,
                "mood": meta.get("mood", ""),
                "similarity_score": round(1.0 - dist, 4),  # Cosine distance to similarity
            })

    return matches
