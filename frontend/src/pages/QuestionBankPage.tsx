import React, { useEffect, useState } from "react";
import { questionAPI } from "../services/api";
import type { QuestionBank, Question } from "../types";

const BOARDS = ["CBSE", "ICSE", "State Board"];
const TYPES = [
  "mcq", "short_answer", "long_answer", "very_short",
  "fill_in_blank", "true_false", "numerical", "case_study",
];
const DIFFICULTIES = ["easy", "medium", "hard"];

const QuestionBankPage: React.FC = () => {
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedBank, setSelectedBank] = useState<number | null>(null);
  const [showBankForm, setShowBankForm] = useState(false);
  const [showQForm, setShowQForm] = useState(false);
  const [bankForm, setBankForm] = useState({
    name: "", board: "CBSE", class_grade: 10, subject: "", chapter: "",
  });
  const [qForm, setQForm] = useState({
    question_type: "mcq", question_text: "", marks: 1, difficulty: "medium",
    topic: "", model_answer: "", answer_keywords: "",
    mcq_a: "", mcq_b: "", mcq_c: "", mcq_d: "", correct_option: "a",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    questionAPI.listBanks().then((res) => {
      setBanks(res.data);
      setLoading(false);
    });
  }, []);

  const loadQuestions = (bankId: number) => {
    setSelectedBank(bankId);
    questionAPI.list({ bank_id: bankId }).then((res) => setQuestions(res.data));
  };

  const createBank = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data } = await questionAPI.createBank(bankForm);
    setBanks([data, ...banks]);
    setShowBankForm(false);
    setBankForm({ name: "", board: "CBSE", class_grade: 10, subject: "", chapter: "" });
  };

  const createQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBank) return;
    const payload: any = {
      bank_id: selectedBank,
      question_type: qForm.question_type,
      question_text: qForm.question_text,
      marks: qForm.marks,
      difficulty: qForm.difficulty,
      topic: qForm.topic,
      model_answer: qForm.model_answer || undefined,
      answer_keywords: qForm.answer_keywords
        ? qForm.answer_keywords.split(",").map((k) => k.trim())
        : undefined,
    };
    if (qForm.question_type === "mcq") {
      payload.mcq_options = {
        a: qForm.mcq_a, b: qForm.mcq_b, c: qForm.mcq_c, d: qForm.mcq_d,
      };
      payload.correct_option = qForm.correct_option;
    }
    const { data } = await questionAPI.create(payload);
    setQuestions([data, ...questions]);
    setShowQForm(false);
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Question Bank</h2>
        <button onClick={() => setShowBankForm(!showBankForm)} style={btnStyle}>
          + New Bank
        </button>
      </div>

      {/* Create bank form */}
      {showBankForm && (
        <form onSubmit={createBank} style={formStyle}>
          <h4 style={{ marginTop: 0 }}>Create Question Bank</h4>
          <div style={rowStyle}>
            <input placeholder="Bank Name" value={bankForm.name}
              onChange={(e) => setBankForm({ ...bankForm, name: e.target.value })}
              required style={inputStyle} />
            <select value={bankForm.board}
              onChange={(e) => setBankForm({ ...bankForm, board: e.target.value })}
              style={inputStyle}>
              {BOARDS.map((b) => <option key={b}>{b}</option>)}
            </select>
            <select value={bankForm.class_grade}
              onChange={(e) => setBankForm({ ...bankForm, class_grade: Number(e.target.value) })}
              style={inputStyle}>
              {[7,8,9,10,11,12].map((c) => <option key={c} value={c}>Class {c}</option>)}
            </select>
          </div>
          <div style={rowStyle}>
            <input placeholder="Subject" value={bankForm.subject}
              onChange={(e) => setBankForm({ ...bankForm, subject: e.target.value })}
              required style={inputStyle} />
            <input placeholder="Chapter (optional)" value={bankForm.chapter}
              onChange={(e) => setBankForm({ ...bankForm, chapter: e.target.value })}
              style={inputStyle} />
            <button type="submit" style={btnStyle}>Create</button>
          </div>
        </form>
      )}

      {/* Banks list */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12, marginBottom: 24 }}>
        {banks.map((bank) => (
          <div key={bank.id}
            onClick={() => loadQuestions(bank.id)}
            style={{
              ...cardStyle,
              border: selectedBank === bank.id ? "2px solid #3498db" : "1px solid #eee",
              cursor: "pointer",
            }}>
            <h4 style={{ margin: 0 }}>{bank.name}</h4>
            <p style={{ color: "#7f8c8d", fontSize: 13, margin: "4px 0" }}>
              {bank.board} | Class {bank.class_grade} | {bank.subject}
            </p>
            <span style={{ fontSize: 12, color: "#3498db" }}>
              {bank.question_count} questions
            </span>
          </div>
        ))}
      </div>

      {/* Questions */}
      {selectedBank && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3>Questions</h3>
            <button onClick={() => setShowQForm(!showQForm)} style={btnStyle}>
              + Add Question
            </button>
          </div>

          {showQForm && (
            <form onSubmit={createQuestion} style={formStyle}>
              <h4 style={{ marginTop: 0 }}>Add Question</h4>
              <div style={rowStyle}>
                <select value={qForm.question_type}
                  onChange={(e) => setQForm({ ...qForm, question_type: e.target.value })}
                  style={inputStyle}>
                  {TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                </select>
                <select value={qForm.difficulty}
                  onChange={(e) => setQForm({ ...qForm, difficulty: e.target.value })}
                  style={inputStyle}>
                  {DIFFICULTIES.map((d) => <option key={d}>{d}</option>)}
                </select>
                <input type="number" placeholder="Marks" value={qForm.marks}
                  onChange={(e) => setQForm({ ...qForm, marks: Number(e.target.value) })}
                  style={{ ...inputStyle, width: 80 }} />
              </div>
              <input placeholder="Topic" value={qForm.topic}
                onChange={(e) => setQForm({ ...qForm, topic: e.target.value })}
                required style={{ ...inputStyle, marginBottom: 8 }} />
              <textarea placeholder="Question text" value={qForm.question_text}
                onChange={(e) => setQForm({ ...qForm, question_text: e.target.value })}
                required style={{ ...inputStyle, minHeight: 60, marginBottom: 8 }} />

              {qForm.question_type === "mcq" && (
                <div style={{ marginBottom: 8 }}>
                  <input placeholder="Option A" value={qForm.mcq_a}
                    onChange={(e) => setQForm({ ...qForm, mcq_a: e.target.value })}
                    style={{ ...inputStyle, marginBottom: 4 }} />
                  <input placeholder="Option B" value={qForm.mcq_b}
                    onChange={(e) => setQForm({ ...qForm, mcq_b: e.target.value })}
                    style={{ ...inputStyle, marginBottom: 4 }} />
                  <input placeholder="Option C" value={qForm.mcq_c}
                    onChange={(e) => setQForm({ ...qForm, mcq_c: e.target.value })}
                    style={{ ...inputStyle, marginBottom: 4 }} />
                  <input placeholder="Option D" value={qForm.mcq_d}
                    onChange={(e) => setQForm({ ...qForm, mcq_d: e.target.value })}
                    style={{ ...inputStyle, marginBottom: 4 }} />
                  <select value={qForm.correct_option}
                    onChange={(e) => setQForm({ ...qForm, correct_option: e.target.value })}
                    style={inputStyle}>
                    <option value="a">Correct: A</option>
                    <option value="b">Correct: B</option>
                    <option value="c">Correct: C</option>
                    <option value="d">Correct: D</option>
                  </select>
                </div>
              )}

              <textarea placeholder="Model Answer" value={qForm.model_answer}
                onChange={(e) => setQForm({ ...qForm, model_answer: e.target.value })}
                style={{ ...inputStyle, minHeight: 40, marginBottom: 8 }} />
              <input placeholder="Answer keywords (comma-separated)" value={qForm.answer_keywords}
                onChange={(e) => setQForm({ ...qForm, answer_keywords: e.target.value })}
                style={{ ...inputStyle, marginBottom: 8 }} />

              <button type="submit" style={btnStyle}>Add Question</button>
            </form>
          )}

          {questions.length === 0 ? (
            <p style={{ color: "#95a5a6" }}>No questions yet. Add some!</p>
          ) : (
            questions.map((q, i) => (
              <div key={q.id} style={{ ...cardStyle, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: "bold", fontSize: 13 }}>
                    Q{i + 1}. [{q.question_type}] {q.marks} marks | {q.difficulty}
                  </span>
                  <span style={{ fontSize: 12, color: "#7f8c8d" }}>{q.topic}</span>
                </div>
                <p style={{ margin: "8px 0", fontSize: 14 }}>{q.question_text}</p>
              </div>
            ))
          )}
        </div>
      )}
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
const cardStyle: React.CSSProperties = {
  background: "white", padding: 16, borderRadius: 8,
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
};

export default QuestionBankPage;
