import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./store/AuthContext";
import Layout from "./components/common/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import StudentDashboard from "./pages/StudentDashboard";
import TeacherDashboard from "./pages/TeacherDashboard";
import ExamList from "./pages/ExamList";
import ExamTake from "./pages/ExamTake";
import ExamResults from "./pages/ExamResults";
import QuestionBankPage from "./pages/QuestionBankPage";
import PapersPage from "./pages/PapersPage";
import LearningPlansPage from "./pages/LearningPlansPage";
import WorkspaceSetup from "./pages/WorkspaceSetup";
import ClassManagement from "./pages/ClassManagement";

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isAuthenticated, needsWorkspaceSetup } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // Redirect to workspace setup if authenticated but no workspace
  if (needsWorkspaceSetup) return <Navigate to="/workspace-setup" replace />;
  return <>{children}</>;
};

const WorkspaceRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // Accessible even without workspace (that's the point of this page)
  return <>{children}</>;
};

const DashboardRouter: React.FC = () => {
  const { role } = useAuth();
  if (role === "teacher" || role === "admin") return <TeacherDashboard />;
  return <StudentDashboard />;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/workspace-setup"
              element={
                <WorkspaceRoute>
                  <WorkspaceSetup />
                </WorkspaceRoute>
              }
            />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <DashboardRouter />
                </ProtectedRoute>
              }
            />
            <Route
              path="/exams"
              element={
                <ProtectedRoute>
                  <ExamList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/exam/:sessionId"
              element={
                <ProtectedRoute>
                  <ExamTake />
                </ProtectedRoute>
              }
            />
            <Route
              path="/results/:sessionId"
              element={
                <ProtectedRoute>
                  <ExamResults />
                </ProtectedRoute>
              }
            />
            <Route
              path="/questions"
              element={
                <ProtectedRoute>
                  <QuestionBankPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/papers"
              element={
                <ProtectedRoute>
                  <PapersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/learning"
              element={
                <ProtectedRoute>
                  <LearningPlansPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/classes"
              element={
                <ProtectedRoute>
                  <ClassManagement />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
