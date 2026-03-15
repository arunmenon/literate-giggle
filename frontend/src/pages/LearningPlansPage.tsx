import React, { useEffect, useState } from "react";
import { learningAPI } from "../services/api";
import type { LearningPlan, TopicMastery } from "../types";
import { useAuth } from "../store/AuthContext";

const MASTERY_COLORS: Record<string, string> = {
  not_started: "#95a5a6",
  beginner: "#e74c3c",
  developing: "#e67e22",
  proficient: "#3498db",
  mastered: "#27ae60",
};

const LearningPlansPage: React.FC = () => {
  const { userId } = useAuth();
  const [plans, setPlans] = useState<LearningPlan[]>([]);
  const [mastery, setMastery] = useState<TopicMastery[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerate, setShowGenerate] = useState(false);
  const [genForm, setGenForm] = useState({
    subject: "Mathematics",
    board: "CBSE",
    class_grade: 10,
    target_score: 90,
  });

  useEffect(() => {
    Promise.all([
      learningAPI.listPlans().catch(() => ({ data: [] })),
      learningAPI.getMastery().catch(() => ({ data: [] })),
    ]).then(([plansRes, masteryRes]) => {
      setPlans(plansRes.data || []);
      setMastery(masteryRes.data || []);
      setLoading(false);
    });
  }, []);

  const generatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await learningAPI.generatePlan({
        student_id: userId,
        ...genForm,
      });
      setPlans([data, ...plans]);
      setShowGenerate(false);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to generate plan");
    }
  };

  const updateObjective = async (objId: number, status: string) => {
    try {
      await learningAPI.updateObjective(objId, { status });
      // Refresh plans
      const { data } = await learningAPI.listPlans();
      setPlans(data);
    } catch (err: any) {
      alert("Failed to update");
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Learning Plans</h2>
        <button onClick={() => setShowGenerate(!showGenerate)} style={btnStyle}>
          + Generate Plan
        </button>
      </div>

      {showGenerate && (
        <form onSubmit={generatePlan} style={formStyle}>
          <h4 style={{ marginTop: 0 }}>Generate Personalized Plan</h4>
          <div style={rowStyle}>
            <input placeholder="Subject" value={genForm.subject}
              onChange={(e) => setGenForm({ ...genForm, subject: e.target.value })}
              required style={inputStyle} />
            <select value={genForm.board}
              onChange={(e) => setGenForm({ ...genForm, board: e.target.value })}
              style={inputStyle}>
              <option>CBSE</option>
              <option>ICSE</option>
              <option>State Board</option>
            </select>
            <select value={genForm.class_grade}
              onChange={(e) => setGenForm({ ...genForm, class_grade: Number(e.target.value) })}
              style={inputStyle}>
              {[7,8,9,10,11,12].map((c) => <option key={c} value={c}>Class {c}</option>)}
            </select>
            <input type="number" placeholder="Target %" value={genForm.target_score}
              onChange={(e) => setGenForm({ ...genForm, target_score: Number(e.target.value) })}
              style={{ ...inputStyle, width: 100 }} />
          </div>
          <button type="submit" style={btnStyle}>Generate</button>
        </form>
      )}

      {/* Topic Mastery Overview */}
      {mastery.length > 0 && (
        <div style={sectionStyle}>
          <h3>Topic Mastery</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            {mastery.map((m) => (
              <div key={m.id} style={{
                padding: 12, borderRadius: 8, background: "#f8f9fa",
                borderLeft: `4px solid ${MASTERY_COLORS[m.mastery_level]}`,
              }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{m.topic}</div>
                <div style={{ fontSize: 12, color: "#7f8c8d" }}>{m.subject}</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                  <span style={{
                    fontSize: 11, padding: "2px 8px", borderRadius: 10,
                    background: MASTERY_COLORS[m.mastery_level] + "20",
                    color: MASTERY_COLORS[m.mastery_level],
                  }}>
                    {m.mastery_level.replace("_", " ")}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{m.avg_score_pct}%</span>
                </div>
                {m.trend && (
                  <span style={{ fontSize: 11, color: m.trend === "improving" ? "#27ae60" : m.trend === "declining" ? "#e74c3c" : "#95a5a6" }}>
                    {m.trend === "improving" ? "↑" : m.trend === "declining" ? "↓" : "→"} {m.trend}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plans */}
      {plans.length === 0 ? (
        <div style={sectionStyle}>
          <p style={{ color: "#95a5a6" }}>
            No learning plans yet. Take exams and generate a personalized plan!
          </p>
        </div>
      ) : (
        plans.map((plan) => (
          <div key={plan.id} style={sectionStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0 }}>{plan.title}</h3>
                <p style={{ color: "#7f8c8d", margin: "4px 0", fontSize: 13 }}>
                  {plan.subject} | {plan.board} | Class {plan.class_grade}
                  {plan.estimated_hours && ` | ~${plan.estimated_hours}h estimated`}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 24, fontWeight: "bold", color: "#3498db" }}>
                  {plan.progress_pct}%
                </div>
                <div style={{ fontSize: 12, color: "#7f8c8d" }}>Progress</div>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ height: 8, background: "#ecf0f1", borderRadius: 4, margin: "12px 0" }}>
              <div style={{
                height: "100%", width: `${plan.progress_pct}%`,
                background: "#3498db", borderRadius: 4,
                transition: "width 0.3s",
              }} />
            </div>

            {plan.description && (
              <p style={{ fontSize: 13, color: "#555", marginBottom: 12 }}>{plan.description}</p>
            )}

            {/* Objectives */}
            <div>
              {plan.objectives
                .sort((a, b) => a.priority - b.priority)
                .map((obj) => (
                  <div key={obj.id} style={objStyle}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                          width: 20, height: 20, borderRadius: "50%",
                          background: obj.status === "completed" ? "#27ae60" : obj.status === "in_progress" ? "#e67e22" : "#ecf0f1",
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, color: "white",
                        }}>
                          {obj.status === "completed" ? "✓" : obj.priority}
                        </span>
                        <strong style={{ fontSize: 14 }}>{obj.topic}</strong>
                        <span style={{
                          fontSize: 11, padding: "1px 6px", borderRadius: 8,
                          background: MASTERY_COLORS[obj.current_mastery] + "20",
                          color: MASTERY_COLORS[obj.current_mastery],
                        }}>
                          {obj.current_mastery.replace("_", " ")}
                        </span>
                      </div>
                      <p style={{ fontSize: 13, color: "#666", margin: "4px 0 4px 28px" }}>
                        {obj.description}
                      </p>
                      {obj.resources && (
                        <div style={{ marginLeft: 28, fontSize: 12, color: "#3498db" }}>
                          {obj.resources.map((r, i) => (
                            <span key={i} style={{ marginRight: 12 }}>
                              [{r.type}] {r.title}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      {obj.status !== "completed" && (
                        <>
                          {obj.status !== "in_progress" && (
                            <button onClick={() => updateObjective(obj.id, "in_progress")}
                              style={smallBtn}>Start</button>
                          )}
                          <button onClick={() => updateObjective(obj.id, "completed")}
                            style={{ ...smallBtn, background: "#27ae60" }}>Done</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

const btnStyle: React.CSSProperties = {
  padding: "8px 16px", background: "#3498db", color: "white",
  border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13,
};
const smallBtn: React.CSSProperties = {
  padding: "4px 10px", background: "#e67e22", color: "white",
  border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11,
};
const inputStyle: React.CSSProperties = {
  padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6,
  fontSize: 14, width: "100%", boxSizing: "border-box",
};
const formStyle: React.CSSProperties = {
  background: "white", padding: 20, borderRadius: 8,
  marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};
const rowStyle: React.CSSProperties = { display: "flex", gap: 8, marginBottom: 8 };
const sectionStyle: React.CSSProperties = {
  background: "white", borderRadius: 8, padding: 20,
  marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};
const objStyle: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "start",
  padding: "10px 0", borderBottom: "1px solid #f0f0f0",
};

export default LearningPlansPage;
