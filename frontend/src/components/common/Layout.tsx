import React from "react";
import { Link, useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "../../store/AuthContext";

const Layout: React.FC = () => {
  const { isAuthenticated, fullName, role, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (!isAuthenticated) {
    return <Outlet />;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f5f6fa" }}>
      {/* Nav */}
      <nav
        style={{
          background: "#2c3e50",
          color: "white",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          height: 56,
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Link
            to="/"
            style={{
              color: "white",
              textDecoration: "none",
              fontWeight: "bold",
              fontSize: 20,
            }}
          >
            ExamIQ
          </Link>
          {role === "student" && (
            <>
              <Link to="/" style={navLinkStyle}>
                Dashboard
              </Link>
              <Link to="/exams" style={navLinkStyle}>
                My Exams
              </Link>
              <Link to="/learning" style={navLinkStyle}>
                Learning Plans
              </Link>
            </>
          )}
          {(role === "teacher" || role === "admin") && (
            <>
              <Link to="/" style={navLinkStyle}>
                Dashboard
              </Link>
              <Link to="/questions" style={navLinkStyle}>
                Question Bank
              </Link>
              <Link to="/papers" style={navLinkStyle}>
                Papers
              </Link>
            </>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 14 }}>
            {fullName} ({role})
          </span>
          <button
            onClick={handleLogout}
            style={{
              background: "#e74c3c",
              color: "white",
              border: "none",
              padding: "6px 16px",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </div>
      </nav>
      {/* Content */}
      <main style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
        <Outlet />
      </main>
    </div>
  );
};

const navLinkStyle: React.CSSProperties = {
  color: "#bdc3c7",
  textDecoration: "none",
  fontSize: 14,
};

export default Layout;
