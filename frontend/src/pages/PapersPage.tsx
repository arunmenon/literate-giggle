import React, { useEffect, useState } from "react";
import { paperAPI, questionAPI } from "../services/api";
import type { QuestionPaper, Question } from "../types";

const BOARDS = ["CBSE", "ICSE", "State Board"];
const STATUS_COLORS: Record<string, string> = {
  draft: "#95a5a6", review: "#f39c12", published: "#3498db",
  active: "#27ae60", completed: "#8e44ad", archived: "#7f8c8d",
};

const PapersPage: React.FC = () => {
  const [papers, setPapers] = useState<QuestionPaper[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [availableQuestions, setAvailableQuestions] = useState<Question[]>([]);
  const [selectedQs, setSelectedQs] = useState<number[]>([]);
  const [form, setForm] = useState({
    title: "", board: "CBSE", class_grade: 10, subject: "",
    exam_type: "Unit Test", total_marks: 80, duration_minutes: 120,
    instructions: "",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    paperAPI.list().then((res) => {
      setPapers(res.data);
      setLoading(false);
    });
  }, []);

  const loadQuestions = () => {
    questionAPI
      .list({ board: form.board, class_grade: form.class_grade, subject: form.subject })
      .then((res) => setAvailableQuestions(res.data));
  };

  const createPaper = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      questions: selectedQs.map((qId, i) => ({
        question_id: qId,
        order: i + 1,
        section: "Section A",
      })),
    };
    const { data } = await paperAPI.create(payload);
    setPapers([data, ...papers]);
    setShowForm(false);
    setSelectedQs([]);
  };

  const updateStatus = async (paperId: number, newStatus: string) => {
    try {
      const { data } = await paperAPI.updateStatus(paperId, { status: newStatus });
      setPapers(papers.map((p) => (p.id === paperId ? { ...p, status: data.status } : p)));
    } catch (err: any) {
      alert(err.response?.data?.detail || "Status update failed");
    }
  };

  const getNextStatuses = (current: string): string[] => {
    const transitions: Record<string, string[]> = {
      draft: ["review", "published"],
      review: ["draft", "published"],
      published: ["active", "draft"],
      active: ["completed"],
      completed: ["archived"],
    };
    return transitions[current] || [];
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Question Papers</h2>
        <button onClick={() => setShowForm(!showForm)} style={btnStyle}>
          + Create Paper
        </button>
      </div>

      {showForm && (
        <form onSubmit={createPaper} style={formStyle}>
          <h4 style={{ marginTop: 0 }}>Create Question Paper</h4>
          <div style={rowStyle}>
            <input placeholder="Paper Title" value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required style={inputStyle} />
          </div>
          <div style={rowStyle}>
            <select value={form.board}
              onChange={(e) => setForm({ ...form, board: e.target.value })}
              style={inputStyle}>
              {BOARDS.map((b) => <option key={b}>{b}</option>)}
            </select>
            <select value={form.class_grade}
              onChange={(e) => setForm({ ...form, class_grade: Number(e.target.value) })}
              style={inputStyle}>
              {[7,8,9,10,11,12].map((c) => <option key={c} value={c}>Class {c}</option>)}
            </select>
            <input placeholder="Subject" value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              required style={inputStyle} />
          </div>
          <div style={rowStyle}>
            <select value={form.exam_type}
              onChange={(e) => setForm({ ...form, exam_type: e.target.value })}
              style={inputStyle}>
              {["Unit Test", "Mid-term", "Final", "Practice", "Board Pattern"].map((t) =>
                <option key={t}>{t}</option>
              )}
            </select>
            <input type="number" placeholder="Total Marks" value={form.total_marks}
              onChange={(e) => setForm({ ...form, total_marks: Number(e.target.value) })}
              style={inputStyle} />
            <input type="number" placeholder="Duration (min)" value={form.duration_minutes}
              onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
              style={inputStyle} />
          </div>
          <textarea placeholder="Instructions (optional)" value={form.instructions}
            onChange={(e) => setForm({ ...form, instructions: e.target.value })}
            style={{ ...inputStyle, minHeight: 40, marginBottom: 12 }} />

          {/* Question selection */}
          <div style={{ marginBottom: 12 }}>
            <button type="button" onClick={loadQuestions}
              style={{ ...btnStyle, background: "#e67e22", marginBottom: 8 }}>
              Load Questions for {form.subject}
            </button>
            {availableQuestions.length > 0 && (
              <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid #eee", borderRadius: 6, padding: 8 }}>
                {availableQuestions.map((q) => (
                  <label key={q.id} style={{ display: "flex", gap: 8, padding: 4, fontSize: 13 }}>
                    <input type="checkbox"
                      checked={selectedQs.includes(q.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedQs([...selectedQs, q.id]);
                        else setSelectedQs(selectedQs.filter((id) => id !== q.id));
                      }} />
                    [{q.question_type}] {q.question_text.slice(0, 80)}... ({q.marks}m)
                  </label>
                ))}
              </div>
            )}
            <p style={{ fontSize: 12, color: "#7f8c8d" }}>
              {selectedQs.length} questions selected
            </p>
          </div>

          <button type="submit" style={btnStyle}>Create Paper</button>
        </form>
      )}

      {/* Papers list */}
      <div style={{ display: "grid", gap: 12 }}>
        {papers.map((paper) => (
          <div key={paper.id} style={paperCardStyle}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h4 style={{ margin: 0 }}>{paper.title}</h4>
                <span style={{
                  padding: "2px 10px", borderRadius: 12, fontSize: 11,
                  background: STATUS_COLORS[paper.status] + "20",
                  color: STATUS_COLORS[paper.status],
                  fontWeight: 600,
                }}>
                  {paper.status}
                </span>
              </div>
              <p style={{ color: "#7f8c8d", fontSize: 13, margin: "4px 0" }}>
                {paper.board} | Class {paper.class_grade} | {paper.subject} |{" "}
                {paper.total_marks} marks | {paper.duration_minutes} min |{" "}
                {paper.question_count} questions
              </p>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {getNextStatuses(paper.status).map((ns) => (
                <button key={ns} onClick={() => updateStatus(paper.id, ns)}
                  style={{
                    padding: "4px 12px", border: "1px solid #ddd", borderRadius: 4,
                    background: "white", cursor: "pointer", fontSize: 12,
                  }}>
                  → {ns}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const btnStyle: React.CSSProperties = {
  padding: "8px 16px", background: "#3498db", color: "white",
  border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13,
};
const inputStyle: React.CSSProperties = {
  padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6,
  fontSize: 14, width: "100%", boxSizing: "border-box",
};
const formStyle: React.CSSProperties = {
  background: "white", padding: 20, borderRadius: 8,
  marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};
const rowStyle: React.CSSProperties = {
  display: "flex", gap: 8, marginBottom: 8,
};
const paperCardStyle: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: 16, background: "white", borderRadius: 8,
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
};

export default PapersPage;
