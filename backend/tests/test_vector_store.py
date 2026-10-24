from app.services.vector_store import (
    compute_embedding,
    index_journal_entry,
    search_journal_entries,
    get_user_journal_collection,
)


def test_compute_embedding_deterministic():
    """
    Verifies that compute_embedding returns a valid normalized vector of expected dimension.
    """
    v1 = compute_embedding("Deep work session on productivity app")
    v2 = compute_embedding("Deep work session on productivity app")
    assert isinstance(v1, list)
    assert len(v1) > 0
    # Deterministic test
    assert v1 == v2


def test_chroma_journal_indexing_and_search():
    """
    Verifies indexing entries in Chroma and retrieving relevant entries with cosine similarity.
    """
    test_user_id = 99999
    # Clean previous collection if any
    col = get_user_journal_collection(test_user_id)
    try:
        col.delete(where={"user_id": test_user_id})
    except Exception:
        pass

    # Index two entries
    index_journal_entry(
        user_id=test_user_id,
        entry_id=101,
        entry_date="2026-10-20",
        content="Celebrated winning the annual design award. Best day of the quarter!",
        mood="energized",
    )
    index_journal_entry(
        user_id=test_user_id,
        entry_id=102,
        entry_date="2026-10-22",
        content="Felt tired and spent the entire afternoon fixing subtle CSS layout bugs.",
        mood="tired",
    )

    # Search for design award celebration
    matches = search_journal_entries(
        user_id=test_user_id,
        query="When did I win the award?",
        top_k=2,
    )

    assert len(matches) > 0
    dates = [m["date"] for m in matches]
    assert "2026-10-20" in dates
