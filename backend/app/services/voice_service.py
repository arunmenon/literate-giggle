"""
Voice AI Service Layer.

Wraps Sarvam AI STT (primary) and OpenAI Whisper (fallback) for speech-to-text,
and OpenAI TTS / Sarvam Bulbul for text-to-speech.

DPDP compliance: Audio is NEVER stored. Only text transcripts are persisted.
"""

import io
import logging
from typing import Optional

import httpx

from ..core.config import settings

logger = logging.getLogger(__name__)


class VoiceService:
    """
    Speech-to-text and text-to-speech service.

    STT priority: Sarvam AI -> OpenAI Whisper
    TTS priority: OpenAI TTS -> Sarvam Bulbul
    """

    def __init__(self):
        self._openai_client = None
        self._initialized = False

    def _ensure_openai_client(self) -> bool:
        """Lazily initialize the OpenAI client. Returns True if available."""
        if self._initialized:
            return self._openai_client is not None

        self._initialized = True

        if not settings.OPENAI_API_KEY:
            logger.warning("OPENAI_API_KEY not set -- voice features will be limited")
            return False

        try:
            import openai
            self._openai_client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            logger.info("Voice service OpenAI client initialized")
            return True
        except ImportError:
            logger.error("openai package not installed")
            return False
        except Exception as exc:
            logger.error("Failed to initialize OpenAI client for voice: %s", exc)
            return False

    @property
    def is_available(self) -> bool:
        """Check if at least one STT backend is available."""
        return bool(settings.SARVAM_API_KEY) or self._ensure_openai_client()

    async def transcribe_audio(
        self,
        audio_bytes: bytes,
        language: str = "en",
        content_type: str = "audio/webm",
    ) -> Optional[str]:
        """
        Transcribe audio bytes to text.

        Tries Sarvam AI first (if configured), falls back to OpenAI Whisper.
        Audio is processed in-memory only -- never written to disk.

        Args:
            audio_bytes: Raw audio data (WebM, WAV, MP3, etc.)
            language: BCP-47 language code (e.g., "en", "hi", "hi-IN")
            content_type: MIME type of the audio

        Returns:
            Transcribed text, or None if all backends fail.
        """
        if not audio_bytes:
            return None

        # Try Sarvam AI first
        if settings.SARVAM_API_KEY:
            result = await self._transcribe_sarvam(audio_bytes, language, content_type)
            if result is not None:
                return result
            logger.warning("Sarvam STT failed, falling back to Whisper")

        # Fallback to OpenAI Whisper
        if self._ensure_openai_client():
            result = await self._transcribe_whisper(audio_bytes, language, content_type)
            if result is not None:
                return result

        logger.error("All STT backends failed")
        return None

    async def text_to_speech(
        self,
        text: str,
        voice: str = "alloy",
        response_format: str = "mp3",
    ) -> Optional[bytes]:
        """
        Convert text to speech audio.

        Uses OpenAI TTS API (primary) or Sarvam Bulbul (fallback).

        Args:
            text: Text to synthesize.
            voice: Voice identifier (OpenAI: alloy, echo, fable, onyx, nova, shimmer).
            response_format: Output format (mp3, opus, aac, flac, wav, pcm).

        Returns:
            Audio bytes, or None if TTS is unavailable.
        """
        if not text:
            return None

        # Try OpenAI TTS first
        if self._ensure_openai_client():
            result = await self._tts_openai(text, voice, response_format)
            if result is not None:
                return result

        # Fallback to Sarvam Bulbul
        if settings.SARVAM_TTS_API_KEY or settings.SARVAM_API_KEY:
            result = await self._tts_sarvam(text)
            if result is not None:
                return result

        logger.error("All TTS backends failed")
        return None

    # -- Sarvam AI STT --

    async def _transcribe_sarvam(
        self,
        audio_bytes: bytes,
        language: str,
        content_type: str,
    ) -> Optional[str]:
        """Transcribe via Sarvam AI Speech-to-Text API."""
        try:
            # Map simple language codes to Sarvam format
            sarvam_lang = _map_language_sarvam(language)

            # Determine file extension from content type
            ext = _content_type_to_ext(content_type)

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    "https://api.sarvam.ai/speech-to-text",
                    headers={
                        "API-Subscription-Key": settings.SARVAM_API_KEY,
                    },
                    files={
                        "file": (f"audio.{ext}", io.BytesIO(audio_bytes), content_type),
                    },
                    data={
                        "language_code": sarvam_lang,
                        "model": "saarika:v2",
                    },
                )
                response.raise_for_status()
                data = response.json()
                transcript = data.get("transcript", "").strip()
                if transcript:
                    logger.debug("Sarvam STT success: %d chars", len(transcript))
                    return transcript
                return None

        except httpx.HTTPStatusError as exc:
            logger.error("Sarvam STT HTTP error %d: %s", exc.response.status_code, exc.response.text[:200])
            return None
        except Exception as exc:
            logger.error("Sarvam STT error: %s", exc)
            return None

    # -- OpenAI Whisper STT --

    async def _transcribe_whisper(
        self,
        audio_bytes: bytes,
        language: str,
        content_type: str,
    ) -> Optional[str]:
        """Transcribe via OpenAI Whisper API."""
        try:
            ext = _content_type_to_ext(content_type)
            # Whisper expects a file-like object with a name
            audio_file = io.BytesIO(audio_bytes)
            audio_file.name = f"audio.{ext}"

            # Map language to ISO 639-1 for Whisper
            whisper_lang = language.split("-")[0] if "-" in language else language

            response = await self._openai_client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                language=whisper_lang if whisper_lang != "auto" else None,
            )
            transcript = response.text.strip()
            if transcript:
                logger.debug("Whisper STT success: %d chars", len(transcript))
                return transcript
            return None

        except Exception as exc:
            logger.error("Whisper STT error: %s", exc)
            return None

    # -- OpenAI TTS --

    async def _tts_openai(
        self,
        text: str,
        voice: str,
        response_format: str,
    ) -> Optional[bytes]:
        """Generate speech via OpenAI TTS API."""
        try:
            response = await self._openai_client.audio.speech.create(
                model="tts-1",
                voice=voice,
                input=text,
                response_format=response_format,
            )
            audio_bytes = await response.aread()
            logger.debug("OpenAI TTS success: %d bytes", len(audio_bytes))
            return audio_bytes

        except Exception as exc:
            logger.error("OpenAI TTS error: %s", exc)
            return None

    # -- Voice-to-intent parsing (teacher workflows) --

    async def parse_voice_intent(self, transcribed_text: str) -> Optional[dict]:
        """
        Parse a teacher's natural language voice command into structured parameters.

        Uses AI to extract structured intent from commands like:
        "Generate 5 MCQs on photosynthesis for Class 10 ICSE, medium difficulty"

        Returns dict with keys:
            action, subject, topic, class_grade, count, type, difficulty, marks_each

        Returns None if AI is unavailable.
        """
        from .ai_service import ai_service

        if not ai_service.is_available:
            return None

        prompt = (
            f"Parse this teacher's voice command into a structured JSON object.\n\n"
            f"Voice command: \"{transcribed_text}\"\n\n"
            f"Extract these fields (use null for any field not mentioned):\n"
            f"- action: one of 'generate_questions', 'create_paper', 'evaluate', 'search_questions', 'other'\n"
            f"- subject: the academic subject (e.g., 'Science', 'Mathematics', 'English')\n"
            f"- topic: the specific topic (e.g., 'Photosynthesis', 'Quadratic Equations')\n"
            f"- class_grade: integer class/grade number (7-12)\n"
            f"- board: 'CBSE', 'ICSE', or 'State Board'\n"
            f"- count: number of questions requested (integer)\n"
            f"- type: question type - one of 'mcq', 'short_answer', 'long_answer', 'very_short', "
            f"'fill_blank', 'true_false', 'match', 'diagram', 'numerical', 'case_study'\n"
            f"- difficulty: 'easy', 'medium', 'hard'\n"
            f"- marks_each: marks per question (integer)\n"
            f"- raw_text: the original transcribed text\n\n"
            f"Respond with ONLY valid JSON. No explanation."
        )

        import json
        result = await ai_service.generate_fast(
            prompt,
            system="You are a command parser. Output only valid JSON.",
            temperature=0.1,
            use_cache=False,
        )

        if not result:
            return None

        try:
            # Strip markdown code fences if present
            cleaned = result.strip()
            if cleaned.startswith("```"):
                lines = cleaned.split("\n")
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
                cleaned = "\n".join(json_lines)

            parsed = json.loads(cleaned)
            # Ensure raw_text is preserved
            parsed["raw_text"] = transcribed_text
            return parsed
        except (json.JSONDecodeError, ValueError) as exc:
            logger.error("Failed to parse voice intent: %s", exc)
            return None

    # -- Sarvam Bulbul TTS --

    async def _tts_sarvam(self, text: str) -> Optional[bytes]:
        """Generate speech via Sarvam Bulbul TTS API."""
        try:
            api_key = settings.SARVAM_TTS_API_KEY or settings.SARVAM_API_KEY

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    "https://api.sarvam.ai/text-to-speech",
                    headers={
                        "API-Subscription-Key": api_key,
                        "Content-Type": "application/json",
                    },
                    json={
                        "inputs": [text],
                        "target_language_code": "en-IN",
                        "speaker": "meera",
                        "model": "bulbul:v1",
                    },
                )
                response.raise_for_status()
                data = response.json()
                # Sarvam returns base64-encoded audio
                import base64
                audios = data.get("audios", [])
                if audios:
                    audio_bytes = base64.b64decode(audios[0])
                    logger.debug("Sarvam TTS success: %d bytes", len(audio_bytes))
                    return audio_bytes
                return None

        except Exception as exc:
            logger.error("Sarvam TTS error: %s", exc)
            return None


def _map_language_sarvam(language: str) -> str:
    """Map BCP-47 language codes to Sarvam API language codes."""
    mapping = {
        "en": "en-IN",
        "hi": "hi-IN",
        "bn": "bn-IN",
        "ta": "ta-IN",
        "te": "te-IN",
        "mr": "mr-IN",
        "gu": "gu-IN",
        "kn": "kn-IN",
        "ml": "ml-IN",
        "pa": "pa-IN",
        "or": "od-IN",
    }
    # If already in xx-XX format, use as-is
    if "-" in language:
        return language
    return mapping.get(language, "en-IN")


def _content_type_to_ext(content_type: str) -> str:
    """Map MIME content type to file extension."""
    mapping = {
        "audio/webm": "webm",
        "audio/wav": "wav",
        "audio/wave": "wav",
        "audio/x-wav": "wav",
        "audio/mp3": "mp3",
        "audio/mpeg": "mp3",
        "audio/ogg": "ogg",
        "audio/flac": "flac",
        "audio/mp4": "m4a",
        "audio/x-m4a": "m4a",
    }
    return mapping.get(content_type, "webm")


# Singleton instance
voice_service = VoiceService()
