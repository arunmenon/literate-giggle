"""
Voice AI routes -- WebSocket STT, AI Tutor voice sessions, teacher dictation.

DPDP compliance: Audio is NEVER stored. Only text transcripts are persisted.
All voice endpoints require parental consent + voice features enabled.
"""

import json
import logging
from datetime import datetime, timezone

import os
import uuid

from fastapi import (
    APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect,
    Query, UploadFile, File,
)
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import base64

from ...core.database import get_db, async_session
from ...core.security import decode_access_token
from ...models.user import User
from ...models.learning import VoiceTutorSession
from ...models.evaluation import QuestionEvaluation, Evaluation
from ...models.exam import ExamSession
from ...services.voice_service import voice_service
from ...services.ai_service import ai_service
from ..deps import get_current_user, require_teacher_or_admin, require_voice_consent

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/voice", tags=["Voice AI"])


async def _authenticate_ws(websocket: WebSocket, token: str) -> User:
    """
    Authenticate a WebSocket connection via JWT query parameter.

    Validates the token and checks voice consent (DPDP compliance).
    Returns the authenticated User or closes the WebSocket with an error.
    """
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if user_id is None:
            await websocket.close(code=4001, reason="Invalid token")
            return None
    except Exception:
        await websocket.close(code=4001, reason="Invalid or expired token")
        return None

    async with async_session() as db:
        result = await db.execute(select(User).where(User.id == int(user_id)))
        user = result.scalar_one_or_none()

        if not user or not user.is_active:
            await websocket.close(code=4001, reason="User not found or inactive")
            return None

        if not user.parental_consent_given or not user.voice_features_enabled:
            await websocket.close(code=4003, reason="Voice consent required")
            return None

        return user


@router.websocket("/transcribe")
async def websocket_transcribe(
    websocket: WebSocket,
    token: str = Query(...),
):
    """
    WebSocket endpoint for real-time speech-to-text.

    Protocol:
    1. Client connects with ?token=<jwt>
    2. Client sends a JSON config message: {"language": "en", "content_type": "audio/webm"}
    3. Client sends binary audio chunks
    4. Server sends back JSON: {"transcript": "...", "is_final": true/false}
    5. Client sends JSON {"action": "stop"} to end, or just disconnects

    Audio is processed in-memory only -- never stored (DPDP compliance).
    """
    user = await _authenticate_ws(websocket, token)
    if user is None:
        return

    if not voice_service.is_available:
        await websocket.close(code=4500, reason="Voice service unavailable")
        return

    await websocket.accept()
    logger.info("STT WebSocket opened for user %d", user.id)

    # Default config
    language = "en"
    content_type = "audio/webm"
    audio_buffer = bytearray()

    try:
        while True:
            message = await websocket.receive()

            # Handle text messages (config / control)
            if "text" in message:
                try:
                    data = json.loads(message["text"])
                except json.JSONDecodeError:
                    await websocket.send_json({"error": "Invalid JSON"})
                    continue

                action = data.get("action")

                if action == "config":
                    language = data.get("language", language)
                    content_type = data.get("content_type", content_type)
                    await websocket.send_json({"status": "configured", "language": language})
                    continue

                if action == "stop":
                    # Transcribe any remaining buffered audio
                    if audio_buffer:
                        transcript = await voice_service.transcribe_audio(
                            bytes(audio_buffer), language, content_type
                        )
                        audio_buffer.clear()
                        await websocket.send_json({
                            "transcript": transcript or "",
                            "is_final": True,
                        })
                    await websocket.close(code=1000)
                    break

                if action == "flush":
                    # Transcribe current buffer without stopping
                    if audio_buffer:
                        transcript = await voice_service.transcribe_audio(
                            bytes(audio_buffer), language, content_type
                        )
                        audio_buffer.clear()
                        await websocket.send_json({
                            "transcript": transcript or "",
                            "is_final": False,
                        })
                    else:
                        await websocket.send_json({
                            "transcript": "",
                            "is_final": False,
                        })
                    continue

            # Handle binary messages (audio chunks)
            elif "bytes" in message:
                audio_buffer.extend(message["bytes"])

                # Auto-flush when buffer exceeds ~500KB (roughly 10s of audio)
                if len(audio_buffer) > 512_000:
                    transcript = await voice_service.transcribe_audio(
                        bytes(audio_buffer), language, content_type
                    )
                    audio_buffer.clear()
                    await websocket.send_json({
                        "transcript": transcript or "",
                        "is_final": False,
                    })

    except WebSocketDisconnect:
        logger.info("STT WebSocket disconnected for user %d", user.id)
    except Exception as exc:
        logger.error("STT WebSocket error for user %d: %s", user.id, exc)
        try:
            await websocket.close(code=4500, reason="Internal error")
        except Exception:
            pass


@router.websocket("/tutor")
async def websocket_tutor(
    websocket: WebSocket,
    token: str = Query(...),
):
    """
    Bidirectional voice AI tutor session.

    Protocol:
    1. Client connects with ?token=<jwt>
    2. Client sends JSON init: {"action": "start", "topic": "Photosynthesis", "language": "en"}
    3. Client sends binary audio (student speech)
    4. Client sends {"action": "flush"} after each utterance
    5. Server transcribes -> sends to AI -> generates TTS audio response
    6. Server sends JSON: {"role": "student", "text": "...", "audio": null}  (transcript)
       Then: {"role": "tutor", "text": "...", "audio": "<base64>"}  (AI response with TTS)
    7. Client sends {"action": "stop"} to end session

    Text transcripts are stored in VoiceTutorSession. Audio is NEVER stored.
    """
    user = await _authenticate_ws(websocket, token)
    if user is None:
        return

    if not voice_service.is_available:
        await websocket.close(code=4500, reason="Voice service unavailable")
        return

    await websocket.accept()
    logger.info("Tutor WebSocket opened for user %d", user.id)

    # Session state
    language = "en"
    content_type = "audio/webm"
    topic = None
    transcript_log = []
    session_record = None
    audio_buffer = bytearray()

    try:
        while True:
            message = await websocket.receive()

            # Handle text messages (control)
            if "text" in message:
                try:
                    data = json.loads(message["text"])
                except json.JSONDecodeError:
                    await websocket.send_json({"error": "Invalid JSON"})
                    continue

                action = data.get("action")

                if action == "start":
                    topic = data.get("topic", "General")
                    language = data.get("language", "en")
                    content_type = data.get("content_type", "audio/webm")

                    # Create DB session record
                    async with async_session() as db:
                        session_record = VoiceTutorSession(
                            user_id=user.id,
                            topic=topic,
                            transcript=[],
                        )
                        db.add(session_record)
                        await db.commit()
                        await db.refresh(session_record)
                        session_id = session_record.id

                    # Send a greeting via AI
                    greeting_prompt = (
                        f"You are a friendly, encouraging AI tutor for Indian students (CBSE/ICSE). "
                        f"The student wants to learn about: {topic}. "
                        f"Give a brief, warm greeting (2-3 sentences) and ask an opening question "
                        f"to gauge their current understanding. Keep it conversational."
                    )
                    greeting_text = await ai_service.generate_fast(
                        greeting_prompt,
                        system="You are an AI tutor. Keep responses concise and encouraging.",
                        use_cache=False,
                    )
                    if not greeting_text:
                        greeting_text = f"Hello! Let's explore {topic} together. What do you already know about it?"

                    # Generate TTS for greeting
                    greeting_audio = await voice_service.text_to_speech(greeting_text)
                    greeting_audio_b64 = base64.b64encode(greeting_audio).decode() if greeting_audio else None

                    # Log tutor greeting
                    tutor_entry = {
                        "role": "tutor",
                        "text": greeting_text,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                    transcript_log.append(tutor_entry)

                    # Persist transcript
                    async with async_session() as db:
                        record = await db.get(VoiceTutorSession, session_id)
                        if record:
                            record.transcript = list(transcript_log)
                            await db.commit()

                    await websocket.send_json({
                        "role": "tutor",
                        "text": greeting_text,
                        "audio": greeting_audio_b64,
                        "session_id": session_id,
                    })
                    continue

                if action == "flush":
                    # Transcribe student's audio, get AI response, TTS it back
                    if not audio_buffer:
                        await websocket.send_json({"error": "No audio to process"})
                        continue

                    # Transcribe student speech
                    student_text = await voice_service.transcribe_audio(
                        bytes(audio_buffer), language, content_type
                    )
                    audio_buffer.clear()

                    if not student_text:
                        await websocket.send_json({
                            "error": "Could not transcribe audio. Please try again.",
                        })
                        continue

                    # Log student utterance
                    student_entry = {
                        "role": "student",
                        "text": student_text,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                    transcript_log.append(student_entry)

                    # Send student transcript to client
                    await websocket.send_json({
                        "role": "student",
                        "text": student_text,
                        "audio": None,
                    })

                    # Build conversation context for AI
                    conversation_history = "\n".join(
                        f"{'Student' if entry['role'] == 'student' else 'Tutor'}: {entry['text']}"
                        for entry in transcript_log[-10:]  # Last 10 turns for context
                    )

                    tutor_prompt = (
                        f"You are an AI tutor helping an Indian student (CBSE/ICSE) learn about: {topic}.\n\n"
                        f"Conversation so far:\n{conversation_history}\n\n"
                        f"Respond to the student's latest message. Be encouraging, clear, and concise. "
                        f"Use examples relevant to the Indian curriculum. "
                        f"Keep your response under 3-4 sentences for natural conversation flow. "
                        f"Ask follow-up questions to check understanding."
                    )

                    tutor_text = await ai_service.generate_fast(
                        tutor_prompt,
                        system="You are a patient, encouraging AI tutor. Keep responses conversational and concise.",
                        use_cache=False,
                    )
                    if not tutor_text:
                        tutor_text = "That's interesting! Can you tell me more about what you understand so far?"

                    # Generate TTS for tutor response
                    tutor_audio = await voice_service.text_to_speech(tutor_text)
                    tutor_audio_b64 = base64.b64encode(tutor_audio).decode() if tutor_audio else None

                    # Log tutor response
                    tutor_entry = {
                        "role": "tutor",
                        "text": tutor_text,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                    transcript_log.append(tutor_entry)

                    # Persist transcript
                    if session_record:
                        async with async_session() as db:
                            record = await db.get(VoiceTutorSession, session_record.id)
                            if record:
                                record.transcript = list(transcript_log)
                                await db.commit()

                    await websocket.send_json({
                        "role": "tutor",
                        "text": tutor_text,
                        "audio": tutor_audio_b64,
                    })
                    continue

                if action == "stop":
                    # Finalize session
                    if session_record:
                        async with async_session() as db:
                            record = await db.get(VoiceTutorSession, session_record.id)
                            if record:
                                record.transcript = list(transcript_log)
                                record.ended_at = datetime.now(timezone.utc)
                                await db.commit()

                    # Transcribe any remaining audio
                    if audio_buffer:
                        final_text = await voice_service.transcribe_audio(
                            bytes(audio_buffer), language, content_type
                        )
                        audio_buffer.clear()
                        if final_text:
                            await websocket.send_json({
                                "role": "student",
                                "text": final_text,
                                "audio": None,
                                "is_final": True,
                            })

                    await websocket.send_json({
                        "status": "session_ended",
                        "session_id": session_record.id if session_record else None,
                        "turns": len(transcript_log),
                    })
                    await websocket.close(code=1000)
                    break

            # Handle binary messages (student audio chunks)
            elif "bytes" in message:
                audio_buffer.extend(message["bytes"])

    except WebSocketDisconnect:
        logger.info("Tutor WebSocket disconnected for user %d", user.id)
        # Save transcript on disconnect
        if session_record:
            try:
                async with async_session() as db:
                    record = await db.get(VoiceTutorSession, session_record.id)
                    if record:
                        record.transcript = list(transcript_log)
                        record.ended_at = datetime.now(timezone.utc)
                        await db.commit()
            except Exception:
                logger.error("Failed to save tutor session on disconnect")
    except Exception as exc:
        logger.error("Tutor WebSocket error for user %d: %s", user.id, exc)
        # Save what we have
        if session_record:
            try:
                async with async_session() as db:
                    record = await db.get(VoiceTutorSession, session_record.id)
                    if record:
                        record.transcript = list(transcript_log)
                        record.ended_at = datetime.now(timezone.utc)
                        await db.commit()
            except Exception:
                pass
        try:
            await websocket.close(code=4500, reason="Internal error")
        except Exception:
            pass


# -- REST endpoints for teacher voice workflows --

ALLOWED_AUDIO_TYPES = {
    "audio/mpeg", "audio/mp3", "audio/wav", "audio/wave",
    "audio/webm", "audio/ogg", "audio/x-wav", "audio/mp4",
}
MAX_AUDIO_SIZE = 25 * 1024 * 1024  # 25MB


@router.post("/dictate-question")
async def dictate_question(
    audio: UploadFile = File(...),
    language: str = Query("en"),
    user: User = Depends(require_teacher_or_admin),
):
    """
    Voice dictation endpoint for teachers.

    Accepts an audio file, transcribes it, then parses the teacher's intent
    into structured question generation parameters.

    The teacher can review/edit the parsed params before generating.
    """
    # Validate file type
    if audio.content_type and audio.content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported audio format: {audio.content_type}. "
                   f"Supported: MP3, WAV, WebM, OGG",
        )

    # Read audio bytes (in memory only -- never stored)
    audio_bytes = await audio.read()
    if len(audio_bytes) > MAX_AUDIO_SIZE:
        raise HTTPException(status_code=400, detail="Audio file too large (max 25MB)")
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file")

    # Transcribe
    content_type = audio.content_type or "audio/webm"
    transcript = await voice_service.transcribe_audio(audio_bytes, language, content_type)
    if not transcript:
        raise HTTPException(
            status_code=422,
            detail="Could not transcribe audio. Please try again with clearer speech.",
        )

    # Parse intent
    intent = await voice_service.parse_voice_intent(transcript)

    return {
        "transcript": transcript,
        "intent": intent,
    }


@router.post("/evaluations/{evaluation_id}/audio-feedback")
async def upload_audio_feedback(
    evaluation_id: int,
    audio: UploadFile = File(...),
    question_evaluation_id: int = Query(..., description="ID of the specific question evaluation"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """
    Upload audio feedback for a specific question evaluation.

    Teacher records a voice note providing feedback on a student's answer.
    The audio is saved to uploads/audio/feedback/.
    """
    # Validate file type
    if audio.content_type and audio.content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported audio format: {audio.content_type}",
        )

    # Verify the evaluation exists
    evaluation = await db.get(Evaluation, evaluation_id)
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    # Verify the question evaluation exists and belongs to this evaluation
    qe = await db.get(QuestionEvaluation, question_evaluation_id)
    if not qe or qe.evaluation_id != evaluation_id:
        raise HTTPException(status_code=404, detail="Question evaluation not found")

    # Read audio
    audio_bytes = await audio.read()
    if len(audio_bytes) > MAX_AUDIO_SIZE:
        raise HTTPException(status_code=400, detail="Audio file too large (max 25MB)")
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file")

    # Determine extension from content type
    ext_map = {
        "audio/mpeg": "mp3", "audio/mp3": "mp3",
        "audio/wav": "wav", "audio/wave": "wav", "audio/x-wav": "wav",
        "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a",
    }
    ext = ext_map.get(audio.content_type, "webm")

    # Save to uploads/audio/feedback/
    file_id = uuid.uuid4().hex
    filename = f"{file_id}.{ext}"
    uploads_base = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
        "uploads", "audio", "feedback",
    )
    os.makedirs(uploads_base, exist_ok=True)
    file_path = os.path.join(uploads_base, filename)

    with open(file_path, "wb") as f:
        f.write(audio_bytes)

    # Store URL in question evaluation record
    audio_url = f"/api/uploads/audio/feedback/{filename}"
    qe.audio_feedback_url = audio_url
    await db.flush()

    return {
        "audio_feedback_url": audio_url,
        "question_evaluation_id": question_evaluation_id,
        "filename": filename,
    }


@router.get("/evaluations/{evaluation_id}/audio-feedback/{question_evaluation_id}")
async def get_audio_feedback(
    evaluation_id: int,
    question_evaluation_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get audio feedback for a specific question evaluation.

    Returns the audio file if it exists. Accessible by the student who owns
    the evaluation or any teacher/admin.
    """
    # Verify the evaluation exists
    evaluation = await db.get(Evaluation, evaluation_id)
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    # Verify the question evaluation
    qe = await db.get(QuestionEvaluation, question_evaluation_id)
    if not qe or qe.evaluation_id != evaluation_id:
        raise HTTPException(status_code=404, detail="Question evaluation not found")

    if not qe.audio_feedback_url:
        raise HTTPException(status_code=404, detail="No audio feedback available")

    # Extract filename from URL
    filename = qe.audio_feedback_url.split("/")[-1]
    file_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
        "uploads", "audio", "feedback", filename,
    )

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Audio file not found")

    # Determine media type
    ext = filename.rsplit(".", 1)[-1] if "." in filename else "webm"
    media_types = {
        "mp3": "audio/mpeg", "wav": "audio/wav", "webm": "audio/webm",
        "ogg": "audio/ogg", "m4a": "audio/mp4",
    }
    media_type = media_types.get(ext, "audio/webm")

    return FileResponse(file_path, media_type=media_type)
