"""
agents/llm.py — One simple interface to every model (synchronous).

THE PROBLEM THIS SOLVES
-----------------------
The system uses THREE different models, all served by NVIDIA NIM through its
OpenAI-compatible endpoint (``CLOUD_LLM_BASE_URL``):
  - Supervisor      -> Llama 3.1 8B  (fast/cheap routing, called every cycle)
  - Transactional   -> Mistral-Nemo 12B
  - Investigative   -> Llama 3.1 70B

We don't want each agent to know HOW to call its model. So we define ONE tiny
interface — ``LLMClient.chat(system, user) -> str`` — and a few implementations
behind it. An agent just says "give me my client" and calls ``.chat(...)``.

Changing the mapping in ``get_client(role)`` or an env var changes the model —
no agent code touched. Calls use the synchronous ``requests`` client to stay
consistent with the rest of the (sync) backend.
"""

from __future__ import annotations

import re

import requests

from config import settings


class LLMClient:
    """Base interface. Every backend implements ``chat``."""

    def chat(self, system: str, user: str) -> str:
        raise NotImplementedError


class CloudOpenAIClient(LLMClient):
    """
    Talks to any OpenAI-compatible cloud endpoint (NVIDIA NIM by default) for
    every agent role. The API key comes from the environment and is never logged.
    """

    def __init__(self, model: str):
        self.model = model
        self.base_url = settings.CLOUD_LLM_BASE_URL.rstrip("/")
        self.api_key = settings.NVIDIA_API_KEY

    def chat(self, system: str, user: str) -> str:
        headers = {"Authorization": f"Bearer {self.api_key}"}
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0.1,
        }
        resp = requests.post(
            f"{self.base_url}/chat/completions", json=payload, headers=headers, timeout=120
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]


class MockClient(LLMClient):
    """
    Stub used when USE_MOCK_LLM=true. Lets the backend run end-to-end with no
    NVIDIA key — useful for local dev, tests and demos without connectivity.
    Returns minimal valid JSON that each agent's parser accepts.
    """

    def __init__(self, role: str):
        self.role = role

    def chat(self, system: str, user: str) -> str:
        m = re.search(r"PO-[A-Za-z0-9\-]+", user)
        po = m.group(0) if m else "PO-A350-88123"
        text = user.lower()
        if self.role == "supervisor":
            # Cheap keyword routing that mirrors the real router's intent
            # taxonomy, so every mission is reachable in mock mode.
            if any(k in text for k in ("historique complet", "complete history", "full history", "audit du num")):
                return "traceability"
            if any(k in text for k in ("when will", "delivery time", "quand sera", "confirm the delivery", "eta?")):
                return "responder"
            if any(k in text for k in ("where is", "find the", "document", "certificate", "record")):
                return "investigative"
            return "transactional"
        if self.role == "transactional":
            if any(k in text for k in ("fnc", "non-conform", "non conform", "défaut", "defect", "rayure")):
                return f'{{"request_type": "CREATE_FNC", "po_number": "{po}", "defect_type": "Rayure sur carter", "confidence": "high"}}'
            return f'{{"request_type": "DELAY_REPORT", "po_number": "{po}", "new_status": "DELAYED", "delay_days": 8, "confidence": "high"}}'
        if self.role == "responder":
            if "purchase order or equipment reference" in system.lower():
                return f'{{"po_number": "{po}", "part_hint": "actuator"}}'
            return '{"subject": "Delivery update", "body": "Dear partner,\\n\\nYour order is on track.\\n\\nRegards,\\nActuAI Customer Service"}'
        if "traceability auditor" in system.lower():
            return '{"narrative": "Component ordered, received, and integrated with no anomalies."}'
        return '{"answer": "Document retrieved.", "sources": ["DF-A350-007-v3.pdf"]}'


# Cache clients so we don't rebuild them on every call.
_CACHE: dict[str, LLMClient] = {}


def get_client(role: str) -> LLMClient:
    """
    Return the right model client for an agent role:
        "supervisor" | "transactional" | "investigative" | "responder"

    This single function is the switchboard between agents and models.
    """
    if role in _CACHE:
        return _CACHE[role]

    if settings.USE_MOCK_LLM:
        client: LLMClient = MockClient(role)
    elif role == "supervisor":
        client = CloudOpenAIClient(settings.SUPERVISOR_MODEL)
    elif role == "transactional":
        client = CloudOpenAIClient(settings.TRANSACTIONAL_MODEL)
    elif role == "investigative":
        client = CloudOpenAIClient(settings.INVESTIGATIVE_MODEL)
    elif role == "responder":
        client = CloudOpenAIClient(settings.RESPONDER_MODEL)
    else:
        raise ValueError(f"Unknown agent role: {role}")

    _CACHE[role] = client
    return client
