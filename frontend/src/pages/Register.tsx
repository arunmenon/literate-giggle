import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { authAPI } from "../services/api";
import { useAuth } from "../store/AuthContext";

const BOARDS = ["CBSE", "ICSE", "State Board"];
const CLASSES = [7, 8, 9, 10, 11, 12];

const Register: React.FC = () => {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "student",
    board: "CBSE",
    class_grade: 10,
    school_name: "",
    subjects: "Mathematics",
    institution: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const update = (field: string, value: any) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload: any = {
        user: {
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          role: form.role,
        },
      };
      if (form.role === "student") {
        payload.student_profile = {
          board: form.board,
          class_grade: form.class_grade,
          school_name: form.school_name || undefined,
        };
      } else {
        payload.teacher_profile = {
          board: form.board,
          subjects: form.subjects.split(",").map((s: string) => s.trim()),
          classes: CLASSES,
          institution: form.institution || undefined,
        };
      }
      const { data } = await authAPI.register(payload);
      login(data);
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={{ textAlign: "center", color: "#2c3e50", marginBottom: 8 }}>
          Join ExamIQ
        </h1>
        <p style={{ textAlign: "center", color: "#7f8c8d", marginBottom: 24, fontSize: 14 }}>
          Create your account
        </p>
        {error && <div style={errorStyle}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div style={fieldStyle}>
            <label>Full Name</label>
            <input
              value={form.full_name}
              onChange={(e) => update("full_name", e.target.value)}
              required
              style={inputStyle}
            />
          </div>
          <div style={fieldStyle}>
            <label>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              required
              style={inputStyle}
            />
          </div>
          <div style={fieldStyle}>
            <label>Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              required
              minLength={6}
              style={inputStyle}
            />
          </div>
          <div style={fieldStyle}>
            <label>Role</label>
            <select
              value={form.role}
              onChange={(e) => update("role", e.target.value)}
              style={inputStyle}
            >
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
            </select>
          </div>
          <div style={fieldStyle}>
            <label>Board</label>
            <select
              value={form.board}
              onChange={(e) => update("board", e.target.value)}
              style={inputStyle}
            >
              {BOARDS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          {form.role === "student" && (
            <>
              <div style={fieldStyle}>
                <label>Class</label>
                <select
                  value={form.class_grade}
                  onChange={(e) => update("class_grade", Number(e.target.value))}
                  style={inputStyle}
                >
                  {CLASSES.map((c) => (
                    <option key={c} value={c}>Class {c}</option>
                  ))}
                </select>
              </div>
              <div style={fieldStyle}>
                <label>School Name (optional)</label>
                <input
                  value={form.school_name}
                  onChange={(e) => update("school_name", e.target.value)}
                  style={inputStyle}
                />
              </div>
            </>
          )}
          {form.role === "teacher" && (
            <>
              <div style={fieldStyle}>
                <label>Subjects (comma-separated)</label>
                <input
                  value={form.subjects}
                  onChange={(e) => update("subjects", e.target.value)}
                  style={inputStyle}
                  placeholder="Mathematics, Science"
                />
              </div>
              <div style={fieldStyle}>
                <label>Institution (optional)</label>
                <input
                  value={form.institution}
                  onChange={(e) => update("institution", e.target.value)}
                  style={inputStyle}
                />
              </div>
            </>
          )}
          <button type="submit" disabled={loading} style={btnStyle}>
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>
        <p style={{ textAlign: "center", marginTop: 16, fontSize: 14 }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: "#3498db" }}>Sign In</Link>
        </p>
      </div>
    </div>
  );
};

const containerStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
};
const cardStyle: React.CSSProperties = {
  background: "white",
  padding: 40,
  borderRadius: 12,
  width: 440,
  boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
  maxHeight: "90vh",
  overflowY: "auto",
};
const fieldStyle: React.CSSProperties = { marginBottom: 12 };
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #ddd",
  borderRadius: 6,
  fontSize: 14,
  marginTop: 4,
  boxSizing: "border-box",
};
const btnStyle: React.CSSProperties = {
  width: "100%",
  padding: 12,
  background: "#3498db",
  color: "white",
  border: "none",
  borderRadius: 6,
  fontSize: 16,
  cursor: "pointer",
  marginTop: 8,
};
const errorStyle: React.CSSProperties = {
  background: "#fee",
  color: "#c0392b",
  padding: 10,
  borderRadius: 6,
  marginBottom: 16,
  fontSize: 14,
};

export default Register;
