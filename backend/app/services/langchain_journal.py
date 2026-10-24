"""
LangChain Journal Query Chain Module
====================================
Builds the 'Ask My Journal' Retrieval-Augmented Generation (RAG) pipeline
using LangChain Expression Language (LCEL):
  PromptTemplate -> ChatGoogleGenerativeAI -> JsonOutputParser / PydanticOutputParser

================================================================================
ARCHITECTURAL COMPARISON: LangChain vs. Direct google-genai SDK
================================================================================

1. ABSTRACTION & ECOSYSTEM:
   - LangChain:
     Provides a high-level, model-agnostic abstraction layer. Chains can seamlessly
     swap LLM providers (e.g. Gemini <-> Claude <-> GPT-4) with zero prompt or code rewrite.
     Includes off-the-shelf document splitters, vector store retrievers, and streaming callbacks.
   - Direct google-genai SDK:
     First-party, zero-overhead client tightly coupled to Google's tensor infrastructure.
     Provides direct access to brand-new Gemini capabilities (native tool calling, code execution,
     system instructions, Google Search grounding) immediately on day 1 without waiting
     for third-party framework wrappers to catch up.

2. RUNTIME OVERHEAD & LATENCY:
   - LangChain:
     Adds extra Python call-stack layers, serialization/deserialization cycles, and generic
     normalization overhead.
   - Direct google-genai SDK:
     Significantly faster invocation path, minimal memory footprint, and exact native JSON
     schema parameter passing.

3. WHEN TO USE WHICH IN THIS PROJECT:
   - Use `langchain_journal.py` for RAG pipelines where chained steps (retriever -> format_docs ->
     prompt -> model -> parser) benefit from standardized, declarative LCEL pipelines.
   - Use `gemini_service.py` (Direct SDK) for latency-critical, high-frequency operations
     such as real-time Function Calling and strict Pydantic JSON validation.
================================================================================
"""

import logging
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser
from langchain_google_genai import ChatGoogleGenerativeAI

from app.core.config import settings

logger = logging.getLogger("productive.langchain")


class JournalAnswerSchema(BaseModel):
    """Structured response schema for Ask My Journal queries."""
    answer: str = Field(..., description="Comprehensive answer synthesized directly from past journal entries")
    source_dates: List[str] = Field(default_factory=list, description="Calendar dates (YYYY-MM-DD) cited in the answer")
    confidence: str = Field("high", description="Confidence rating: 'high', 'moderate', or 'insufficient_data'")


def build_ask_journal_chain(api_key: Optional[str] = None):
    """
    Constructs the declarative LangChain LCEL pipeline:
      ChatPromptTemplate -> ChatGoogleGenerativeAI -> PydanticOutputParser
    """
    key = api_key or settings.GEMINI_API_KEY
    if not key:
        logger.warning("No GEMINI_API_KEY provided; LangChain chain cannot initialize LLM.")
        return None

    # 1. Output Parser enforces Pydantic JSON structure
    parser = PydanticOutputParser(pydantic_object=JournalAnswerSchema)

    # 2. Prompt Template with system instructions, context injection, and format instructions
    prompt = ChatPromptTemplate.from_messages([
        (
            "system",
            """You are a personal journal knowledge assistant.
Your goal is to answer the user's question about their personal history, emotions, habits, and reflections strictly based on the provided journal snippets.

[CONTEXT FROM JOURNAL]:
{context}

[FORMAT INSTRUCTIONS]:
{format_instructions}

[CONSTRAINTS]:
- Only answer based on the facts and dates mentioned in the journal snippets.
- If the journal does not contain information to answer the question, state: "I couldn't find any mention of that in your journal entries" and set confidence to 'insufficient_data'.
- Always include the relevant dates (YYYY-MM-DD) from the snippets in `source_dates`.
- Do not invent facts or extrapolate beyond what is written.
"""
        ),
        ("human", "{question}"),
    ])

    # 3. Model initialization with low temperature for high fidelity
    llm = ChatGoogleGenerativeAI(
        model=settings.GEMINI_MODEL,
        google_api_key=key,
        temperature=0.1,
    )

    # 4. Declarative Chain Composition via LCEL (LangChain Expression Language)
    chain = prompt | llm | parser
    return chain, parser


def ask_journal_with_langchain(
    question: str,
    retrieved_entries: List[Dict[str, Any]],
) -> JournalAnswerSchema:
    """
    Executes the LangChain RAG chain over retrieved journal entries.
    """
    # Format retrieved journal entries into context string
    if not retrieved_entries:
        return JournalAnswerSchema(
            answer="No relevant past journal entries were found matching your question. Try writing more entries or adjusting your query.",
            source_dates=[],
            confidence="insufficient_data",
        )

    context_snippets = []
    source_dates_all = []
    for item in retrieved_entries:
        entry_date = item.get("date", "Unknown Date")
        content = item.get("content", "").strip()
        mood = item.get("mood", "")
        mood_str = f" [Mood: {mood}]" if mood else ""
        context_snippets.append(f"Date: {entry_date}{mood_str}\nEntry:\n{content}\n---")
        if entry_date != "Unknown Date":
            source_dates_all.append(entry_date)

    context_str = "\n".join(context_snippets)

    chain_tuple = build_ask_journal_chain()
    if not chain_tuple:
        # Fallback response if API key is not present
        return _fallback_langchain_answer(question, retrieved_entries)

    chain, parser = chain_tuple

    try:
        result: JournalAnswerSchema = chain.invoke({
            "context": context_str,
            "question": question,
            "format_instructions": parser.get_format_instructions(),
        })
        return result
    except Exception as e:
        logger.error(f"LangChain execution error: {e}")
        return _fallback_langchain_answer(question, retrieved_entries)


def _fallback_langchain_answer(question: str, retrieved_entries: List[Dict[str, Any]]) -> JournalAnswerSchema:
    """Fallback synthesizer when LLM invocation fails or is offline."""
    if not retrieved_entries:
        return JournalAnswerSchema(
            answer="No relevant journal entries were found for your query.",
            source_dates=[],
            confidence="insufficient_data",
        )

    # Extract dates and preview snippets
    dates = [e.get("date", "") for e in retrieved_entries if e.get("date")]
    sample_entry = retrieved_entries[0].get("content", "")[:200]

    return JournalAnswerSchema(
        answer=f"Based on your entries from {', '.join(dates[:3])}: You noted reflections such as: \"{sample_entry}...\"",
        source_dates=dates[:3],
        confidence="moderate",
    )
