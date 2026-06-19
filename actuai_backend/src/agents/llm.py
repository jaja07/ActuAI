"""
agents/llm.py — One simple interface to every model (synchronous).

THE PROBLEM THIS SOLVES
-----------------------
The report uses THREE different models on TWO different backends:
  - Supervisor      -> Llama 3.1 8B, LOCAL via Ollama
  - Transactional   -> Mistral-Nemo 12B, CLOUD (NVIDIA NIM / Azure)
  - Investigative   -> Llama 3.1 70B, CLOUD

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


class OllamaClient(LLMClient):
    """Talks to a local Ollama server on the edge box (the Supervisor model)."""

    def __init__(self, model: str):
        self.model = model
        self.base_url = settings.OLLAMA_BASE_URL.rstrip("/")

    def chat(self, system: str, user: str) -> str:
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "stream": False,
            # Low temperature -> deterministic routing/extraction, fewer surprises.
            "options": {"temperature": 0.1},
        }
        resp = requests.post(f"{self.base_url}/api/chat", json=payload, timeout=60)
        resp.raise_for_status()
        return resp.json()["message"]["content"]


class CloudOpenAIClient(LLMClient):
    """
    Talks to any OpenAI-compatible cloud endpoint (NVIDIA NIM, Azure, etc.) for
    the heavy Transactional and Investigative models. The API key comes from the
    environment and is never logged.
    """

    def __init__(self, model: str):
        self.model = model
        self.base_url = settings.CLOUD_LLM_BASE_URL.rstrip("/")
        self.api_key = settings.CLOUD_LLM_API_KEY

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
    A deterministic fake model. Used in CI and when USE_MOCK_LLM=true so the
    whole system runs with zero external dependencies. It returns canned, valid
    JSON so the agents' parsing logic can be tested reliably.
    """

    def __init__(self, role: str):
        self.role = role

    def chat(self, system: str, user: str) -> str:
        text = user.lower()
        m = re.search(r"PO-[A-Za-z0-9\-]+", user)
        po = m.group(0) if m else "PO-A350-88123"
        if self.role == "supervisor":
            # Heuristic routing for the stub model (demo without a real LLM).
            # We use word BOUNDARIES (\b) so a keyword doesn't match inside
            # another word. We test reporting words first (delay/shipping) ->
            # transactional, THEN delivery-time questions -> responder.
            report_re = r"\b(delay\w*|retard\w*|shipped|exp[ée]di\w*|fnc|schedul\w*|planning)\b"
            enquiry_re = (r"\b(when will|when can|delivery time|lead time|eta|"
                          r"estimated delivery|how long|d[ée]lai\w*|livr\w*)\b")
            if re.search(report_re, text):
                return "transactional"
            if re.search(enquiry_re, text):
                return "responder"
            return "investigative"
        if self.role == "transactional":
            return (
                '{"po_number": "' + po + '", "new_status": "DELAYED", '
                '"delay_days": 8, "confidence": "high"}'
            )
        if self.role == "responder":
            # The mock responder is called twice: once to extract, once to draft.
            if "purchase order or equipment reference" in system.lower():
                return '{"po_number": "' + po + '", "part_hint": "actuator"}'
            return (
                '{"subject": "Your delivery update — good news!", '
                '"body": "Dear valued partner,\\n\\nThank you for reaching out. '
                'We are delighted to confirm your order is on track for delivery '
                'on the forecast date shown in our system. We truly appreciate '
                'your partnership and remain at your full disposal.\\n\\n'
                'Warm regards,\\nActuAI Customer Service"}'
            )
        return (
            '{"answer": "Retrieved the latest matching document version.", '
            '"sources": ["DF-A350-007-v3.pdf"]}'
        )


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
        client = OllamaClient(settings.SUPERVISOR_MODEL)
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
