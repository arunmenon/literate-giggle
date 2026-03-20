import React, { useEffect, useState, useCallback } from "react";
import { learningAPI } from "../services/api";
import type { LearningPlan, LearningObjective, TopicMastery } from "../types";
import { useAuth } from "../store/AuthContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  StatCard,
  DataCard,
  MasteryBadge,
  Progress,
  Input,
  Select,
  Skeleton,
  useToast,
} from "../components/ui";
import { MasteryHeatmap } from "../components/charts/MasteryHeatmap";
import { ProgressChart } from "../components/charts/ProgressChart";
import { AIChat } from "../components/AIChat";
import { VoiceTutor } from "../components/VoiceTutor";
import { useConsentStatus } from "../hooks/useConsentStatus";
import { cn, getMasteryHex, formatPercentage } from "../lib/utils";
import {
  BookOpen,
  TrendingUp,
  Award,
  Target,
  Brain,
  Calendar,
  Clock,
  Zap,
  ChevronRight,
  ChevronDown,
  Plus,
  Play,
  RefreshCw,
  Sparkles,
  CheckCircle,
  GraduationCap,
  Mic,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                    */
/* ------------------------------------------------------------------ */

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Skeleton key={idx} className="h-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-lg" />
      <Skeleton className="h-80 rounded-lg" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Objective status helpers                                            */
/* ------------------------------------------------------------------ */

const OBJECTIVE_STATUS_CONFIG: Record<
  string,
  {
    label: string;
    variant:
      | "default"
      | "secondary"
      | "success"
      | "warning"
      | "info"
      | "outline";
  }
> = {
  not_started: { label: "Not Started", variant: "secondary" },
  in_progress: { label: "In Progress", variant: "warning" },
  completed: { label: "Completed", variant: "success" },
};

/* ------------------------------------------------------------------ */
/*  Main component                                                      */
/* ------------------------------------------------------------------ */

const LearningPlansPage: React.FC = () => {
  const { userId } = useAuth();
  const [plans, setPlans] = useState<LearningPlan[]>([]);
  const [mastery, setMastery] = useState<TopicMastery[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerate, setShowGenerate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [expandedPlanId, setExpandedPlanId] = useState<number | null>(null);
  const [showAIChat, setShowAIChat] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const { isVoiceEnabled } = useConsentStatus();
  const { toast, ToastContainer } = useToast();
  const [genForm, setGenForm] = useState({
    subject: "Mathematics",
    board: "CBSE",
    class_grade: 10,
    target_score: 90,
  });

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([
      learningAPI.listPlans().catch(() => ({ data: [] })),
      learningAPI.getMastery().catch(() => ({ data: [] })),
    ]).then(([plansRes, masteryRes]) => {
      setPlans(plansRes.data || []);
      setMastery(masteryRes.data || []);
      setLoading(false);
      // Auto-expand the first active plan
      const activePlan = (plansRes.data || []).find(
        (plan: LearningPlan) => plan.is_active,
      );
      if (activePlan) setExpandedPlanId(activePlan.id);
    });
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const generatePlan = async (event: React.FormEvent) => {
    event.preventDefault();
    setGenerating(true);
    try {
      const { data } = await learningAPI.generatePlan({
        student_id: userId,
        ...genForm,
      });
      setPlans([data, ...plans]);
      setShowGenerate(false);
      setExpandedPlanId(data.id);
    } catch (err: any) {
      toast(err.response?.data?.detail || "Failed to generate plan", "error");
    } finally {
      setGenerating(false);
    }
  };

  const updateObjective = async (objectiveId: number, status: string) => {
    try {
      await learningAPI.updateObjective(objectiveId, { status });
      const { data } = await learningAPI.listPlans();
      setPlans(data);
    } catch {
      toast("Failed to update objective", "error");
    }
  };

  const handleAIChatMessage = async (message: string): Promise<string> => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message, context: "learning_plan" }),
      });

      if (!response.ok) {
        throw new Error("Chat request failed");
      }

      // Handle SSE streaming - collect full response
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        // Parse SSE data lines
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const eventData = line.slice(6);
            if (eventData === "[DONE]") break;
            try {
              const parsed = JSON.parse(eventData);
              fullResponse += parsed.content || parsed.text || eventData;
            } catch {
              fullResponse += eventData;
            }
          }
        }
      }

      return (
        fullResponse ||
        "I can help you with your learning plan. What would you like to know?"
      );
    } catch {
      return "I'm here to help with your studies. Could you try asking your question again?";
    }
  };

  if (loading) return <PageSkeleton />;

  /* ---- Derived data ---- */

  const activePlans = plans.filter((plan) => plan.is_active);
  const completedPlans = plans.filter((plan) => !plan.is_active);

  const totalObjectives = plans.reduce(
    (sum, plan) => sum + plan.objectives.length,
    0,
  );
  const completedObjectives = plans.reduce(
    (sum, plan) =>
      sum + plan.objectives.filter((obj) => obj.status === "completed").length,
    0,
  );

  const overallProgress =
    totalObjectives > 0
      ? Math.round((completedObjectives / totalObjectives) * 100)
      : 0;

  const masteryHeatmapData = mastery.map((topicMastery) => ({
    topic: topicMastery.topic,
    masteryLevel: topicMastery.mastery_level,
    score: topicMastery.avg_score_pct,
  }));

  // Build score history from mastery data for chart
  const masteryChartData = mastery
    .filter((topicMastery) => topicMastery.avg_score_pct > 0)
    .slice(0, 10)
    .map((topicMastery) => ({
      label:
        topicMastery.topic.length > 10
          ? topicMastery.topic.slice(0, 10) + "..."
          : topicMastery.topic,
      score: topicMastery.avg_score_pct,
    }));

  const boardOptions = [
    { value: "CBSE", label: "CBSE" },
    { value: "ICSE", label: "ICSE" },
    { value: "State Board", label: "State Board" },
  ];

  const classOptions = [7, 8, 9, 10, 11, 12].map((classNum) => ({
    value: String(classNum),
    label: `Class ${classNum}`,
  }));

  return (
    <div className="space-y-6">
      <ToastContainer />
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display tracking-tight">
            Learning Plans
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            AI-powered personalized study roadmaps
          </p>
        </div>
        <div className="flex gap-3">
          {isVoiceEnabled && showAIChat && (
            <Button
              variant={voiceMode ? "default" : "outline"}
              className="gap-2"
              onClick={() => setVoiceMode(!voiceMode)}
            >
              <Mic className="h-4 w-4" />
              {voiceMode ? "Voice On" : "Voice"}
            </Button>
          )}
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              setShowAIChat(!showAIChat);
              if (showAIChat) setVoiceMode(false);
            }}
          >
            <Brain className="h-4 w-4" />
            AI Tutor
          </Button>
          <Button
            className="gap-2"
            onClick={() => setShowGenerate(!showGenerate)}
          >
            <Plus className="h-4 w-4" />
            Generate Plan
          </Button>
        </div>
      </div>

      {/* ── Stats Overview ── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          title="Active Plans"
          value={activePlans.length}
          icon={<Target className="h-5 w-5" />}
          subtitle="In progress"
        />
        <StatCard
          title="Overall Progress"
          value={formatPercentage(overallProgress)}
          icon={<TrendingUp className="h-5 w-5" />}
          subtitle={`${completedObjectives}/${totalObjectives} objectives`}
        />
        <StatCard
          title="Topics Tracked"
          value={mastery.length}
          icon={<BookOpen className="h-5 w-5" />}
          subtitle="With mastery data"
        />
        <StatCard
          title="Mastered Topics"
          value={
            mastery.filter(
              (topicMastery) => topicMastery.mastery_level === "mastered",
            ).length
          }
          icon={<Award className="h-5 w-5" />}
          subtitle="Fully mastered"
        />
      </div>

      {/* ── Generate Plan Form ── */}
      {showGenerate && (
        <Card className="overflow-hidden animate-fade-in">
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 border-b">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">
                Generate Personalized Learning Plan
              </h3>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              AI will analyze your performance and create a tailored study
              roadmap.
            </p>
          </div>
          <CardContent className="pt-4">
            <form onSubmit={generatePlan} className="space-y-4">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Subject</label>
                  <Input
                    value={genForm.subject}
                    onChange={(event) =>
                      setGenForm({ ...genForm, subject: event.target.value })
                    }
                    placeholder="e.g., Mathematics"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Board</label>
                  <Select
                    options={boardOptions}
                    value={genForm.board}
                    onChange={(event) =>
                      setGenForm({ ...genForm, board: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Class</label>
                  <Select
                    options={classOptions}
                    value={String(genForm.class_grade)}
                    onChange={(event) =>
                      setGenForm({
                        ...genForm,
                        class_grade: Number(event.target.value),
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Target Score</label>
                  <Input
                    type="number"
                    min={50}
                    max={100}
                    value={genForm.target_score}
                    onChange={(event) =>
                      setGenForm({
                        ...genForm,
                        target_score: Number(event.target.value),
                      })
                    }
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <Button type="submit" disabled={generating} className="gap-2">
                  {generating ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {generating ? "Generating..." : "Generate Plan"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowGenerate(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── Main Content Grid (plans + optional AI chat) ── */}
      <div
        className={cn(
          "grid gap-6",
          showAIChat ? "lg:grid-cols-3" : "grid-cols-1",
        )}
      >
        {/* ── Plans Column ── */}
        <div className={cn("space-y-6", showAIChat ? "lg:col-span-2" : "")}>
          {/* Topic Mastery Heatmap */}
          {mastery.length > 0 && (
            <DataCard
              title="Topic Mastery Overview"
              description="Your mastery level across all tracked topics"
              icon={<Award className="h-4 w-4" />}
            >
              <MasteryHeatmap
                data={masteryHeatmapData}
                columns={Math.min(mastery.length, 4)}
              />
            </DataCard>
          )}

          {/* Mastery Score Chart */}
          {masteryChartData.length > 0 && (
            <DataCard
              title="Topic Score Distribution"
              description="Average scores across topics"
              icon={<TrendingUp className="h-4 w-4" />}
            >
              <ProgressChart data={masteryChartData} height={200} />
            </DataCard>
          )}

          {/* Active Learning Plans */}
          {activePlans.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold font-display flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Active Plans
              </h2>
              {activePlans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  isExpanded={expandedPlanId === plan.id}
                  onToggle={() =>
                    setExpandedPlanId(
                      expandedPlanId === plan.id ? null : plan.id,
                    )
                  }
                  onUpdateObjective={updateObjective}
                />
              ))}
            </div>
          )}

          {/* Completed Plans */}
          {completedPlans.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold font-display flex items-center gap-2 text-muted-foreground">
                <CheckCircle className="h-5 w-5" />
                Completed Plans
              </h2>
              {completedPlans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  isExpanded={expandedPlanId === plan.id}
                  onToggle={() =>
                    setExpandedPlanId(
                      expandedPlanId === plan.id ? null : plan.id,
                    )
                  }
                  onUpdateObjective={updateObjective}
                />
              ))}
            </div>
          )}

          {/* Empty State */}
          {plans.length === 0 && (
            <Card className="p-8 text-center">
              <GraduationCap className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                No Learning Plans Yet
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Take some exams, then generate a personalized learning plan to
                improve your scores.
              </p>
              <Button onClick={() => setShowGenerate(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Create Your First Plan
              </Button>
            </Card>
          )}
        </div>

        {/* ── AI Chat / Voice Tutor Panel ── */}
        {showAIChat && (
          <div className="lg:col-span-1 lg:sticky lg:top-4 lg:self-start">
            {voiceMode && isVoiceEnabled ? (
              <VoiceTutor
                topic={genForm.subject}
                onClose={() => setVoiceMode(false)}
              />
            ) : (
              <AIChat
                onSendMessage={handleAIChatMessage}
                title="AI Study Tutor"
                placeholder="Ask about study tips, topic explanations..."
                isPanel
                className="h-[600px]"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Plan Card sub-component                                             */
/* ------------------------------------------------------------------ */

interface PlanCardProps {
  plan: LearningPlan;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdateObjective: (objectiveId: number, status: string) => Promise<void>;
}

const PlanCard: React.FC<PlanCardProps> = ({
  plan,
  isExpanded,
  onToggle,
  onUpdateObjective,
}) => {
  const completedCount = plan.objectives.filter(
    (obj) => obj.status === "completed",
  ).length;
  const inProgressCount = plan.objectives.filter(
    (obj) => obj.status === "in_progress",
  ).length;
  const sortedObjectives = [...plan.objectives].sort(
    (a, b) => a.priority - b.priority,
  );

  return (
    <Card className="overflow-hidden transition-all duration-200">
      {/* Plan header - clickable */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left p-5 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-base truncate">{plan.title}</h3>
              {plan.is_active ? (
                <Badge variant="success">Active</Badge>
              ) : (
                <Badge variant="secondary">Completed</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {plan.subject} &middot; {plan.board} &middot; Class{" "}
              {plan.class_grade}
              {plan.estimated_hours && (
                <span className="inline-flex items-center gap-1 ml-2">
                  <Clock className="h-3 w-3" />~{plan.estimated_hours}h
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Progress ring */}
            <div className="text-right">
              <span className="text-2xl font-bold font-display text-primary">
                {plan.progress_pct}%
              </span>
              <p className="text-[10px] text-muted-foreground">
                {completedCount}/{plan.objectives.length} done
              </p>
            </div>
            <ChevronDown
              className={cn(
                "h-5 w-5 text-muted-foreground transition-transform duration-200",
                isExpanded && "rotate-180",
              )}
            />
          </div>
        </div>

        {/* Progress bar */}
        <Progress value={plan.progress_pct} className="mt-3 h-2" />

        {/* Status summary pills */}
        <div className="flex gap-3 mt-3 text-xs text-muted-foreground">
          {completedCount > 0 && (
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-mastery-mastered" />
              {completedCount} completed
            </span>
          )}
          {inProgressCount > 0 && (
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-mastery-developing" />
              {inProgressCount} in progress
            </span>
          )}
          {plan.objectives.length - completedCount - inProgressCount > 0 && (
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
              {plan.objectives.length - completedCount - inProgressCount}{" "}
              remaining
            </span>
          )}
        </div>
      </button>

      {/* Expandable objectives list */}
      {isExpanded && (
        <div className="border-t">
          {plan.description && (
            <div className="px-5 py-3 bg-muted/20 text-sm text-muted-foreground border-b">
              {plan.description}
            </div>
          )}

          {/* Focus areas */}
          {plan.focus_areas && plan.focus_areas.length > 0 && (
            <div className="px-5 py-3 border-b flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-muted-foreground">
                Focus:
              </span>
              {plan.focus_areas.map((area) => (
                <Badge key={area} variant="outline" className="text-xs">
                  {area}
                </Badge>
              ))}
            </div>
          )}

          {/* Learning journey - objectives as connected steps */}
          <div className="p-5 space-y-1">
            {sortedObjectives.map((objective, objectiveIndex) => (
              <ObjectiveItem
                key={objective.id}
                objective={objective}
                isLast={objectiveIndex === sortedObjectives.length - 1}
                onUpdate={onUpdateObjective}
              />
            ))}
          </div>

          {/* Plan meta */}
          <div className="px-5 py-3 bg-muted/10 border-t flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex gap-4">
              {plan.target_score && <span>Target: {plan.target_score}%</span>}
              {plan.current_score !== undefined &&
                plan.current_score !== null && (
                  <span>Current: {plan.current_score}%</span>
                )}
              {plan.start_date && (
                <span>
                  Started: {new Date(plan.start_date).toLocaleDateString()}
                </span>
              )}
            </div>
            {plan.target_date && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Target: {new Date(plan.target_date).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};

/* ------------------------------------------------------------------ */
/*  Objective Item sub-component                                        */
/* ------------------------------------------------------------------ */

interface ObjectiveItemProps {
  objective: LearningObjective;
  isLast: boolean;
  onUpdate: (objectiveId: number, status: string) => Promise<void>;
}

const ObjectiveItem: React.FC<ObjectiveItemProps> = ({
  objective,
  isLast,
  onUpdate,
}) => {
  const statusConfig =
    OBJECTIVE_STATUS_CONFIG[objective.status] ||
    OBJECTIVE_STATUS_CONFIG.not_started;
  const isCompleted = objective.status === "completed";
  const isInProgress = objective.status === "in_progress";

  return (
    <div className="flex gap-3">
      {/* Timeline connector */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors",
            isCompleted && "bg-mastery-mastered text-white",
            isInProgress && "bg-mastery-developing text-white",
            !isCompleted && !isInProgress && "bg-muted text-muted-foreground",
          )}
        >
          {isCompleted ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            objective.priority
          )}
        </div>
        {!isLast && (
          <div
            className={cn(
              "w-0.5 flex-1 min-h-[24px]",
              isCompleted ? "bg-mastery-mastered/40" : "bg-border",
            )}
          />
        )}
      </div>

      {/* Content */}
      <div className={cn("flex-1 pb-4", isLast && "pb-0")}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  "text-sm font-semibold",
                  isCompleted && "line-through text-muted-foreground",
                )}
              >
                {objective.topic}
              </span>
              <MasteryBadge level={objective.current_mastery} size="sm" />
              <Badge variant={statusConfig.variant} className="text-[10px]">
                {statusConfig.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {objective.description}
            </p>

            {/* Resources */}
            {objective.resources && objective.resources.length > 0 && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {objective.resources.map((resource, resourceIndex) => (
                  <span
                    key={resourceIndex}
                    className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                  >
                    <BookOpen className="h-3 w-3" />
                    {resource.title}
                  </span>
                ))}
              </div>
            )}

            {/* Score info */}
            {objective.best_score_pct !== undefined &&
              objective.best_score_pct !== null && (
                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>Best: {Math.round(objective.best_score_pct)}%</span>
                  <span>&middot;</span>
                  <span>{objective.attempts} attempts</span>
                  <span>&middot;</span>
                  <span>
                    Target: {objective.target_mastery.replace("_", " ")}
                  </span>
                </div>
              )}
          </div>

          {/* Action buttons */}
          {!isCompleted && (
            <div className="flex gap-1.5 flex-shrink-0">
              {!isInProgress && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => onUpdate(objective.id, "in_progress")}
                >
                  <Play className="h-3 w-3" />
                  Start
                </Button>
              )}
              <Button
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => onUpdate(objective.id, "completed")}
              >
                <CheckCircle className="h-3 w-3" />
                Done
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LearningPlansPage;
