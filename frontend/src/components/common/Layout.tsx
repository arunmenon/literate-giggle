import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "../../store/AuthContext";
import { cn } from "../../lib/utils";
import { Button } from "../ui/Button";
import {
  LayoutDashboard,
  FileText,
  BookOpen,
  GraduationCap,
  ClipboardList,
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
  Brain,
  Users,
  Copy,
  Check,
  Library,
} from "lucide-react";

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

function useNavItems(
  role: string | null,
  workspaceId: number | null,
): NavItem[] {
  if (!workspaceId) return [];

  if (role === "student") {
    return [
      {
        label: "Dashboard",
        path: "/",
        icon: <LayoutDashboard className="h-5 w-5" />,
      },
      {
        label: "My Exams",
        path: "/exams",
        icon: <ClipboardList className="h-5 w-5" />,
      },
      {
        label: "Learning Plans",
        path: "/learning",
        icon: <Brain className="h-5 w-5" />,
      },
    ];
  }

  // Teacher or admin
  return [
    {
      label: "Dashboard",
      path: "/",
      icon: <LayoutDashboard className="h-5 w-5" />,
    },
    {
      label: "My Questions",
      path: "/questions",
      icon: <BookOpen className="h-5 w-5" />,
    },
    {
      label: "Curriculum",
      path: "/curriculum",
      icon: <Library className="h-5 w-5" />,
    },
    {
      label: "My Papers",
      path: "/papers",
      icon: <FileText className="h-5 w-5" />,
    },
    {
      label: "My Classes",
      path: "/classes",
      icon: <Users className="h-5 w-5" />,
    },
  ];
}

const Layout: React.FC = () => {
  const {
    isAuthenticated,
    fullName,
    role,
    logout,
    workspaceId,
    workspaceName,
    workspaceRole,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem("theme") === "dark";
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const navItems = useNavItems(role, workspaceId);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300 lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Logo + workspace name */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-white/10">
          <Link
            to="/"
            className="flex items-center gap-2 min-w-0"
            onClick={() => setSidebarOpen(false)}
          >
            <GraduationCap className="h-7 w-7 shrink-0 text-primary" />
            <span className="text-xl font-bold font-display tracking-tight truncate">
              ExamIQ
            </span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden rounded-md p-1 text-sidebar-foreground/60 hover:text-sidebar-foreground"
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Workspace indicator */}
        {workspaceName && (
          <div className="px-4 py-3 border-b border-white/10">
            <p className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
              Workspace
            </p>
            <p className="mt-0.5 text-sm font-medium truncate">
              {workspaceName}
            </p>
            {workspaceRole && (
              <p className="text-xs text-sidebar-foreground/50 capitalize">
                {workspaceRole}
              </p>
            )}
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-white"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}

          {/* Student without enrollment - join classroom CTA */}
          {role === "student" && !workspaceId && (
            <div className="mt-4 rounded-lg border border-white/10 p-3">
              <p className="text-xs text-sidebar-foreground/60 mb-2">
                Join a classroom to see your exams
              </p>
              <Link
                to="/workspace-setup"
                className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                onClick={() => setSidebarOpen(false)}
              >
                <Users className="h-4 w-4" />
                Join Classroom
              </Link>
            </div>
          )}
        </nav>

        {/* User section */}
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
              {fullName?.charAt(0)?.toUpperCase() ?? "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{fullName}</p>
              <p className="text-xs text-sidebar-foreground/60 capitalize">
                {role}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            type="button"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsDark(!isDark)}
              className="text-muted-foreground"
              aria-label="Toggle dark mode"
            >
              {isDark ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
