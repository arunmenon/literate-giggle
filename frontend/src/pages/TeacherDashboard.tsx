import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { dashboardAPI } from "../services/api";

const TeacherDashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardAPI
      .teacherStats()
      .then((res) => setStats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading dashboard...</p>;

  return (
    <div>
      <h2>Teacher Dashboard</h2>

      <div style={gridStyle}>
        <StatCard
          label="Papers Created"
          value={stats?.papers_created ?? 0}
          color="#3498db"
        />
        <StatCard
          label="Total Exam Sessions"
          value={stats?.total_exam_sessions ?? 0}
          color="#2ecc71"
        />
        <StatCard
          label="Avg Student Score"
          value={
            stats?.average_student_score
              ? `${stats.average_student_score}%`
              : "N/A"
          }
          color="#e67e22"
        />
      </div>

      <div style={sectionStyle}>
        <h3>Quick Actions</h3>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link to="/questions" style={actionBtnStyle}>
            Manage Question Bank
          </Link>
          <Link
            to="/papers"
            style={{ ...actionBtnStyle, background: "#2ecc71" }}
          >
            Create Question Paper
          </Link>
        </div>
      </div>

      <div style={sectionStyle}>
        <h3>Exam Lifecycle</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {[
            "Draft",
            "Review",
            "Published",
            "Active",
            "Completed",
            "Archived",
          ].map((stage, i) => (
            <React.Fragment key={stage}>
              <div
                style={{
                  padding: "8px 16px",
                  background: "#ecf0f1",
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                {stage}
              </div>
              {i < 5 && <span style={{ color: "#bdc3c7" }}>→</span>}
            </React.Fragment>
          ))}
        </div>
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
const actionBtnStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 24px",
  background: "#3498db",
  color: "white",
  borderRadius: 6,
  textDecoration: "none",
  fontSize: 14,
};

export default TeacherDashboard;
