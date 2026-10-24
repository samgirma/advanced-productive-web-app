"""
Gemini AI Service Module for Productive
=======================================
Integrates the official `google-genai` SDK for:
1. Natural language task extraction via Function Calling (Tool use).
2. Structured Journal Insights using Pydantic JSON schemas.
3. Weekly AI Performance Coach with strict privacy preservation.

Prompt Engineering Techniques (Explicitly documented inline):
- System Role Definition
- Clear Explicit Instructions
- Output Format Specification (JSON Schema)
- Few-Shot Grounding Example
- Strict Negative Constraints ("Do not invent facts / hallucinate")

Cross-LLM Conceptual Attribution:
- Tool/Function Calling contract & JSON schema validation: Inspired by OpenAI Tool Calling conventions.
- Rigid Role Demarcation & Negative Constraints ("constitutional guardrails"): Inspired by Anthropic Claude documentation.
- Semantic Chunking & Grounded Retrieval Context: Inspired by Google & OpenAI Cookbooks.
All calls strictly execute against Google Gemini models using the official `google-genai` SDK.
"""

import json
import logging
import re
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from zoneinfo import ZoneInfo

from google import genai
from google.genai import types
from google.genai.errors import APIError

from app.core.config import settings
from app.schemas.ai import (
    CandidateTask,
    NaturalLanguageTaskResponse,
    JournalInsightsSchema,
    AICoachReviewResponse,
)

logger = logging.getLogger("productive.ai")


def get_genai_client() -> Optional[genai.Client]:
    """
    Initializes and returns the official Google GenAI SDK client.
    Returns None if no API key is provided, allowing graceful degradation.
    """
    if not settings.GEMINI_API_KEY:
        return None
    try:
        return genai.Client(api_key=settings.GEMINI_API_KEY)
    except Exception as e:
        logger.error(f"Failed to initialize google-genai Client: {e}")
        return None


# ============================================================================
# 1. FUNCTION CALLING: Natural Language Task Creation
# ============================================================================
# Explanation of Function Calling:
# Instead of returning raw prose, the model is given a structured function signature
# (`create_task`). The model analyzes the user's natural language input, resolves relative
# dates/times against the user's reference timestamp and timezone, and emits machine-readable
# arguments invoking `create_task`. The application parses these arguments and renders them
# as candidate tasks for user confirmation before inserting into the database.
# ============================================================================

def create_task_tool_declaration() -> types.Tool:
    """
    Defines the `create_task` tool schema for Gemini Function Calling.
    """
    return types.Tool(
        function_declarations=[
            types.FunctionDeclaration(
                name="create_task",
                description="Creates a planned calendar task with start and end times in ISO 8601 format (UTC).",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "title": types.Schema(
                            type=types.Type.STRING,
                            description="Short title or description of the task (e.g. 'Gym workout', 'Study Chapter 4')",
                        ),
                        "start_time": types.Schema(
                            type=types.Type.STRING,
                            description="Start timestamp in ISO 8601 format with UTC offset, e.g. '2026-10-25T18:00:00Z'",
                        ),
                        "end_time": types.Schema(
                            type=types.Type.STRING,
                            description="End timestamp in ISO 8601 format with UTC offset, e.g. '2026-10-25T19:00:00Z'",
                        ),
                    },
                    required=["title", "start_time", "end_time"],
                ),
            )
        ]
    )


def parse_natural_language_tasks(
    query: str,
    user_timezone_str: str = "UTC",
    reference_dt: Optional[datetime] = None,
) -> NaturalLanguageTaskResponse:
    """
    Converts unstructured natural language into structured task proposals via Gemini Function Calling.
    Candidate tasks are returned to the user for explicit confirmation before database persistence.
    """
    client = get_genai_client()

    # Timezone resolution
    try:
        user_tz = ZoneInfo(user_timezone_str)
    except Exception:
        user_tz = ZoneInfo("UTC")

    now_user_tz = reference_dt or datetime.now(user_tz)
    now_str = now_user_tz.strftime("%Y-%m-%d %H:%M (%A)")

    # -------------------------------------------------------------
    # PROMPT ENGINEERING APPLIED:
    # 1. [Role Definition]: Expert calendar and productivity scheduling assistant.
    # 2. [Clear Instructions]: Explicit guidelines on parsing relative times, AM/PM, and dates.
    # 3. [Few-Shot Grounding Example]: One concrete reference input/output pairing.
    # 4. [Negative Constraint]: "Do not invent facts or create tasks not requested by the user."
    # -------------------------------------------------------------
    system_instruction = f"""
[ROLE]
You are an expert productivity assistant that translates human scheduling intents into exact calendar tasks.

[CONTEXT]
The user's current local date and time is: {now_str} in timezone: {user_timezone_str}.

[INSTRUCTIONS]
1. Parse all planned activities described in the user prompt.
2. For each activity, call the `create_task` tool with `title`, `start_time`, and `end_time`.
3. All start_time and end_time values MUST be valid ISO 8601 timestamps in UTC ('YYYY-MM-DDTHH:MM:SSZ').
4. If the user does not specify an explicit end time for an activity, default duration to 60 minutes.
5. If the user specifies 'tomorrow' or a day of week, calculate the exact date based on the user's current date ({now_str}).

[FEW-SHOT EXAMPLE]
Current Time: 2026-10-24 14:00 (Saturday) in America/New_York (UTC-4)
User Input: "gym tomorrow 6 to 7pm and study 8 to 10"
Function Calls:
- create_task(title="Gym", start_time="2026-10-25T22:00:00Z", end_time="2026-10-25T23:00:00Z")
- create_task(title="Study", start_time="2026-10-26T00:00:00Z", end_time="2026-10-26T02:00:00Z")

[NEGATIVE CONSTRAINT]
Do not invent facts, tasks, or dates that the user did not specify.
Call `create_task` once per detected task.
"""

    if not client:
        # Graceful fallback parser for offline/test environments without API key
        return _fallback_regex_task_parser(query, now_user_tz, user_tz)

    try:
        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            tools=[create_task_tool_declaration()],
            temperature=0.1,  # Low temperature for deterministic, factual scheduling
        )

        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=query,
            config=config,
        )

        candidate_tasks: List[CandidateTask] = []

        # Inspect tool calls made by the model
        if response.function_calls:
            for call in response.function_calls:
                if call.name == "create_task":
                    args = call.args or {}
                    candidate_tasks.append(
                        CandidateTask(
                            title=str(args.get("title", "Untitled Task")).strip(),
                            planned_start_time=str(args.get("start_time")),
                            planned_end_time=str(args.get("end_time")),
                        )
                    )

        if not candidate_tasks:
            # If function calling produced no calls, attempt regex fallback
            return _fallback_regex_task_parser(query, now_user_tz, user_tz)

        return NaturalLanguageTaskResponse(
            candidate_tasks=candidate_tasks,
            explanation=f"Gemini parsed {len(candidate_tasks)} task(s) using function calling based on your timezone ({user_timezone_str}). Please review and confirm before saving.",
        )

    except APIError as api_err:
        logger.error(f"Gemini APIError during task parsing: {api_err}")
        return _handle_gemini_api_error(api_err, fallback_func=lambda: _fallback_regex_task_parser(query, now_user_tz, user_tz))
    except Exception as e:
        logger.error(f"Unexpected error in parse_natural_language_tasks: {e}")
        return _fallback_regex_task_parser(query, now_user_tz, user_tz)


# ============================================================================
# 2. STRUCTURED OUTPUT: AI Journal Insights
# ============================================================================

def generate_journal_insights(journal_content: str, entry_date: str) -> JournalInsightsSchema:
    """
    Extracts structured mood, activities, wins, problems, and tomorrow recommendations
    from a user's daily journal entry using Gemini's native Pydantic schema enforcement.
    """
    if not journal_content or not journal_content.strip():
        return JournalInsightsSchema(
            mood="Neutral",
            key_activities=["Empty journal entry"],
            wins=[],
            problems=[],
            suggestion_for_tomorrow="Write down a few thoughts about your day to gain deeper clarity.",
        )

    client = get_genai_client()

    # -------------------------------------------------------------
    # PROMPT ENGINEERING APPLIED:
    # 1. [Role]: Mindful, non-judgmental reflective journal analysis coach.
    # 2. [Clear Instructions]: Synthesize authentic emotional state, highlights, and blockers.
    # 3. [Output Format]: Strictly validated against JournalInsightsSchema.
    # 4. [Negative Constraint]: "Do not invent facts or presume events not in the user's text."
    # -------------------------------------------------------------
    system_instruction = f"""
[ROLE]
You are a mindful, supportive journaling coach analyzing a personal reflection for date {entry_date}.

[INSTRUCTIONS]
1. Read the journal entry with empathy and accuracy.
2. Determine the user's primary emotional state / mood (e.g., 'Energized', 'Exhausted but Fulfilled', 'Anxious', 'Grateful').
3. Extract key activities accomplished or mentioned.
4. Highlight concrete 'wins' (successes, positive interactions, or gratitude).
5. Identify 'problems' (frustrations, fatigue, obstacles, or setbacks).
6. Formulate exactly ONE constructive, practical suggestion for tomorrow to optimize energy or focus.

[NEGATIVE CONSTRAINT]
Stick strictly to what the user wrote. Do not invent facts, emotional states, or activities not grounded in their words.
"""

    if not client:
        # Fallback heuristic insights
        return _fallback_journal_insights(journal_content)

    try:
        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            response_mime_type="application/json",
            response_schema=JournalInsightsSchema,
            temperature=0.2,
        )

        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=journal_content,
            config=config,
        )

        if not response.text:
            return _fallback_journal_insights(journal_content)

        parsed_json = json.loads(response.text)
        return JournalInsightsSchema(**parsed_json)

    except APIError as api_err:
        logger.error(f"Gemini APIError during journal analysis: {api_err}")
        return _fallback_journal_insights(journal_content)
    except Exception as e:
        logger.error(f"Error parsing Gemini structured journal response: {e}")
        return _fallback_journal_insights(journal_content)


# ============================================================================
# 3. WEEKLY AI COACH: Performance Review (Strict Privacy Guardrail)
# ============================================================================

def generate_ai_coach_review(
    metrics_summary: Dict[str, Any],
    optional_journal_snippets: Optional[List[str]] = None,
    allow_journal_text: bool = False,
) -> AICoachReviewResponse:
    """
    Evaluates weekly productivity performance.
    PRIVACY GUARANTEE: Never includes journal contents unless user explicitly enabled `allow_ai_journal_review`.
    """
    client = get_genai_client()

    journal_context_block = ""
    included_journal = False

    if allow_journal_text and optional_journal_snippets:
        included_journal = True
        sanitized_snippets = "\n".join([f"- {s[:300]}" for s in optional_journal_snippets[:5]])
        journal_context_block = f"\n[USER-PERMITTED JOURNAL CONTEXT (Mindful Reflections)]:\n{sanitized_snippets}\n"
    else:
        journal_context_block = "\n[PRIVACY NOTICE]: Journal text is withheld per user privacy settings. Rely purely on metrics.\n"

    # -------------------------------------------------------------
    # PROMPT ENGINEERING APPLIED:
    # 1. [Role]: Elite executive productivity coach.
    # 2. [Clear Instructions]: Analyze data trends: completion rate, on-time percentage, time efficiency, overdue penalties.
    # 3. [Output Constraint]: Exactly 3 high-impact action recommendations.
    # 4. [Negative Constraint]: "Do not invent facts or cite metrics not provided in the input."
    # -------------------------------------------------------------
    system_instruction = f"""
[ROLE]
You are an expert executive productivity coach analyzing a user's recent performance.

[METRICS DATA]
Total Planned Tasks: {metrics_summary.get('total_tasks', 0)}
Completed Tasks: {metrics_summary.get('completed_tasks', 0)} ({metrics_summary.get('completion_rate', 0):.1f}%)
On-Time Tasks: {metrics_summary.get('on_time_tasks', 0)} ({metrics_summary.get('on_time_rate', 0):.1f}%)
Overdue Incidents: {metrics_summary.get('overdue_count', 0)}
Time Efficiency: {metrics_summary.get('time_efficiency_rate', 0):.1f}%
Productivity Score: {metrics_summary.get('productivity_score', 0):.1f} / 100
{journal_context_block}

[INSTRUCTIONS]
1. Assess the strengths demonstrated by the metrics.
2. Pinpoint weaknesses or failure points (such as procrastination, over-scheduling, or overdue drag).
3. Provide EXACTLY 3 specific, actionable recommendations for next week.
4. Deliver a concise motivational summary that is candid, constructive, and inspiring.

[NEGATIVE CONSTRAINT]
Do not hallucinate numbers or invent facts. Base your coaching strictly on the metrics supplied.
"""

    if not client:
        return _fallback_coach_review(metrics_summary, included_journal)

    try:
        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            response_mime_type="application/json",
            response_schema=AICoachReviewResponse,
            temperature=0.3,
        )

        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents="Please generate my weekly performance audit based on the metrics above.",
            config=config,
        )

        if not response.text:
            return _fallback_coach_review(metrics_summary, included_journal)

        parsed_json = json.loads(response.text)
        parsed_json["includes_journal_text"] = included_journal
        return AICoachReviewResponse(**parsed_json)

    except APIError as api_err:
        logger.error(f"Gemini APIError during coach review: {api_err}")
        return _fallback_coach_review(metrics_summary, included_journal)
    except Exception as e:
        logger.error(f"Error parsing Gemini coach response: {e}")
        return _fallback_coach_review(metrics_summary, included_journal)


# ============================================================================
# 4. ERROR HANDLING & FALLBACK IMPLEMENTATIONS
# ============================================================================

def _handle_gemini_api_error(api_err: APIError, fallback_func):
    """
    Translates Google Gemini API errors into informative, friendly responses:
    - 404: Invalid or deprecated model name in settings.
    - 429: Rate limit / Quota exceeded (RESOURCE_EXHAUSTED).
    - 400: Malformed prompt or safety filter activation.
    """
    error_str = str(api_err)
    if "404" in error_str or "NOT_FOUND" in error_str:
        logger.warning(f"Model '{settings.GEMINI_MODEL}' not found. Please verify GEMINI_MODEL in .env.")
    elif "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
        logger.warning("Gemini API rate limit reached. Engaging local fallback parser.")
    else:
        logger.warning(f"Gemini API communication issue: {error_str}")

    return fallback_func()


def _fallback_regex_task_parser(
    query: str,
    now_dt: datetime,
    user_tz: ZoneInfo,
) -> NaturalLanguageTaskResponse:
    """
    Deterministic rule-based fallback parser for local test suites or when no API key is provided.
    Extracts simple patterns like: 'gym tomorrow 6 to 7pm', 'study 8 to 10'.
    """
    tasks: List[CandidateTask] = []
    # Identify if 'tomorrow' is mentioned
    is_tomorrow = "tomorrow" in query.lower()
    base_date = (now_dt + timedelta(days=1)) if is_tomorrow else now_dt

    # Split by conjunctions like 'and', ';'
    clauses = re.split(r"\band\b|;", query, flags=re.IGNORECASE)

    for clause in clauses:
        clean = clause.strip()
        if not clean:
            continue

        # Pattern: [Title] [start] to [end] (am/pm)?
        time_match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|-)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?", clean, re.IGNORECASE)
        if time_match:
            start_hr = int(time_match.group(1))
            end_hr = int(time_match.group(4))
            meridiem = time_match.group(3) or time_match.group(6) or "pm"

            if meridiem.lower() == "pm" and start_hr < 12:
                start_hr += 12
            if meridiem.lower() == "pm" and end_hr < 12:
                end_hr += 12

            start_dt = base_date.replace(hour=start_hr, minute=0, second=0, microsecond=0)
            end_dt = base_date.replace(hour=end_hr, minute=0, second=0, microsecond=0)

            # Strip time expressions from title
            raw_title = clean[: time_match.start()].strip()
            raw_title = re.sub(r"\btomorrow\b|\btoday\b", "", raw_title, flags=re.IGNORECASE).strip()
            title = raw_title.capitalize() if raw_title else "Scheduled Activity"

            start_utc = start_dt.astimezone(timezone.utc)
            end_utc = end_dt.astimezone(timezone.utc)

            tasks.append(
                CandidateTask(
                    title=title,
                    planned_start_time=start_utc.isoformat().replace("+00:00", "Z"),
                    planned_end_time=end_utc.isoformat().replace("+00:00", "Z"),
                )
            )

    if not tasks:
        # Default single task fallback
        start_utc = (base_date + timedelta(hours=1)).astimezone(timezone.utc)
        end_utc = (start_utc + timedelta(hours=1))
        tasks.append(
            CandidateTask(
                title=query[:40].strip() or "New Planned Task",
                planned_start_time=start_utc.isoformat().replace("+00:00", "Z"),
                planned_end_time=end_utc.isoformat().replace("+00:00", "Z"),
            )
        )

    return NaturalLanguageTaskResponse(
        candidate_tasks=tasks,
        explanation=f"Parsed {len(tasks)} task(s) using the deterministic offline parser. Please confirm before scheduling.",
    )


def _fallback_journal_insights(content: str) -> JournalInsightsSchema:
    """Generates structured insights when the Gemini API is unreachable or unconfigured."""
    lower = content.lower()
    mood = "Calm"
    if any(w in lower for w in ["great", "happy", "accomplished", "proud", "win"]):
        mood = "Energized & Confident"
    elif any(w in lower for w in ["tired", "exhausted", "late", "drained"]):
        mood = "Fatigued"
    elif any(w in lower for w in ["stressed", "anxious", "overwhelmed"]):
        mood = "Anxious"

    return JournalInsightsSchema(
        mood=mood,
        key_activities=["Reflection and mindful self-assessment"],
        wins=["Consistently maintained journal practice", "Reflected honestly on daily events"],
        problems=["Review schedule pacing to prevent mid-day cognitive fatigue"],
        suggestion_for_tomorrow="Identify your top 2 needle-moving priorities and tackle them before noon.",
    )


def _fallback_coach_review(metrics: Dict[str, Any], included_journal: bool) -> AICoachReviewResponse:
    """Generates a structured coaching review using offline deterministic evaluation."""
    score = metrics.get("productivity_score", 0)
    completion = metrics.get("completion_rate", 0)
    on_time = metrics.get("on_time_rate", 0)
    overdue = metrics.get("overdue_count", 0)

    strengths = []
    weaknesses = []

    if completion >= 75:
        strengths.append(f"Strong execution rate: Completed {completion:.0f}% of planned objectives.")
    else:
        weaknesses.append(f"Low completion rate ({completion:.0f}%). Consider reducing initial daily commitments.")

    if on_time >= 70:
        strengths.append("High punctuality: Majority of tasks completed within the scheduled window.")
    else:
        weaknesses.append(f"Punctuality slippage: Only {on_time:.0f}% of tasks finished on-time.")

    if overdue > 0:
        weaknesses.append(f"Accumulated {overdue} overdue task(s), which triggered penalty deductions.")
    else:
        strengths.append("Zero overdue tasks: Maintained strict calendar integrity.")

    if not strengths:
        strengths.append("Demonstrated willingness to organize and track personal workflows.")
    if not weaknesses:
        weaknesses.append("Buffer time between intensive tasks could be slightly widened.")

    actions = [
        "Cap daily top-priority tasks at 3 to protect on-time completion rates.",
        "Add a 15-minute buffer after deep-work sessions to prevent schedule cascading.",
        "Review overdue tasks at 17:00 daily to reschedule or discard before bedtime.",
    ]

    motivational = (
        f"You achieved a Productivity Score of {score:.1f}/100 this period. "
        "Consistency compounds: focus on closing tasks on-time next week to unlock a 90+ score!"
    )

    return AICoachReviewResponse(
        strengths=strengths,
        weaknesses=weaknesses,
        action_items=actions,
        motivational_summary=motivational,
        includes_journal_text=included_journal,
    )
