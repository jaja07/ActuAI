"""
agents/investigative — The Investigative Agent (unstructured data / RAG).

ROLE (report 5.2)
-----------------
Handles missions that search large volumes of unstructured text: M4 technical
documentation control and M5 end-to-end traceability. It uses Retrieval-
Augmented Generation (RAG): first retrieve the most relevant document chunks
from the vector store, then ask the big cloud model (Llama 3.1 70B) to answer
grounded ONLY in those chunks.

The retrieval is delegated to ``agents.investigative.retriever`` which targets
Qdrant in production and falls back to a tiny in-memory corpus when Qdrant is
unreachable (so the RAG path runs out of the box). The agent never notices the
difference.
"""

import json

from agents.investigative.retriever import get_retriever
from agents.llm import get_client
from agents.state import GlobalState

_SYSTEM = """You are a documentation assistant for aerospace traceability.
Answer the user's question using ONLY the provided context passages. If the
answer is not in the context, say you could not find it. Return ONLY valid JSON:
  - answer   (string)
  - sources  (list of source filenames you used)
No prose outside the JSON, no markdown fences."""


def _safe_json(text: str) -> dict:
    cleaned = text.strip().replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Fall back to treating the whole reply as the answer.
        return {"answer": cleaned[:1000], "sources": []}


def run_investigative(state: GlobalState) -> GlobalState:
    state.agent = "investigative"
    state.mission = "M4"

    # --- Step 1: retrieve relevant chunks (the "R" in RAG) ---------------
    retriever = get_retriever()
    # ABAC in RAG: only return chunks the caller is cleared to see (report 9.2).
    chunks = retriever.search(query=state.raw_input, k=4, max_clearance=state.clearance)
    state.log(f"Investigative retrieved {len(chunks)} chunk(s)")

    if not chunks:
        state.draft_summary = "No matching documents found for this query."
        state.draft_payload = {"kind": "RAG_ANSWER", "answer": "No documents matched.", "sources": []}
        return state

    # --- Step 2: build the grounded prompt -------------------------------
    def _label(c: dict) -> str:
        # Mission 4 version control: cite the document WITH its revision so
        # the expert immediately sees which version grounded the answer.
        return f"{c['source']} (rev {c['revision']})" if c.get("revision") else c["source"]

    context = "\n\n".join(f"[{_label(c)}]\n{c['text']}" for c in chunks)
    user_prompt = f"CONTEXT PASSAGES:\n{context}\n\nQUESTION:\n{state.raw_input}"

    # --- Step 3: ask the big model, grounded in the context --------------
    client = get_client("investigative")
    result = _safe_json(client.chat(_SYSTEM, user_prompt))

    state.draft_summary = result.get("answer", "")[:200]
    state.draft_payload = {
        "kind": "RAG_ANSWER",
        "answer": result.get("answer", ""),
        "sources": result.get("sources", [_label(c) for c in chunks]),
        "query": state.raw_input[:500],
    }
    return state
