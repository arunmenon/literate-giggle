import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { dashboardAPI } from "../services/api";
import type { StudentDashboard as DashboardData } from "../types";

const StudentDashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardAPI
      .student()
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading dashboard...</p>;
  if (!data) return <p>Failed to load dashboard.</p>;

  return (
    <div>
      <h2>Welcome, {data.user.full_name}</h2>
      <p style={{ color: "#7f8c8d" }}>
        {data.profile.board} - Class {data.profile.class_grade} |{" "}
        {data.profile.academic_year}
      </p>

      {/* Stat cards */}
      <div style={gridStyle}>
        <StatCard
          label="Exams Taken"
          value={data.total_exams_taken}
          color="#3498db"
        />
        <StatCard
          label="Average Score"
          value={data.average_score ? `${data.average_score}%` : "N/A"}
          color="#2ecc71"
        />
        <StatCard
          label="Active Plans"
          value={data.active_learning_plans}
          color="#e67e22"
        />
        <StatCard
          label="Weak Areas"
          value={data.weaknesses.length}
          color="#e74c3c"
        />
      </div>

      {/* Recent Scores */}
      <div style={sectionStyle}>
        <h3>Recent Exam Scores</h3>
        {data.recent_scores.length === 0 ? (
          <p style={{ color: "#95a5a6" }}>No exams taken yet.</p>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Exam</th>
                <th style={thStyle}>Subject</th>
                <th style={thStyle}>Score</th>
                <th style={thStyle}>Grade</th>
                <th style={thStyle}>Date</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_scores.map((s, i) => (
                <tr key={i}>
                  <td style={tdStyle}>{s.exam}</td>
                  <td style={tdStyle}>{s.subject}</td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        color: s.score >= 70 ? "#27ae60" : s.score >= 40 ? "#e67e22" : "#e74c3c",
                        fontWeight: "bold",
                      }}
                    >
                      {s.score}%
                    </span>
                  </td>
                  <td style={tdStyle}>{s.grade}</td>
                  <td style={tdStyle}>
                    {s.date ? new Date(s.date).toLocaleDateString() : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Strengths & Weaknesses */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={sectionStyle}>
          <h3 style={{ color: "#27ae60" }}>Strengths</h3>
          {data.strengths.length > 0 ? (
            <ul>
              {data.strengths.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          ) : (
            <p style={{ color: "#95a5a6" }}>Take exams to identify strengths.</p>
          )}
        </div>
        <div style={sectionStyle}>
          <h3 style={{ color: "#e74c3c" }}>Areas to Improve</h3>
          {data.weaknesses.length > 0 ? (
            <ul>
              {data.weaknesses.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : (
            <p style={{ color: "#95a5a6" }}>No weak areas identified yet.</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ ...sectionStyle, display: "flex", gap: 12 }}>
        <Link to="/exams" style={actionBtnStyle}>
          Take an Exam
        </Link>
        <Link to="/learning" style={{ ...actionBtnStyle, background: "#e67e22" }}>
          View Learning Plans
        </Link>
      </div>
    </div>
  );
};

const StatCard: React.FC<{
  label: string;
  value: string | number;
  color: string;
}> = ({ label, value, color }) => (
  <div
    style={{
      background: "white",
      borderRadius: 8,
      padding: 20,
      borderLeft: `4px solid ${color}`,
      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    }}
  >
    <div style={{ fontSize: 28, fontWeight: "bold", color }}>{value}</div>
    <div style={{ color: "#7f8c8d", fontSize: 14, marginTop: 4 }}>{label}</div>
  </div>
);

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
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
const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};
const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 12px",
  borderBottom: "2px solid #eee",
  color: "#7f8c8d",
  fontSize: 13,
};
const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #f0f0f0",
  fontSize: 14,
};
const actionBtnStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 24px",
  background: "#3498db",
  color: "white",
  borderRadius: 6,
  textDecoration: "none",
  fontSize: 14,
};

export default StudentDashboard;
