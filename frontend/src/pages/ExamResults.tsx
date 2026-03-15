import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { evaluationAPI, examAPI } from "../services/api";
import type { Evaluation, ExamSession } from "../types";

const ExamResults: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [session, setSession] = useState<ExamSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [evalMethod, setEvalMethod] = useState("rubric");

  useEffect(() => {
    if (!sessionId) return;
    examAPI.get(Number(sessionId)).then((res) => {
      setSession(res.data);
      if (res.data.status === "evaluated" || res.data.status === "reviewed") {
        // Load evaluation
        evaluationAPI
          .get(Number(sessionId))
          .then((evalRes) => setEvaluation(evalRes.data))
          .catch(() => {})
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });
  }, [sessionId]);

  const triggerEvaluation = async () => {
    if (!sessionId) return;
    setEvaluating(true);
    try {
      const { data } = await evaluationAPI.evaluate({
        session_id: Number(sessionId),
        method: evalMethod,
      });
      setEvaluation(data);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Evaluation failed");
    } finally {
      setEvaluating(false);
    }
  };

  if (loading) return <p>Loading results...</p>;

  if (!evaluation && session?.status === "submitted") {
    return (
      <div style={sectionStyle}>
        <h2>Exam Submitted</h2>
        <p>Your exam has been submitted. Choose an evaluation method:</p>
        <div style={{ display: "flex", gap: 12, margin: "16px 0", alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 14 }}>
            <input type="radio" name="method" value="rubric"
              checked={evalMethod === "rubric"}
              onChange={() => setEvalMethod("rubric")} />
            Rubric-based (Fast)
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 14 }}>
            <input type="radio" name="method" value="ai"
              checked={evalMethod === "ai"}
              onChange={() => setEvalMethod("ai")} />
            AI-Powered (Claude)
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 14 }}>
            <input type="radio" name="method" value="hybrid"
              checked={evalMethod === "hybrid"}
              onChange={() => setEvalMethod("hybrid")} />
            Hybrid (AI + Rubric)
          </label>
        </div>
        <p style={{ fontSize: 12, color: "#95a5a6", marginBottom: 12 }}>
          {evalMethod === "rubric" && "Uses keyword matching and marking scheme. Always available."}
          {evalMethod === "ai" && "Uses Claude AI for intelligent subjective answer evaluation. Requires API key."}
          {evalMethod === "hybrid" && "AI for subjective questions, auto-grade for MCQs. Best accuracy."}
        </p>
        <button
          onClick={triggerEvaluation}
          disabled={evaluating}
          style={btnStyle}
        >
          {evaluating ? "Evaluating..." : "Evaluate Now"}
        </button>
      </div>
    );
  }

  if (!evaluation) return <p>No results available.</p>;

  return (
    <div>
      <h2>Exam Results</h2>

      {/* Score summary */}
      <div style={gridStyle}>
        <ScoreCard
          label="Score"
          value={`${evaluation.total_marks_obtained}/${evaluation.total_marks_possible}`}
          color="#3498db"
        />
        <ScoreCard
          label="Percentage"
          value={`${evaluation.percentage}%`}
          color={evaluation.percentage >= 70 ? "#27ae60" : evaluation.percentage >= 40 ? "#e67e22" : "#e74c3c"}
        />
        <ScoreCard
          label="Grade"
          value={evaluation.grade || "-"}
          color="#9b59b6"
        />
      </div>

      {/* Topic Analysis */}
      {evaluation.topic_scores && (
        <div style={sectionStyle}>
          <h3>Topic-wise Analysis</h3>
          <div style={{ display: "grid", gap: 8 }}>
            {Object.entries(evaluation.topic_scores).map(([topic, scores]) => {
              const pct =
                scores.total > 0
                  ? Math.round((scores.obtained / scores.total) * 100)
                  : 0;
              return (
                <div key={topic}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 14,
                    }}
                  >
                    <span>{topic}</span>
                    <span>
                      {scores.obtained}/{scores.total} ({pct}%)
                    </span>
                  </div>
                  <div
                    style={{
                      height: 8,
                      background: "#ecf0f1",
                      borderRadius: 4,
                      marginTop: 4,
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${pct}%`,
                        background:
                          pct >= 70
                            ? "#27ae60"
                            : pct >= 40
                            ? "#e67e22"
                            : "#e74c3c",
                        borderRadius: 4,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Strengths & Weaknesses */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {evaluation.strengths && evaluation.strengths.length > 0 && (
          <div style={sectionStyle}>
            <h3 style={{ color: "#27ae60" }}>Strengths</h3>
            <ul>
              {evaluation.strengths.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        )}
        {evaluation.weaknesses && evaluation.weaknesses.length > 0 && (
          <div style={sectionStyle}>
            <h3 style={{ color: "#e74c3c" }}>Areas to Improve</h3>
            <ul>
              {evaluation.weaknesses.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Recommendations */}
      {evaluation.recommendations && (
        <div style={sectionStyle}>
          <h3>Study Recommendations</h3>
          <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
            {evaluation.recommendations}
          </p>
        </div>
      )}

      {/* Question-wise Results */}
      <div style={sectionStyle}>
        <h3>Question-wise Breakdown</h3>
        {evaluation.question_evaluations.map((qe, i) => (
          <div key={qe.id} style={qeCardStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <strong>Q{i + 1}. {qe.question_type}</strong>
              <span
                style={{
                  fontWeight: "bold",
                  color:
                    qe.marks_obtained / qe.marks_possible >= 0.7
                      ? "#27ae60"
                      : "#e74c3c",
                }}
              >
                {qe.marks_obtained}/{qe.marks_possible}
              </span>
            </div>
            <p style={{ fontSize: 14 }}>{qe.question_text}</p>
            {qe.student_answer && (
              <div style={{ background: "#f8f9fa", padding: 10, borderRadius: 4, fontSize: 13, margin: "8px 0" }}>
                <strong>Your answer:</strong> {qe.student_answer}
              </div>
            )}
            {qe.feedback && (
              <p style={{ color: "#2980b9", fontSize: 13 }}>{qe.feedback}</p>
            )}
            {qe.improvement_hint && (
              <p style={{ color: "#e67e22", fontSize: 13 }}>
                Hint: {qe.improvement_hint}
              </p>
            )}
          </div>
        ))}
      </div>

      <Link to="/exams" style={btnStyle}>
        Back to Exams
      </Link>
    </div>
  );
};

const ScoreCard: React.FC<{
  label: string;
  value: string;
  color: string;
}> = ({ label, value, color }) => (
  <div
    style={{
      background: "white",
      borderRadius: 8,
      padding: 20,
      textAlign: "center",
      borderTop: `4px solid ${color}`,
      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    }}
  >
    <div style={{ fontSize: 32, fontWeight: "bold", color }}>{value}</div>
    <div style={{ color: "#7f8c8d", fontSize: 14, marginTop: 4 }}>{label}</div>
  </div>
);

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 16,
  margin: "20px 0",
};
const sectionStyle: React.CSSProperties = {
  background: "white",
  borderRadius: 8,
  padding: 20,
  marginBottom: 16,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};
const qeCardStyle: React.CSSProperties = {
  padding: 16,
  borderBottom: "1px solid #eee",
};
const btnStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 24px",
  background: "#3498db",
  color: "white",
  border: "none",
  borderRadius: 6,
  textDecoration: "none",
  cursor: "pointer",
  fontSize: 14,
};

export default ExamResults;
