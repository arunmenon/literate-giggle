import React, { useState, useEffect, useRef } from "react";
import { workspaceAPI } from "../services/api";
import { useAuth } from "../store/AuthContext";
import type { WorkspaceSummary } from "../types";
import { cn } from "../lib/utils";
import { ChevronDown, Check, Users } from "lucide-react";

interface TeacherSwitcherProps {
  onSwitch?: () => void;
}

const TeacherSwitcher: React.FC<TeacherSwitcherProps> = ({ onSwitch }) => {
  const { role, workspaceId, switchWorkspace } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isStudent = role === "student";

  useEffect(() => {
    if (!isStudent) return;
    workspaceAPI
      .getMine()
      .then((res) => setWorkspaces(res.data || []))
      .catch(() => setWorkspaces([]))
      .finally(() => setLoading(false));
  }, [workspaceId]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  // Guard after all hooks (React rules of hooks compliance)
  if (!isStudent) return null;

  const activeWorkspace = workspaces.find((w) => w.id === workspaceId);

  async function handleSwitch(targetId: number) {
    if (targetId === workspaceId || switching) return;
    setSwitching(targetId);
    try {
      await switchWorkspace(targetId);
      setOpen(false);
      onSwitch?.();
    } catch {
      // switchWorkspace handles token refresh internally
    } finally {
      setSwitching(null);
    }
  }

  if (loading) {
    return (
      <div className="px-4 py-3 border-b border-white/10">
        <p className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
          My Teachers
        </p>
        <div className="mt-1.5 h-4 w-32 rounded bg-sidebar-foreground/10 animate-pulse" />
      </div>
    );
  }

  if (workspaces.length === 0) {
    return (
      <div className="px-4 py-3 border-b border-white/10">
        <p className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
          My Teachers
        </p>
        <p className="mt-1 text-xs text-sidebar-foreground/40">
          No teachers yet
        </p>
      </div>
    );
  }

  return (
    <div ref={panelRef} className="relative border-b border-white/10">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-sidebar-accent/30"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {activeWorkspace && (
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: activeWorkspace.color }}
            aria-hidden="true"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
            My Teachers
          </p>
          <p className="text-sm font-medium truncate mt-0.5">
            {activeWorkspace?.owner_name || activeWorkspace?.name || "Select"}
          </p>
          {activeWorkspace?.primary_subject && (
            <p className="text-xs text-sidebar-foreground/50 truncate">
              {activeWorkspace.primary_subject}
              {activeWorkspace.class_count > 0 &&
                ` \u00b7 ${activeWorkspace.class_count} class${activeWorkspace.class_count !== 1 ? "es" : ""}`}
            </p>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-sidebar-foreground/40 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute left-2 right-2 top-full z-50 mt-1 rounded-lg border border-white/10 bg-sidebar shadow-xl overflow-hidden"
          role="listbox"
          aria-label="My Teachers"
        >
          {workspaces.map((ws) => {
            const isActive = ws.id === workspaceId;
            const isSwitching = switching === ws.id;
            return (
              <button
                key={ws.id}
                type="button"
                role="option"
                aria-selected={isActive}
                disabled={isSwitching}
                onClick={() => handleSwitch(ws.id)}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                  isActive
                    ? "bg-sidebar-accent/40"
                    : "hover:bg-sidebar-accent/20",
                  isSwitching && "opacity-60",
                )}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: ws.color }}
                  aria-hidden="true"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {ws.owner_name || ws.name}
                  </p>
                  <p className="text-xs text-sidebar-foreground/50 truncate">
                    {ws.primary_subject || ws.name}
                    {ws.class_count > 0 &&
                      ` \u00b7 ${ws.class_count} class${ws.class_count !== 1 ? "es" : ""}`}
                  </p>
                </div>
                {isActive && (
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                )}
                {isSwitching && (
                  <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TeacherSwitcher;
