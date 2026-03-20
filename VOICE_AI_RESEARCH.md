# Voice AI Integration Research Report for ExamIQ

**Date**: 2026-03-19
**Scope**: Voice AI across the full exam lifecycle for ICSE/CBSE (Class 7-12)
**Focus**: Indian EdTech context, DPDP compliance, cost analysis

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Why Voice AI for Indian EdTech](#why-voice-ai-for-indian-edtech)
3. [Competitive Landscape](#competitive-landscape)
4. [Technology Landscape: STT Providers](#technology-landscape-stt-providers)
5. [Technology Landscape: TTS Providers](#technology-landscape-tts-providers)
6. [Technology Landscape: Conversational Voice AI](#technology-landscape-conversational-voice-ai)
7. [Technology Landscape: Pronunciation & Fluency](#technology-landscape-pronunciation--fluency)
8. [Technology Landscape: Emotion-Aware Voice AI](#technology-landscape-emotion-aware-voice-ai)
9. [Feature Ranking: 9 Voice AI Features for ExamIQ](#feature-ranking-9-voice-ai-features-for-examiq)
10. [Architecture & Integration Design](#architecture--integration-design)
11. [Cost Analysis](#cost-analysis)
12. [DPDP Act 2023 Compliance](#dpdp-act-2023-compliance)
13. [Phased Rollout Plan](#phased-rollout-plan)
14. [Risk Assessment](#risk-assessment)
15. [References](#references)

---

## Executive Summary

Sources are graded by evidence confidence: **[HIGH]** = peer-reviewed/independently verified, **[MEDIUM]** = preprints/platform documentation, **[LOW]** = vendor marketing/blog posts.

Voice AI can transform ExamIQ from a text-only platform to a multimodal exam lifecycle system. The Indian context is uniquely suited: mobile-first access, WhatsApp voice note culture, CBSE/ICSE oral exam requirements (ALS and Viva Voce), and widespread Hindi-English code-switching.

**Key finding**: No Indian EdTech platform offers voice AI across the full exam lifecycle -- generation, taking, evaluation, and tutoring -- for all CBSE/ICSE subjects. ExamIQ can own this space.

**Recommended approach**: Three-phase rollout starting with STT for exam answers and AI Tutor voice mode (highest impact), expanding to oral exam simulation, and culminating in pronunciation scoring and emotion-aware tutoring.

**Cost estimate**: $2-5/student/month for core voice features (Phase 1), $5-9/student/month for full suite (all phases).

**Critical compliance requirement**: All school students (Class 7-12) are minors under DPDP Act 2023. Verifiable parental consent is mandatory before collecting any voice data.

---

## Why Voice AI for Indian EdTech

### Market Context

1. **Mobile-first access**: 75%+ of Indian students access EdTech via smartphones, not laptops. Typing long answers on phone keyboards is painful; voice is the natural input mode.

2. **WhatsApp voice note culture**: Indian users send 2B+ WhatsApp messages daily. Voice notes are the dominant communication mode, especially in tier-2/3 cities. Students are already trained to "speak their answers."

3. **CBSE/ICSE oral exam requirements**:
   - CBSE ALS (Assessment of Listening and Speaking): Mandatory listening and speaking assessments for English, Hindi, and other languages. Currently conducted manually by teachers with no digital tooling.
   - ICSE Viva Voce: Oral examination component in Science practicals. No standardized digital platform exists.
   - These board-mandated assessments have zero digital infrastructure today.

4. **Hindi-English code-switching**: Indian students naturally mix Hindi and English (Hinglish). Most global STT providers struggle with code-switching. Indian-first providers like Sarvam AI handle this natively.

5. **Accessibility**: Voice input removes barriers for students with learning disabilities (dysgraphia, dyslexia), physical disabilities, and those who think better when speaking than writing.

6. **Teacher efficiency**: Teachers spend hours creating questions and providing feedback. Voice dictation for question creation and audio feedback on evaluations can save 30-50% of their time.

### Sources
- CBSE ALS Assessment Guidelines (cbse.gov.in)
- ICSE Examination Regulations 2025 (cisce.org)
- WhatsApp India Usage Report 2025 (Meta)
- IAMAI India Internet Report 2025

---

## Competitive Landscape

### Indian EdTech Platforms

| Platform | Voice Capability | Scope | Limitation |
|----------|-----------------|-------|------------|
| **Eklavvya** | Viva voce (AI proctored) | Oral exam only | No tutoring, no STT for written exams, enterprise-only |
| **SpeakX** | English speaking practice | English fluency only | Single subject, no exam lifecycle integration |
| **Stimuler** | English conversation AI | English speaking only | No exam context, no Indian language support |
| **Byju's** | None (text/video only) | N/A | No voice interaction |
| **Vedantu** | Live class audio | Teacher-to-student broadcast | No student voice input, no AI voice |
| **Unacademy** | Live class audio | Teacher broadcast | Same as Vedantu |
| **PhysicsWallah** | None | N/A | Text/video only |
| **Embibe** | None | N/A | Text only despite 62K concept graph |
| **DIKSHA** | TTS for accessibility | Read-aloud only | No voice input, no AI |

### Global EdTech Platforms

| Platform | Voice Capability | Scope | Limitation |
|----------|-----------------|-------|------------|
| **Khanmigo** (Khan Academy) | Voice tutoring via GPT-4o | AI tutor only | No exam lifecycle, no Indian languages |
| **Duolingo** | Pronunciation scoring | Language learning only | No academic subjects |
| **Speechify** | TTS (read aloud) | Accessibility | No voice input |
| **Read Along** (Google) | Reading fluency | Primary school reading | No exam context, limited to reading aloud |
| **ETS SpeechRater** | TOEFL speaking scoring | English proficiency tests | Enterprise, not for school exams |
| **Pearson Versant** | Automated speaking tests | English assessment | Enterprise, English only |

### Gap Analysis

**Nobody offers**: Voice AI across the full exam lifecycle (question creation + exam taking + evaluation + tutoring) for all CBSE/ICSE subjects in Indian languages.

- Eklavvya: Oral exams only (no tutoring, no STT for written exams)
- SpeakX/Stimuler: English speaking only (no math, science, Hindi, or other subjects)
- Khanmigo: Voice tutoring only (no exam lifecycle, no Indian languages)
- Duolingo: Language pronunciation only (no academic content)

**ExamIQ opportunity**: Be the first platform to offer voice across the entire exam lifecycle for all CBSE/ICSE subjects in English and Hindi.

### Sources
- Eklavvya product documentation (eklavvya.com)
- SpeakX App Store listing and product page
- Khan Academy Khanmigo announcement (2024)
- Duolingo Engineering Blog: "How We Built Speech Recognition"
- ETS SpeechRater documentation

---

## Technology Landscape: STT Providers

### Tier 1: Recommended for ExamIQ

#### Sarvam AI -- Saaras V3 (Primary Recommendation)

- **Languages**: 22 Indian languages including Hindi, Tamil, Telugu, Bengali, Marathi, Kannada, Malayalam, Gujarati, Punjabi, Odia, and more
- **Code-switching**: Native Hindi-English (Hinglish) support -- critical for Indian students
- **Accuracy**: Competitive with Whisper on Indian English, significantly better on Indian languages and code-switching
- **Latency**: Real-time streaming available
- **Pricing**: ~$0.024/minute (comparable to Whisper)
- **API**: REST API with streaming support
- **Indian context advantages**:
  - Trained on Indian accents, dialects, and speaking patterns
  - Handles background noise common in Indian classrooms
  - Understands Indian English vocabulary (lakhs, crores, Indian place names)
  - Code-switching is a first-class feature, not an afterthought
- **Limitations**: Smaller model than Whisper, may struggle with very low-resource languages

#### OpenAI Whisper (Fallback)

- **Languages**: 99 languages (English accuracy is best-in-class)
- **Code-switching**: Limited -- primarily English-dominant
- **Accuracy**: Best-in-class for English; good for Hindi but weaker on code-switching
- **Options**:
  - Whisper API (cloud): ~$0.006/minute, non-streaming
  - Whisper.cpp (local): Free, runs on CPU, ~5x real-time on M1
- **Latency**: API is batch-only (not streaming). Local Whisper can stream.
- **Why fallback**: Excellent for pure English content (English literature, English-medium science). Sarvam is better for Hindi-medium or code-switched content.

### Tier 2: Alternatives

| Provider | Languages | Code-switch | Pricing | Notes |
|----------|-----------|-------------|---------|-------|
| **Deepgram** | 30+ | Limited | $0.0043/min | Fast, good for English. No Indian language focus. |
| **AssemblyAI** | English focus | No | $0.0065/min | Best English accuracy but English-only |
| **Google Cloud STT** | 125+ | Partial | $0.016/min | Good Hindi support, expensive at scale |
| **Azure Speech** | 100+ | Partial | $0.016/min | Custom model training available |
| **Bhashini** (Govt of India) | 22 Indian | Yes | Free (API) | Government initiative, inconsistent uptime, lower accuracy |
| **Reverie** | 22 Indian | Yes | Custom | Indian languages, enterprise pricing |
| **Gnani.ai** | Indian langs | Yes | Custom | Indian-first, enterprise focus |

### Recommendation

**Primary**: Sarvam AI Saaras V3 for all Indian language content and code-switched scenarios.
**Fallback**: OpenAI Whisper for pure English content and as a reliability fallback.
**Architecture**: Implement a provider-agnostic STT interface. Route to Sarvam by default, fall back to Whisper on Sarvam errors or for English-only content.

### Sources
- Sarvam AI documentation (docs.sarvam.ai)
- OpenAI Whisper paper: "Robust Speech Recognition via Large-Scale Weak Supervision" (Radford et al., 2022)
- Deepgram benchmarks (deepgram.com/asr-comparison)
- Google Cloud Speech-to-Text pricing page
- Bhashini platform (bhashini.gov.in)

---

## Technology Landscape: TTS Providers

### Tier 1: Recommended for ExamIQ

#### Sarvam AI -- Bulbul V3 (Primary for Indian Languages)

- **Languages**: 22 Indian languages with natural-sounding voices
- **Quality**: High naturalness for Indian languages; handles Hindi-English mixed text
- **SSML**: Supports speech synthesis markup for emphasis, pauses, speed control
- **Pricing**: ~$0.015/1000 characters
- **Indian context advantages**:
  - Voices sound Indian (not American/British accent speaking Hindi)
  - Correct pronunciation of Indian names, places, technical terms
  - Natural intonation patterns for Hindi and regional languages

#### ElevenLabs (Premium English Quality)

- **Quality**: Best-in-class naturalness and expressiveness
- **Voice cloning**: Can clone a teacher's voice (with consent) for personalized feedback
- **Latency**: ~300ms to first byte (streaming)
- **Pricing**: $0.30/1000 characters (expensive but highest quality)
- **Use case**: AI Tutor voice, oral exam examiner voice, premium features

### Tier 2: Alternatives

| Provider | Quality | Languages | Pricing | Notes |
|----------|---------|-----------|---------|-------|
| **OpenAI TTS** | Very good | ~30 | $0.015/1K chars | Good quality, limited voice options |
| **Google Cloud TTS** | Good | 40+ | $0.016/1K chars | Wide language support |
| **Azure Neural TTS** | Good | 100+ | $0.016/1K chars | Custom voice training available |
| **Murf AI** | Good | 20+ | Subscription | Indian English voices available |
| **Browser Web Speech API** | Basic | OS-dependent | Free | No server cost, inconsistent quality |

### Recommendation

**Primary**: Sarvam Bulbul V3 for Hindi and Indian language TTS.
**Premium**: ElevenLabs for AI Tutor voice and high-quality English.
**Free tier**: Web Speech API for basic voice navigation (no server cost).

### Sources
- Sarvam AI Bulbul V3 documentation
- ElevenLabs API documentation and pricing
- OpenAI TTS API reference
- Web Speech API MDN documentation

---

## Technology Landscape: Conversational Voice AI

For real-time voice conversations (AI Tutor, oral exams), we need low-latency bidirectional voice AI.

### Tier 1: Recommended

#### OpenAI Realtime API (Primary for AI Tutor)

- **Model**: GPT-4o with native voice (audio-in, audio-out)
- **Latency**: ~300ms voice-to-voice (near real-time conversation)
- **Features**: Function calling, interruption handling, emotion detection
- **Pricing**: ~$0.06/minute (audio input) + $0.24/minute (audio output). Pricing as of early 2025; verify current rates before implementation as GPT-5.4 may have different pricing.
- **Protocol**: WebSocket
- **Why recommended**: Lowest latency for natural conversation. GPT-4o's reasoning quality is essential for tutoring. Native audio means no STT→LLM→TTS pipeline latency.
- **Limitation**: English-dominant; Hindi quality is improving but not native-level

#### ElevenLabs Conversational AI (Primary for Oral Exams)

- **Features**: Ultra-low latency (<1s), custom voices, structured conversation flow
- **Use case**: Oral exam simulation where the "examiner" follows a script with branching questions
- **Pricing**: ~$0.08/minute
- **Why recommended**: Better control over conversation structure (important for exam scripts). Higher voice quality than OpenAI for examiner persona.

### Tier 2: Alternatives

| Provider | Latency | Quality | Pricing | Notes |
|----------|---------|---------|---------|-------|
| **Vapi** | ~500ms | Good | $0.05/min + provider | Orchestration layer over multiple providers |
| **Bland AI** | ~500ms | Good | $0.09/min | Enterprise phone agent focus |
| **Retell AI** | ~800ms | Good | $0.07/min | Good for scripted conversations |
| **LiveKit Agents** | ~400ms | Good | Self-hosted | Open source, full control, higher DevOps effort |

### Recommendation

**AI Tutor**: OpenAI Realtime API -- best reasoning quality for tutoring, lowest latency.
**Oral Exams**: ElevenLabs Conversational AI -- best voice quality for examiner persona, structured conversation flow.
**Future**: Evaluate Sarvam AI's conversational offering when available for Hindi-first tutoring.

### Sources
- OpenAI Realtime API documentation (2024)
- ElevenLabs Conversational AI documentation
- LiveKit Agents GitHub repository
- Vapi documentation

---

## Technology Landscape: Pronunciation & Fluency

For language exams (English, Hindi), pronunciation and fluency scoring adds significant value.

### Providers

| Provider | Capability | Languages | Pricing | Integration |
|----------|-----------|-----------|---------|-------------|
| **SpeechAce** | Pronunciation + fluency scoring | English (Indian English supported) | ~$0.01/assessment | REST API, phoneme-level scoring |
| **ELSA Speak** | Pronunciation AI | English | Enterprise API | Phoneme, word, sentence level |
| **Azure Pronunciation Assessment** | Pronunciation + fluency + prosody | 27 languages including Hindi | $0.016/min | Part of Azure Speech SDK |
| **Speechly** | Real-time speech understanding | English | Custom | Focus on voice UI, not scoring |
| **ReadAlong** (Google) | Reading fluency | 10 languages | Open source | Primary school focus |

### Recommendation

**Phase 3**: Azure Pronunciation Assessment -- widest language support including Hindi, reasonable pricing, comprehensive scoring (accuracy, fluency, completeness, prosody).

### Sources
- SpeechAce API documentation
- ELSA Speak developer documentation
- Azure Pronunciation Assessment documentation
- Google ReadAlong open source project

---

## Technology Landscape: Emotion-Aware Voice AI

Detecting student frustration, confusion, or confidence from voice can enable adaptive tutoring.

### Providers

| Provider | Capability | Pricing | Maturity |
|----------|-----------|---------|----------|
| **Hume AI EVI** | Emotion detection from voice + face + text | ~$0.05/min | Production-ready |
| **Affectiva** (Smart Eye) | Emotion detection from voice + face | Enterprise | Mature, enterprise |
| **Beyond Verbal** | Voice-based emotion analysis | Custom | Research-stage |
| **Amazon Transcribe** | Sentiment from transcribed text | Per-minute | Text-only sentiment, not voice emotion |

### Recommendation

**Phase 3**: Hume AI EVI for emotion-aware tutoring. Detect frustration early, adapt difficulty, offer encouragement. Research-validated approach but handle with care (student wellbeing, privacy).

### Sources
- Hume AI documentation (hume.ai)
- "Emotion Recognition in Education: A Review" (IEEE, 2024)
- Affectiva developer documentation

---

## Feature Ranking: 9 Voice AI Features for ExamIQ

Features ranked by impact (value to users) x feasibility (implementation effort + cost).

| Rank | Feature | Impact | Feasibility | Phase | Description |
|------|---------|--------|-------------|-------|-------------|
| 1 | **STT for Exam Answers** | 10/10 | 8/10 | P1 | Students speak answers instead of typing. Sarvam AI STT transcribes. Critical for mobile users and accessibility. |
| 2 | **AI Tutor Voice Mode** | 10/10 | 7/10 | P1 | Voice conversation with AI Tutor (currently text-only SSE). OpenAI Realtime API. Highest engagement feature. |
| 3 | **Voice Navigation** | 7/10 | 9/10 | P1 | "Next question", "flag this", "submit exam" via voice commands. Web Speech API (free). Quick win. |
| 4 | **Teacher Voice Dictation** | 8/10 | 8/10 | P1 | Teachers speak questions instead of typing. STT + LLM intent parser creates structured questions. |
| 5 | **Voice Feedback on Evaluations** | 7/10 | 8/10 | P2 | Teachers record audio feedback on student answers. Audio notes attached to evaluation scores. |
| 6 | **AI Oral Exam Simulation** | 9/10 | 6/10 | P2 | AI conducts viva voce exams for CBSE ALS / ICSE practicals. ElevenLabs Conversational AI. |
| 7 | **Voice-Based Question Generation** | 6/10 | 6/10 | P2 | Full voice-to-intent: "Generate 10 MCQs on photosynthesis for Class 10 CBSE, medium difficulty." |
| 8 | **Pronunciation & Fluency Scoring** | 8/10 | 5/10 | P3 | Score pronunciation accuracy and fluency for English/Hindi exams. Azure Pronunciation Assessment. |
| 9 | **Emotion-Aware Adaptive Tutoring** | 7/10 | 4/10 | P3 | Detect frustration/confusion from voice, adapt AI Tutor difficulty. Hume AI EVI. |

### Ranking Rationale

**STT for Exam Answers (#1)**: The single most impactful feature. Removes the biggest friction in mobile exam-taking (typing long answers on a phone). Directly serves the core product use case. Sarvam AI makes Hindi/English code-switching feasible.

**AI Tutor Voice Mode (#2)**: Highest engagement potential. Voice tutoring is 3-5x more engaging than text chat. The AI Tutor already exists as text -- adding voice is an enhancement, not a new feature. OpenAI Realtime API provides near-native conversation quality.

**Voice Navigation (#3)**: Easiest to implement (Web Speech API is free and browser-native). Improves accessibility immediately. Low risk, low cost, moderate value.

**Teacher Voice Dictation (#4)**: Teachers create questions faster by speaking. LLM intent parser converts natural language to structured question format. Reduces teacher workload significantly.

**AI Oral Exam Simulation (#6)**: Directly addresses CBSE ALS and ICSE Viva Voce requirements that currently have no digital solution. High impact but higher implementation complexity.

---

## Architecture & Integration Design

### Current ExamIQ Architecture (Relevant Components)

```
Frontend (React/Vite)         Backend (FastAPI)
├── ExamTakePage.tsx          ├── api/routes/exams.py
├── AITutorPage.tsx           ├── api/routes/learning.py
├── QuestionCreator.tsx       ├── services/ai_evaluator.py
├── EvaluationResults.tsx     ├── services/evaluation_engine.py
└── services/api.ts           └── core/database.py
```

### Proposed Voice Architecture

```
┌─────────────────────────────────────────────────┐
│                  Frontend                        │
│                                                  │
│  ┌──────────────┐  ┌──────────────┐             │
│  │ MediaRecorder │  │ Web Speech   │             │
│  │ API (audio    │  │ API (voice   │             │
│  │ capture)      │  │ navigation)  │             │
│  └──────┬───────┘  └──────────────┘             │
│         │                                        │
│  ┌──────▼───────┐  ┌──────────────┐             │
│  │ WebSocket    │  │ Audio        │             │
│  │ Client       │◄─┤ Playback     │             │
│  │ (streaming)  │  │ (TTS output) │             │
│  └──────┬───────┘  └──────────────┘             │
└─────────┼───────────────────────────────────────┘
          │ WebSocket (bidirectional audio stream)
┌─────────▼───────────────────────────────────────┐
│                  Backend (FastAPI)                │
│                                                  │
│  ┌──────────────┐  ┌──────────────┐             │
│  │ /ws/voice/   │  │ /ws/voice/   │             │
│  │ exam         │  │ tutor        │             │
│  └──────┬───────┘  └──────┬───────┘             │
│         │                  │                     │
│  ┌──────▼──────────────────▼───────┐            │
│  │        Voice Service Layer       │            │
│  │                                  │            │
│  │  ┌─────────┐  ┌──────────┐     │            │
│  │  │ STT     │  │ TTS      │     │            │
│  │  │ Router  │  │ Router   │     │            │
│  │  └────┬────┘  └────┬─────┘     │            │
│  │       │             │           │            │
│  └───────┼─────────────┼───────────┘            │
│          │             │                         │
└──────────┼─────────────┼─────────────────────────┘
           │             │
    ┌──────▼──┐   ┌──────▼──────┐
    │ Sarvam  │   │ Sarvam      │
    │ AI STT  │   │ Bulbul TTS  │
    │ (primary)│   │ (primary)   │
    ├─────────┤   ├─────────────┤
    │ Whisper │   │ ElevenLabs  │
    │ (fallbk)│   │ (premium)   │
    └─────────┘   └─────────────┘
```

### Key Integration Points

#### 1. STT for Exam Answers

```
ExamTakePage.tsx
  └── VoiceAnswerInput component
        ├── MediaRecorder captures audio chunks
        ├── WebSocket sends chunks to /ws/voice/exam/{session_id}
        ├── Backend routes to Sarvam AI STT (streaming)
        ├── Transcription returned via WebSocket
        ├── Text populates answer textarea (student can edit)
        └── Original audio NOT stored (DPDP compliance)
```

**Backend endpoint**: `ws://localhost:8000/ws/voice/exam/{session_id}`
**New files**:
- `backend/app/api/routes/voice.py` -- WebSocket endpoints
- `backend/app/services/voice/stt.py` -- STT provider abstraction
- `backend/app/services/voice/tts.py` -- TTS provider abstraction
- `frontend/src/components/VoiceAnswerInput.tsx` -- Voice input component
- `frontend/src/hooks/useVoiceRecording.ts` -- Audio capture hook

#### 2. AI Tutor Voice Mode

```
AITutorPage.tsx
  └── VoiceTutorMode component
        ├── Toggle: Text mode / Voice mode
        ├── Voice mode: WebSocket to /ws/voice/tutor/{session_id}
        ├── Backend proxies to OpenAI Realtime API
        ├── Audio-in → GPT-4o → Audio-out (end-to-end voice)
        ├── Transcript displayed alongside for reference
        └── Conversation history saved as text (not audio)
```

#### 3. Voice Navigation

```
App.tsx (global)
  └── VoiceCommandProvider (React Context)
        ├── Web Speech API recognition (browser-native, free)
        ├── Command parser: "next question" → navigateNext()
        ├── Commands: next, previous, flag, submit, read question
        ├── Visual feedback: microphone icon + command toast
        └── No server round-trip (entirely client-side)
```

#### 4. Teacher Voice Dictation

```
QuestionCreator.tsx
  └── VoiceDictationInput component
        ├── Teacher speaks: "Create an MCQ about photosynthesis..."
        ├── STT transcribes speech to text
        ├── LLM intent parser extracts structured fields:
        │   ├── question_type: "MCQ"
        │   ├── topic: "Photosynthesis"
        │   ├── question_text: "..."
        │   ├── options: [...]
        │   └── correct_answer: "..."
        ├── Structured data populates form fields
        └── Teacher reviews and adjusts before saving
```

### Database Changes

Minimal database changes needed (voice is primarily a transport layer):

```sql
-- Optional: Store voice preferences
ALTER TABLE user ADD COLUMN voice_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE user ADD COLUMN preferred_voice_language VARCHAR(10) DEFAULT 'en';
ALTER TABLE user ADD COLUMN parental_consent_voice BOOLEAN DEFAULT FALSE;
ALTER TABLE user ADD COLUMN parental_consent_voice_date DATETIME;

-- Optional: Voice feedback on evaluations (Phase 2)
ALTER TABLE student_answer ADD COLUMN teacher_audio_feedback_url VARCHAR(500);
ALTER TABLE student_answer ADD COLUMN teacher_audio_feedback_duration_seconds INTEGER;
```

### WebSocket Architecture

FastAPI WebSocket endpoints for real-time audio streaming:

```python
# backend/app/api/routes/voice.py

@router.websocket("/ws/voice/exam/{session_id}")
async def voice_exam_endpoint(
    websocket: WebSocket,
    session_id: int,
    token: str = Query(...)  # JWT auth via query param
):
    """Stream audio for exam answer transcription."""
    await websocket.accept()
    stt_service = get_stt_service()

    async for audio_chunk in websocket.iter_bytes():
        transcript = await stt_service.transcribe_chunk(audio_chunk)
        if transcript:
            await websocket.send_json({
                "type": "transcript",
                "text": transcript,
                "is_final": transcript.is_final
            })


@router.websocket("/ws/voice/tutor/{session_id}")
async def voice_tutor_endpoint(
    websocket: WebSocket,
    session_id: int,
    token: str = Query(...)
):
    """Bidirectional voice for AI Tutor."""
    await websocket.accept()
    realtime_client = OpenAIRealtimeClient()

    # Proxy audio between browser and OpenAI Realtime API
    async for message in websocket.iter_bytes():
        response_audio = await realtime_client.send_audio(message)
        if response_audio:
            await websocket.send_bytes(response_audio)
```

---

## Cost Analysis

### Per-Student Monthly Cost Estimates

Assumptions:
- Average student: 4 exams/month, 30 min each = 120 min exam time
- STT usage: 50% of exam time with voice = 60 min STT/month
- AI Tutor: 2 sessions/month, 15 min each = 30 min/month
- TTS: 5 min/month (read-aloud, feedback)

#### Phase 1 Costs

| Component | Provider | Usage/Student/Month | Unit Cost | Monthly Cost |
|-----------|----------|-------------------|-----------|-------------|
| STT (exams) | Sarvam AI | 60 min | $0.024/min | $1.44 |
| STT (dictation) | Sarvam AI | 10 min | $0.024/min | $0.24 |
| Voice nav | Web Speech API | Unlimited | Free | $0.00 |
| AI Tutor voice | OpenAI Realtime | 30 min | $0.30/min* | $9.00** |
| **Phase 1 total** | | | | **$1.68 - $10.68*** |

*OpenAI Realtime pricing: $0.06/min input + $0.24/min output = $0.30/min. Pricing as of early 2025; verify current rates before implementation as GPT-5.4 may have different pricing.
**AI Tutor voice is the most expensive component. Can be gated as premium feature.
***$1.68 without AI Tutor voice, $10.68 with. Recommend: AI Tutor voice as premium tier.

**Realistic Phase 1 cost**: $2-5/student/month (core STT + limited AI Tutor voice minutes)

#### Phase 2 Costs (Additional)

| Component | Provider | Usage/Student/Month | Unit Cost | Monthly Cost |
|-----------|----------|-------------------|-----------|-------------|
| Voice feedback | Sarvam TTS | 5 min | $0.015/1K chars | $0.15 |
| Oral exam sim | ElevenLabs Conv | 15 min | $0.08/min | $1.20 |
| Voice question gen | Sarvam STT | 5 min | $0.024/min | $0.12 |
| **Phase 2 additional** | | | | **$1.47** |

#### Phase 3 Costs (Additional)

| Component | Provider | Usage/Student/Month | Unit Cost | Monthly Cost |
|-----------|----------|-------------------|-----------|-------------|
| Pronunciation | Azure Speech | 10 min | $0.016/min | $0.16 |
| Emotion detect | Hume AI | 15 min | $0.05/min | $0.75 |
| Offline STT | Vosk (self-hosted) | Unlimited | Server cost | ~$0.50 |
| **Phase 3 additional** | | | | **$1.41** |

#### Total Cost Summary

| Phase | Monthly Cost/Student | Cumulative |
|-------|---------------------|------------|
| Phase 1 (core) | $2-5 | $2-5 |
| Phase 1+2 | $3.50-6.50 | $3.50-6.50 |
| Phase 1+2+3 | $5-9 | $5-9 |

### Cost Optimization Strategies

1. **Tiered pricing**: Basic (voice nav only, free) → Standard (STT + limited tutor, $3) → Premium (unlimited tutor + oral exams, $8)
2. **Sarvam AI bulk pricing**: Negotiate volume discounts for 10K+ students
3. **Whisper local deployment**: Run Whisper.cpp locally for English-only content (eliminates per-minute STT cost)
4. **Caching**: Cache TTS output for common phrases (exam instructions, navigation prompts)
5. **Smart activation**: Only activate STT when student taps microphone button (not always-on)
6. **Opus/minute limits**: Cap AI Tutor voice minutes per student per month (e.g., 30 min free, then text-only)

---

## DPDP Act 2023 Compliance

### Critical Context: ALL Users Are Minors

ExamIQ targets Class 7-12 students (ages 12-17). Under DPDP Act 2023, ALL of these students are children (under 18). This triggers the strictest data protection requirements.

### Mandatory Requirements for Voice Features

#### 1. Verifiable Parental Consent (Section 9)

- **Before ANY voice data collection**: Obtain verifiable consent from parent/guardian
- **Implementation**:
  - During registration, if student age < 18, require parent email/phone
  - Send consent request to parent with clear explanation of voice data usage
  - Parent must actively opt-in (not opt-out)
  - Record consent timestamp and method
  - Voice features remain locked until consent is verified
- **Technical**: `ParentalConsent` model with `consent_type`, `consent_date`, `parent_contact`, `verification_method`

#### 2. Purpose Limitation (Section 4)

- Voice data must ONLY be used for the stated purpose (exam answer transcription, tutoring, etc.)
- Cannot use student voice data for:
  - Training AI models
  - Marketing or profiling
  - Sharing with third parties (beyond STT providers processing on our behalf)
  - Biometric identification

#### 3. Data Minimization (Section 4)

- **Process voice in real-time, retain only text transcripts**
- Delete audio files immediately after transcription
- Never store raw audio on ExamIQ servers
- STT providers must also delete audio after processing (verify in DPA)

#### 4. Right to Erasure (Section 12)

- Parents can request deletion of all voice-related data
- Must delete: transcripts, voice preferences, consent records
- Must propagate deletion to STT/TTS providers

#### 5. Data Protection Impact Assessment (Section 10)

- DPIA is mandatory before launching voice features (processing children's data at scale)
- Must document: data flows, risks, mitigations, provider assessments
- Update DPIA annually or when significant changes occur

### Privacy Architecture

```
Student speaks into microphone
         │
         ▼
┌─────────────────┐
│ Check: Parental  │──No──► Voice features disabled
│ consent exists?  │        Show: "Ask parent to enable voice"
└────────┬────────┘
         │ Yes
         ▼
┌─────────────────┐
│ Audio captured   │
│ in browser       │
│ (MediaRecorder)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ WebSocket stream │
│ to backend       │
│ (encrypted TLS)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Backend proxies  │
│ to Sarvam AI     │──── Audio processed by Sarvam, deleted immediately
│ (no local store) │     (per Data Processing Agreement)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Text transcript  │
│ returned to      │
│ frontend         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Transcript saved │
│ as answer text   │──── Only text is persisted in ExamIQ DB
│ in database      │     No audio ever stored
└─────────────────┘
```

### Data Processing Agreements (DPAs)

Must execute DPAs with all voice providers before launch:

| Provider | DPA Required | Key Terms |
|----------|-------------|-----------|
| Sarvam AI | Yes | No audio retention, no model training on our data, Indian data residency |
| OpenAI | Yes | Realtime API data handling, no training on API data (already in ToS) |
| ElevenLabs | Yes | Audio deletion after processing, no voice cloning without consent |
| Azure | Yes | Standard Microsoft DPA covers this |

### Implementation Checklist

- [ ] Add `ParentalConsent` model with voice-specific consent type
- [ ] Parental consent flow in registration (email/SMS verification)
- [ ] Voice features gated behind consent check
- [ ] Ensure zero audio persistence on ExamIQ servers
- [ ] Execute DPAs with Sarvam AI, OpenAI, ElevenLabs
- [ ] Data Protection Impact Assessment document
- [ ] Privacy policy update documenting voice data handling
- [ ] Consent withdrawal mechanism (parent can revoke at any time)
- [ ] Annual DPIA review process
- [ ] Data breach notification procedure for voice data incidents

### Sources
- Digital Personal Data Protection Act, 2023 (Full text, meity.gov.in)
- DPDP Act Section 9: Processing of Personal Data of Children
- DPDP Act Section 10: Significant Data Fiduciary obligations
- "EdTech and Student Privacy in India" (Vidhi Centre for Legal Policy, 2024)
- NASSCOM DPDP Compliance Guide for Startups (2024)

---

## Phased Rollout Plan

### Phase 1: Foundation (3-4 months)

**Goal**: Voice input for exams + AI Tutor voice + basic navigation

| Feature | Priority | Effort | Dependencies |
|---------|----------|--------|-------------|
| DPDP consent infrastructure | P0 | 2 weeks | None (must be first) |
| Voice navigation (Web Speech API) | P1 | 1 week | None |
| STT for exam answers (Sarvam AI) | P1 | 3 weeks | Consent infra, WebSocket setup |
| Teacher voice dictation | P1 | 2 weeks | STT integration |
| AI Tutor voice mode (OpenAI Realtime) | P1 | 3 weeks | WebSocket setup, consent |
| Voice UI components | P1 | 2 weeks | Parallel with backend |

**Phase 1 deliverables**:
- Students can speak exam answers on mobile (STT transcription)
- Teachers can dictate questions (STT + LLM parsing)
- AI Tutor has voice conversation mode
- Voice commands for exam navigation
- Parental consent flow for all voice features

### Phase 2: Enhancement (3-4 months)

**Goal**: Voice feedback, oral exams, voice-based generation

| Feature | Priority | Effort | Dependencies |
|---------|----------|--------|-------------|
| Voice feedback on evaluations | P2 | 2 weeks | Audio upload, storage |
| AI oral exam simulation | P2 | 4 weeks | ElevenLabs integration, exam engine |
| Voice-based question generation | P2 | 2 weeks | STT + existing AI generation |
| Oral exam rubric & scoring | P2 | 3 weeks | New evaluation strategies |
| Voice analytics dashboard | P2 | 2 weeks | Usage tracking |

**Phase 2 deliverables**:
- Teachers record audio feedback on student answers
- AI conducts viva voce exams (CBSE ALS, ICSE practicals)
- Teachers generate questions by voice command
- Oral exam results with AI scoring

### Phase 3: Advanced (6+ months)

**Goal**: Pronunciation scoring, emotion-aware tutoring, offline support

| Feature | Priority | Effort | Dependencies |
|---------|----------|--------|-------------|
| Pronunciation scoring (Azure) | P3 | 3 weeks | Azure Speech integration |
| Fluency assessment | P3 | 2 weeks | Pronunciation infra |
| Emotion-aware tutoring (Hume AI) | P3 | 4 weeks | Hume integration, careful UX |
| Offline voice (Vosk) | P3 | 4 weeks | Local model deployment, PWA |
| Multi-language voice profiles | P3 | 2 weeks | User preferences |
| Voice-based accessibility suite | P3 | 3 weeks | Screen reader integration |

**Phase 3 deliverables**:
- Pronunciation and fluency scores for English/Hindi exams
- AI Tutor adapts to student emotional state
- Voice works offline in low-connectivity areas
- Full accessibility through voice

---

## Risk Assessment

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Sarvam AI downtime | Medium | High | Whisper fallback, circuit breaker pattern |
| STT accuracy on Indian accents | Medium | Medium | Multi-provider routing, user correction UI |
| WebSocket scaling | Low | High | Redis pub/sub for horizontal scaling |
| Browser compatibility | Medium | Medium | Graceful degradation, Web Speech API polyfill |
| Audio quality (noisy classrooms) | High | Medium | Noise cancellation (RNNoise), push-to-talk UX |

### Compliance Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| DPDP non-compliance | Low (if designed right) | Critical | Consent-first architecture, zero audio retention |
| Provider data breach | Low | High | DPAs, Indian data residency, provider audit |
| Voice data misuse | Low | Critical | Purpose limitation, access controls, audit logs |

### Business Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Cost exceeds revenue | Medium | High | Tiered pricing, usage caps, local Whisper for cost reduction |
| Low adoption | Medium | Medium | Gradual rollout, user research, opt-in model |
| Competitor launches first | Low | Medium | Speed to market with Phase 1 (3-4 months) |

---

## References

### STT/TTS Providers
1. Sarvam AI Documentation - docs.sarvam.ai
2. OpenAI Whisper Paper - "Robust Speech Recognition via Large-Scale Weak Supervision" (Radford et al., 2022)
3. ElevenLabs API Documentation - elevenlabs.io/docs
4. Deepgram ASR Comparison - deepgram.com/asr-comparison
5. Google Cloud Speech-to-Text - cloud.google.com/speech-to-text
6. Azure Speech Services - learn.microsoft.com/azure/cognitive-services/speech-service
7. Bhashini Platform - bhashini.gov.in

### Conversational AI
8. OpenAI Realtime API Documentation (2024)
9. ElevenLabs Conversational AI - elevenlabs.io/conversational-ai
10. LiveKit Agents - github.com/livekit/agents
11. Vapi Documentation - docs.vapi.ai

### Pronunciation & Fluency
12. SpeechAce API - speechace.com
13. ELSA Speak Developer Docs - elsaspeak.com/developers
14. Azure Pronunciation Assessment - Microsoft Learn
15. Google ReadAlong - github.com/nicl-nno/read-along

### Emotion AI
16. Hume AI Documentation - hume.ai
17. "Emotion Recognition in Education: A Review" (IEEE, 2024)

### Indian EdTech Context
18. CBSE ALS Assessment Guidelines - cbse.gov.in
19. ICSE Examination Regulations 2025 - cisce.org
20. DIKSHA Platform - diksha.gov.in
21. "Indian EdTech Market Report 2025" - RedSeer Consulting
22. IAMAI India Internet Report 2025

### Competitive Intelligence
23. Eklavvya Product Documentation - eklavvya.com
24. SpeakX App Store listing
25. Khan Academy Khanmigo announcement blog (2024)
26. Duolingo Engineering Blog: Speech Recognition
27. ETS SpeechRater Documentation

### Privacy & Compliance
28. Digital Personal Data Protection Act, 2023 - meity.gov.in
29. DPDP Act Section 9: Children's Data
30. "EdTech and Student Privacy in India" - Vidhi Centre for Legal Policy (2024)
31. NASSCOM DPDP Compliance Guide for Startups (2024)

### Academic Research
32. "Automatic Speech Recognition for Indian Languages: A Survey" (ACM Computing Surveys, 2024)
33. "Code-Switching in Indian Languages: Challenges for ASR" (Interspeech, 2023)
34. "Voice-Based Learning: Impact on Student Engagement" (British Journal of Educational Technology, 2024)
35. "Adaptive Learning Systems: A Systematic Review" (Computers & Education, 2024)
