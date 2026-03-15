import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { paperAPI, examAPI } from "../services/api";
import type { QuestionPaper, ExamSession } from "../types";

const ExamList: React.FC = () => {
  const [papers, setPapers] = useState<QuestionPaper[]>([]);
  const [myExams, setMyExams] = useState<ExamSession[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      paperAPI.list({ status: "published" }).catch(() => ({ data: [] })),
      paperAPI.list({ status: "active" }).catch(() => ({ data: [] })),
      examAPI.list().catch(() => ({ data: [] })),
    ]).then(([pub, active, exams]) => {
      setPapers([...(pub.data || []), ...(active.data || [])]);
      setMyExams(exams.data || []);
      setLoading(false);
    });
  }, []);

  const startExam = async (paperId: number, practice: boolean) => {
    try {
      const { data } = await examAPI.start({
        paper_id: paperId,
        is_practice: practice,
      });
      navigate(`/exam/${data.id}`);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to start exam");
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h2>Available Exams</h2>

      {/* Past Exams */}
      {myExams.length > 0 && (
        <div style={sectionStyle}>
          <h3>My Exam History</h3>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Session ID</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Score</th>
                <th style={thStyle}>Grade</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {myExams.map((exam) => (
                <tr key={exam.id}>
                  <td style={tdStyle}>#{exam.id}</td>
                  <td style={tdStyle}>
                    <span style={statusBadge(exam.status)}>{exam.status}</span>
                  </td>
                  <td style={tdStyle}>
                    {exam.percentage != null ? `${exam.percentage}%` : "-"}
                  </td>
                  <td style={tdStyle}>{exam.grade || "-"}</td>
                  <td style={tdStyle}>
                    {exam.status === "in_progress" && (
                      <Link to={`/exam/${exam.id}`} style={linkStyle}>
                        Continue
                      </Link>
                    )}
                    {exam.status === "evaluated" && (
                      <Link to={`/results/${exam.id}`} style={linkStyle}>
                        View Results
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Available Papers */}
      <div style={sectionStyle}>
        <h3>Available Question Papers</h3>
        {papers.length === 0 ? (
          <p style={{ color: "#95a5a6" }}>
            No papers available. Ask your teacher to publish papers.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {papers.map((paper) => (
              <div key={paper.id} style={paperCardStyle}>
                <div>
                  <h4 style={{ margin: 0 }}>{paper.title}</h4>
                  <p style={{ color: "#7f8c8d", margin: "4px 0", fontSize: 13 }}>
                    {paper.board} | Class {paper.class_grade} | {paper.subject}{" "}
                    | {paper.total_marks} marks | {paper.duration_minutes} min
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => startExam(paper.id, true)}
                    style={{ ...btnStyle, background: "#e67e22" }}
                  >
                    Practice
                  </button>
                  {paper.status === "active" && (
                    <button
                      onClick={() => startExam(paper.id, false)}
                      style={btnStyle}
                    >
                      Start Exam
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const statusBadge = (status: string): React.CSSProperties => ({
  padding: "2px 8px",
  borderRadius: 12,
  fontSize: 12,
  background:
    status === "evaluated"
      ? "#d5f5e3"
      : status === "in_progress"
      ? "#fef9e7"
      : "#eee",
  color:
    status === "evaluated"
      ? "#27ae60"
      : status === "in_progress"
      ? "#e67e22"
      : "#666",
});

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
const paperCardStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: 16,
  background: "#f8f9fa",
  borderRadius: 8,
  border: "1px solid #eee",
};
const btnStyle: React.CSSProperties = {
  padding: "8px 16px",
  background: "#3498db",
  color: "white",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 13,
};
const linkStyle: React.CSSProperties = {
  color: "#3498db",
  textDecoration: "none",
  fontSize: 13,
};

export default ExamList;
