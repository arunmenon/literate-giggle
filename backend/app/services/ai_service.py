"""
Unified AI Service Layer.

Wraps the OpenAI API with model selection, structured output parsing,
streaming support, caching, and graceful degradation.
"""

import hashlib
import json
import logging
import time
from collections import OrderedDict
from typing import Any, AsyncIterator, Optional, Type, TypeVar

from pydantic import BaseModel

from ..core.config import settings

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


class _LRUCache:
    """Simple in-memory LRU cache for repeated identical prompts."""

    def __init__(self, max_size: int = 256):
        self._cache: OrderedDict[str, tuple[Any, float]] = OrderedDict()
        self._max_size = max_size
        self._ttl_seconds = 3600  # 1 hour

    def _make_key(self, model: str, system: str, prompt: str) -> str:
        raw = f"{model}:{system}:{prompt}"
        return hashlib.sha256(raw.encode()).hexdigest()

    def get(self, model: str, system: str, prompt: str) -> Optional[str]:
        key = self._make_key(model, system, prompt)
        if key in self._cache:
            value, timestamp = self._cache[key]
            if time.time() - timestamp < self._ttl_seconds:
                self._cache.move_to_end(key)
                return value
            else:
                del self._cache[key]
        return None

    def put(self, model: str, system: str, prompt: str, value: str) -> None:
        key = self._make_key(model, system, prompt)
        self._cache[key] = (value, time.time())
        self._cache.move_to_end(key)
        if len(self._cache) > self._max_size:
            self._cache.popitem(last=False)


class AIService:
    """
    Unified AI service wrapping OpenAI's API.

    Provides:
    - Model selection (fast vs standard)
    - Structured output parsing with Pydantic models
    - Streaming responses for real-time SSE
    - In-memory LRU caching for repeated prompts
    - Graceful degradation when API key is missing or API fails
    """

    def __init__(self):
        self._client = None
        self._cache = _LRUCache()
        self._initialized = False

    def _ensure_client(self) -> bool:
        """Lazily initialize the OpenAI client. Returns True if available."""
        if self._initialized:
            return self._client is not None

        self._initialized = True

        if not settings.AI_ENABLED:
            logger.info("AI service disabled via AI_ENABLED=False")
            return False

        if not settings.OPENAI_API_KEY:
            logger.warning("OPENAI_API_KEY not set -- AI features will degrade gracefully")
            return False

        try:
            import openai
            self._client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            logger.info("AI service initialized successfully")
            return True
        except ImportError:
            logger.error("openai package not installed")
            return False
        except Exception as exc:
            logger.error("Failed to initialize OpenAI client: %s", exc)
            return False

    @property
    def is_available(self) -> bool:
        """Check whether the AI service is available."""
        return self._ensure_client()

    async def generate(
        self,
        prompt: str,
        *,
        system: str = "",
        model: Optional[str] = None,
        max_tokens: Optional[int] = None,
        temperature: float = 0.7,
        use_cache: bool = True,
    ) -> Optional[str]:
        """
        Generate a text response from the AI.

        Returns the response text, or None if the service is unavailable.
        """
        if not self._ensure_client():
            return None

        resolved_model = model or settings.AI_MODEL_STANDARD
        resolved_max_tokens = max_tokens or settings.AI_MAX_TOKENS_STANDARD

        # Check cache
        if use_cache:
            cached = self._cache.get(resolved_model, system, prompt)
            if cached is not None:
                logger.debug("Cache hit for prompt (model=%s)", resolved_model)
                return cached

        try:
            messages: list[dict[str, str]] = []
            if system:
                messages.append({"role": "system", "content": system})
            messages.append({"role": "user", "content": prompt})

            kwargs: dict[str, Any] = {
                "model": resolved_model,
                "messages": messages,
                "max_completion_tokens": resolved_max_tokens,
            }
            # GPT-5 series models only support temperature=1
            if not resolved_model.startswith("gpt-5"):
                kwargs["temperature"] = temperature

            response = await self._client.chat.completions.create(**kwargs)
            result_text = response.choices[0].message.content

            if use_cache:
                self._cache.put(resolved_model, system, prompt, result_text)

            return result_text

        except Exception as exc:
            logger.error("AI generation failed: %s", exc)
            return None

    async def generate_structured(
        self,
        prompt: str,
        response_model: Type[T],
        *,
        system: str = "",
        model: Optional[str] = None,
        max_tokens: Optional[int] = None,
        temperature: float = 0.3,
        use_cache: bool = True,
    ) -> Optional[T]:
        """
        Generate a structured response parsed into a Pydantic model.

        Appends JSON format instructions to the prompt and parses the response.
        Returns None if the service is unavailable or parsing fails.
        """
        schema_json = json.dumps(response_model.model_json_schema(), indent=2)
        structured_prompt = (
            f"{prompt}\n\n"
            f"Respond ONLY with valid JSON matching this schema:\n"
            f"```json\n{schema_json}\n```\n"
            f"Do not include any text outside the JSON."
        )

        raw_response = await self.generate(
            structured_prompt,
            system=system,
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            use_cache=use_cache,
        )

        if raw_response is None:
            return None

        try:
            cleaned = _extract_json(raw_response)
            parsed = json.loads(cleaned)
            return response_model.model_validate(parsed)
        except (json.JSONDecodeError, ValueError) as exc:
            logger.error("Failed to parse structured AI response: %s", exc)
            return None

    async def stream_response(
        self,
        prompt: str,
        *,
        system: str = "",
        model: Optional[str] = None,
        max_tokens: Optional[int] = None,
        temperature: float = 0.7,
    ) -> AsyncIterator[str]:
        """
        Stream a response from the AI as an async iterator of text chunks.

        Yields text deltas suitable for Server-Sent Events.
        Yields nothing if the service is unavailable.
        """
        if not self._ensure_client():
            return

        resolved_model = model or settings.AI_MODEL_STANDARD
        resolved_max_tokens = max_tokens or settings.AI_MAX_TOKENS_STANDARD

        try:
            messages: list[dict[str, str]] = []
            if system:
                messages.append({"role": "system", "content": system})
            messages.append({"role": "user", "content": prompt})

            kwargs: dict[str, Any] = {
                "model": resolved_model,
                "messages": messages,
                "max_completion_tokens": resolved_max_tokens,
                "stream": True,
            }
            if not resolved_model.startswith("gpt-5"):
                kwargs["temperature"] = temperature

            response = await self._client.chat.completions.create(**kwargs)

            async for chunk in response:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content

        except Exception as exc:
            logger.error("AI streaming failed: %s", exc)
            yield f"\n[AI Error: {exc}]"

    async def generate_fast(
        self,
        prompt: str,
        *,
        system: str = "",
        max_tokens: Optional[int] = None,
        temperature: float = 0.7,
        use_cache: bool = True,
    ) -> Optional[str]:
        """Convenience method using the fast (mini) model."""
        return await self.generate(
            prompt,
            system=system,
            model=settings.AI_MODEL_FAST,
            max_tokens=max_tokens or settings.AI_MAX_TOKENS_FAST,
            temperature=temperature,
            use_cache=use_cache,
        )

    async def generate_structured_fast(
        self,
        prompt: str,
        response_model: Type[T],
        *,
        system: str = "",
        max_tokens: Optional[int] = None,
        temperature: float = 0.3,
        use_cache: bool = True,
    ) -> Optional[T]:
        """Convenience method for structured output using the fast (mini) model."""
        return await self.generate_structured(
            prompt,
            response_model,
            system=system,
            model=settings.AI_MODEL_FAST,
            max_tokens=max_tokens or settings.AI_MAX_TOKENS_FAST,
            temperature=temperature,
            use_cache=use_cache,
        )


def _extract_json(text: str) -> str:
    """Extract JSON from a response that may contain markdown code blocks."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first line (```json or ```) and last line (```)
        json_lines = []
        in_block = False
        for line in lines:
            if line.strip().startswith("```") and not in_block:
                in_block = True
                continue
            elif line.strip() == "```" and in_block:
                break
            elif in_block:
                json_lines.append(line)
        text = "\n".join(json_lines)
    return text.strip()


# Singleton instance
ai_service = AIService()
