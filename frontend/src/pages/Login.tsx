import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { authAPI } from "../services/api";
import { useAuth } from "../store/AuthContext";

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await authAPI.login({ email, password });
      login(data);
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={{ textAlign: "center", color: "#2c3e50", marginBottom: 8 }}>
          ExamIQ
        </h1>
        <p
          style={{
            textAlign: "center",
            color: "#7f8c8d",
            marginBottom: 24,
            fontSize: 14,
          }}
        >
          Exam Evaluator Platform for ICSE / CBSE
        </p>
        {error && <div style={errorStyle}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div style={fieldStyle}>
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={inputStyle}
              placeholder="teacher@school.com"
            />
          </div>
          <div style={fieldStyle}>
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={inputStyle}
            />
          </div>
          <button type="submit" disabled={loading} style={btnStyle}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <p style={{ textAlign: "center", marginTop: 16, fontSize: 14 }}>
          Don't have an account?{" "}
          <Link to="/register" style={{ color: "#3498db" }}>
            Register
          </Link>
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
  width: 400,
  boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
};
const fieldStyle: React.CSSProperties = { marginBottom: 16 };
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

export default Login;
