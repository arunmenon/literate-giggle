import React from "react";
import type { ImpactAnalysis as ImpactAnalysisType } from "../types";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from "./ui";
import { cn } from "../lib/utils";
import {
  AlertTriangle,
  CheckCircle,
  FileText,
  GraduationCap,
  Layers,
  ShieldAlert,
  Users,
} from "lucide-react";

// ── Change type display config ──

const CHANGE_CONFIG: Record<
  ImpactAnalysisType["change_type"],
  {
    label: string;
    variant: "success" | "warning" | "destructive" | "info" | "secondary";
  }
> = {
  safe_rename: { label: "Safe Rename", variant: "success" },
  safe_add: { label: "Safe Add", variant: "success" },
  cosmetic: { label: "Cosmetic", variant: "secondary" },
  targets_change: { label: "Targets Change", variant: "warning" },
  breaking_modify: { label: "Breaking Modification", variant: "destructive" },
  breaking_delete: { label: "Breaking Delete", variant: "destructive" },
};

// ── Props ──

export interface ImpactAnalysisProps {
  impact: ImpactAnalysisType;
  loading?: boolean;
  onProceed: () => void;
  onDeprecate?: () => void;
  onCancel: () => void;
}

// ── Component ──

const ImpactAnalysis: React.FC<ImpactAnalysisProps> = ({
  impact,
  loading,
  onProceed,
  onDeprecate,
  onCancel,
}) => {
  const config = CHANGE_CONFIG[impact.change_type];
  const isBreaking =
    impact.change_type === "breaking_delete" ||
    impact.change_type === "breaking_modify";
  const isSafe =
    impact.change_type === "safe_rename" ||
    impact.change_type === "safe_add" ||
    impact.change_type === "cosmetic";

  return (
    <div className="space-y-4">
      {/* Header with change type badge */}
      <div className="flex items-center gap-2">
        {isBreaking ? (
          <ShieldAlert className="h-5 w-5 text-destructive" />
        ) : (
          <CheckCircle className="h-5 w-5 text-emerald-500" />
        )}
        <span className="text-sm font-medium">Impact Analysis</span>
        <Badge variant={config.variant} className="ml-auto">
          {config.label}
        </Badge>
      </div>

      {/* Affected counts */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ImpactStat
          icon={<FileText className="h-4 w-4" />}
          label="Questions"
          count={impact.affected_questions}
          isBreaking={isBreaking}
        />
        <ImpactStat
          icon={<Layers className="h-4 w-4" />}
          label="Papers"
          count={impact.affected_papers}
          isBreaking={isBreaking}
        />
        <ImpactStat
          icon={<GraduationCap className="h-4 w-4" />}
          label="Mastery Records"
          count={impact.affected_mastery_records}
          isBreaking={isBreaking}
        />
        <ImpactStat
          icon={<Users className="h-4 w-4" />}
          label="Workspaces"
          count={impact.affected_workspaces}
          isBreaking={isBreaking}
        />
      </div>

      {/* Recommendation */}
      {impact.recommendation && (
        <div
          className={cn(
            "rounded-lg border px-3 py-2 text-sm",
            isBreaking
              ? "border-destructive/30 bg-destructive/5 text-destructive"
              : "border-border bg-muted/50 text-muted-foreground",
          )}
        >
          {impact.recommendation}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>

        {isBreaking && onDeprecate && (
          <Button
            variant="outline"
            size="sm"
            onClick={onDeprecate}
            disabled={loading}
          >
            <AlertTriangle className="mr-1 h-3 w-3" />
            Deprecate Instead
          </Button>
        )}

        <Button
          variant={isBreaking ? "destructive" : "default"}
          size="sm"
          onClick={onProceed}
          disabled={loading}
        >
          {loading
            ? "Applying..."
            : isSafe
              ? "Apply Change"
              : "Delete & Accept Impact"}
        </Button>
      </div>
    </div>
  );
};

// ── Stat card ──

function ImpactStat({
  icon,
  label,
  count,
  isBreaking,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  isBreaking: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-lg border px-2 py-2.5 text-center",
        isBreaking && count > 0
          ? "border-destructive/30 bg-destructive/5"
          : "border-border bg-muted/30",
      )}
    >
      <div
        className={cn(
          "mb-1",
          isBreaking && count > 0
            ? "text-destructive"
            : "text-muted-foreground",
        )}
      >
        {icon}
      </div>
      <span
        className={cn(
          "text-lg font-semibold tabular-nums",
          isBreaking && count > 0 ? "text-destructive" : "",
        )}
      >
        {count}
      </span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

export { ImpactAnalysis };
