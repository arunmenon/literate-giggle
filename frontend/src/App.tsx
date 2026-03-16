import React, { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./store/AuthContext";
import Layout from "./components/common/Layout";
import { Skeleton } from "./components/ui";

// Lazy-loaded page components
const Login = React.lazy(() => import("./pages/Login"));
const Register = React.lazy(() => import("./pages/Register"));
const StudentDashboard = React.lazy(() => import("./pages/StudentDashboard"));
const TeacherDashboard = React.lazy(() => import("./pages/TeacherDashboard"));
const ExamList = React.lazy(() => import("./pages/ExamList"));
const ExamTake = React.lazy(() => import("./pages/ExamTake"));
const ExamResults = React.lazy(() => import("./pages/ExamResults"));
const QuestionBankPage = React.lazy(() => import("./pages/QuestionBankPage"));
const PapersPage = React.lazy(() => import("./pages/PapersPage"));
const LearningPlansPage = React.lazy(() => import("./pages/LearningPlansPage"));
const WorkspaceSetup = React.lazy(() => import("./pages/WorkspaceSetup"));
const ClassManagement = React.lazy(() => import("./pages/ClassManagement"));
const TaxonomyManager = React.lazy(() => import("./pages/TaxonomyManager"));

function PageSkeleton() {
  return (
    <div className="flex items-center justify-center h-96">
      <Skeleton className="h-8 w-48" />
    </div>
  );
}

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isAuthenticated, needsWorkspaceSetup } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (needsWorkspaceSetup) return <Navigate to="/workspace-setup" replace />;
  return <>{children}</>;
};

const WorkspaceRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
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
        <Suspense fallback={<PageSkeleton />}>
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
                path="/curriculum"
                element={
                  <ProtectedRoute>
                    <TaxonomyManager />
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
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
