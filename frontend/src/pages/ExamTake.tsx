import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { examAPI, paperAPI } from "../services/api";
import type { QuestionPaper, PaperQuestionDetail, StudentAnswer } from "../types";

const ExamTake: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [paper, setPaper] = useState<QuestionPaper | null>(null);
  const [questions, setQuestions] = useState<PaperQuestionDetail[]>([]);
  const [answers, setAnswers] = useState<Record<number, StudentAnswer>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<any>(null);
  const autoSaveRef = useRef<any>(null);

  useEffect(() => {
    if (!sessionId) return;
    examAPI
      .get(Number(sessionId))
      .then(async (res) => {
        const session = res.data;
        const paperRes = await paperAPI.get(session.paper_id);
        setPaper(paperRes.data);
        setQuestions(paperRes.data.questions || []);
        setTimeLeft(paperRes.data.duration_minutes * 60 - session.time_spent_seconds);

        // Load existing answers
        const existing: Record<number, StudentAnswer> = {};
        for (const a of session.answers || []) {
          existing[a.paper_question_id] = a;
        }
        setAnswers(existing);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sessionId]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft <= 0 || !paper) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          handleSubmit();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [paper]);

  // Auto-save every 30 seconds
  const saveAnswers = useCallback(() => {
    if (!sessionId) return;
    const answerList = Object.entries(answers).map(([pqId, ans]) => ({
      paper_question_id: Number(pqId),
      answer_text: ans.answer_text,
      selected_option: ans.selected_option,
    }));
    if (answerList.length === 0) return;
    examAPI
      .save(Number(sessionId), {
        answers: answerList,
        time_spent_seconds: (paper?.duration_minutes || 0) * 60 - timeLeft,
      })
      .catch(() => {});
  }, [answers, sessionId, timeLeft, paper]);

  useEffect(() => {
    autoSaveRef.current = setInterval(saveAnswers, 30000);
    return () => clearInterval(autoSaveRef.current);
  }, [saveAnswers]);

  const updateAnswer = (pqId: number, field: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [pqId]: { ...prev[pqId], paper_question_id: pqId, [field]: value },
    }));
  };

  const handleSubmit = async () => {
    if (!sessionId) return;
    saveAnswers();
    if (!window.confirm("Submit this exam? You cannot change answers after submission.")) {
      return;
    }
    try {
      await examAPI.submit(Number(sessionId));
      navigate(`/results/${sessionId}`);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to submit");
    }
  };

  if (loading) return <p>Loading exam...</p>;
  if (!paper || questions.length === 0) return <p>No questions found.</p>;

  const currentQ = questions[currentIdx];
  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div>
      {/* Header */}
      <div style={headerStyle}>
        <div>
          <strong>{paper.title}</strong>
          <span style={{ marginLeft: 16, color: "#7f8c8d", fontSize: 13 }}>
            {paper.subject} | {paper.total_marks} marks
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              fontSize: 20,
              fontWeight: "bold",
              color: timeLeft < 300 ? "#e74c3c" : "#2c3e50",
            }}
          >
            {formatTime(timeLeft)}
          </div>
          <button onClick={handleSubmit} style={submitBtnStyle}>
            Submit Exam
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 16, marginTop: 16 }}>
        {/* Question area */}
        <div style={questionCardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <span style={{ fontWeight: "bold", fontSize: 14 }}>
              Q{currentIdx + 1} of {questions.length}
            </span>
            <span style={{ fontSize: 13, color: "#7f8c8d" }}>
              {currentQ.marks} marks | {currentQ.difficulty} |{" "}
              {currentQ.topic}
            </span>
          </div>

          <div
            style={{ fontSize: 16, lineHeight: 1.6, marginBottom: 20 }}
          >
            {currentQ.question_text}
          </div>

          {/* Answer input */}
          {currentQ.question_type === "mcq" && currentQ.mcq_options ? (
            <div>
              {Object.entries(currentQ.mcq_options).map(([key, val]) => (
                <label
                  key={key}
                  style={{
                    display: "block",
                    padding: "10px 16px",
                    margin: "6px 0",
                    background:
                      answers[currentQ.paper_question_id]?.selected_option === key
                        ? "#d5f5e3"
                        : "#f8f9fa",
                    borderRadius: 6,
                    cursor: "pointer",
                    border: "1px solid #eee",
                  }}
                >
                  <input
                    type="radio"
                    name={`q-${currentQ.paper_question_id}`}
                    checked={
                      answers[currentQ.paper_question_id]?.selected_option === key
                    }
                    onChange={() =>
                      updateAnswer(
                        currentQ.paper_question_id,
                        "selected_option",
                        key
                      )
                    }
                    style={{ marginRight: 10 }}
                  />
                  <strong>{key.toUpperCase()}.</strong> {val}
                </label>
              ))}
            </div>
          ) : (
            <textarea
              value={answers[currentQ.paper_question_id]?.answer_text || ""}
              onChange={(e) =>
                updateAnswer(
                  currentQ.paper_question_id,
                  "answer_text",
                  e.target.value
                )
              }
              placeholder="Type your answer here..."
              style={{
                width: "100%",
                minHeight:
                  currentQ.question_type === "long_answer" ? 200 : 80,
                padding: 12,
                border: "1px solid #ddd",
                borderRadius: 6,
                fontSize: 14,
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
          )}

          {/* Navigation */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 20,
            }}
          >
            <button
              onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
              disabled={currentIdx === 0}
              style={navBtnStyle}
            >
              Previous
            </button>
            <button
              onClick={() =>
                setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))
              }
              disabled={currentIdx === questions.length - 1}
              style={navBtnStyle}
            >
              Next
            </button>
          </div>
        </div>

        {/* Question palette */}
        <div style={paletteStyle}>
          <h4 style={{ marginTop: 0 }}>Question Palette</h4>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 6,
            }}
          >
            {questions.map((q, i) => {
              const answered = !!answers[q.paper_question_id]?.answer_text ||
                !!answers[q.paper_question_id]?.selected_option;
              const flagged = answers[q.paper_question_id]?.is_flagged;
              return (
                <button
                  key={q.paper_question_id}
                  onClick={() => setCurrentIdx(i)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 6,
                    border: i === currentIdx ? "2px solid #3498db" : "1px solid #ddd",
                    background: answered
                      ? "#d5f5e3"
                      : flagged
                      ? "#fef9e7"
                      : "white",
                    cursor: "pointer",
                    fontWeight: i === currentIdx ? "bold" : "normal",
                    fontSize: 13,
                  }}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: "#7f8c8d" }}>
            <div>
              <span style={{ background: "#d5f5e3", padding: "2px 8px", borderRadius: 4 }}>
                &nbsp;
              </span>{" "}
              Answered
            </div>
            <div style={{ marginTop: 4 }}>
              <span style={{ background: "white", border: "1px solid #ddd", padding: "2px 8px", borderRadius: 4 }}>
                &nbsp;
              </span>{" "}
              Not answered
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const headerStyle: React.CSSProperties = {
  background: "white",
  padding: "12px 20px",
  borderRadius: 8,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};
const questionCardStyle: React.CSSProperties = {
  background: "white",
  padding: 24,
  borderRadius: 8,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};
const paletteStyle: React.CSSProperties = {
  background: "white",
  padding: 16,
  borderRadius: 8,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  alignSelf: "start",
  position: "sticky",
  top: 16,
};
const submitBtnStyle: React.CSSProperties = {
  padding: "8px 20px",
  background: "#e74c3c",
  color: "white",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: "bold",
};
const navBtnStyle: React.CSSProperties = {
  padding: "8px 20px",
  background: "#ecf0f1",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 14,
};

export default ExamTake;
