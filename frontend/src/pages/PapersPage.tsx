import React, { useEffect, useState } from "react";
import { paperAPI, questionAPI } from "../services/api";
import type {
  QuestionPaper,
  Question,
  CurriculumSelection,
  PaperAssemblyResult,
} from "../types";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  Badge,
  Input,
  Textarea,
  Select,
  Skeleton,
  Progress,
} from "../components/ui";
import { CurriculumPicker } from "../components/CurriculumPicker";
import { cn } from "../lib/utils";
import {
  Plus,
  Sparkles,
  Wand2,
  FileText,
  CheckCircle,
  XCircle,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Trash2,
  RefreshCw,
  Target,
  Brain,
  Layers,
  BookOpen,
  Download,
} from "lucide-react";
import api from "../services/api";

const EXAM_TYPES = [
  { value: "Unit Test", label: "Unit Test" },
  { value: "Mid-term", label: "Mid-term" },
  { value: "Final", label: "Final" },
  { value: "Practice", label: "Practice" },
  { value: "Board Pattern", label: "Board Pattern" },
];

const STATUS_MAP: Record<
  string,
  {
    label: string;
    variant:
      | "default"
      | "secondary"
      | "outline"
      | "success"
      | "warning"
      | "destructive"
      | "info";
  }
> = {
  draft: { label: "Draft", variant: "secondary" },
  review: { label: "Review", variant: "warning" },
  published: { label: "Published", variant: "info" },
  active: { label: "Active", variant: "success" },
  completed: { label: "Completed", variant: "default" },
  archived: { label: "Archived", variant: "outline" },
};

const PapersPage: React.FC = () => {
  const [papers, setPapers] = useState<QuestionPaper[]>([]);
  const [loading, setLoading] = useState(true);

  // Manual create form
  const [showForm, setShowForm] = useState(false);
  const [availableQuestions, setAvailableQuestions] = useState<Question[]>([]);
  const [selectedQs, setSelectedQs] = useState<number[]>([]);
  const [form, setForm] = useState({
    title: "",
    board: "CBSE",
    class_grade: 10,
    subject: "",
    exam_type: "Unit Test",
    total_marks: 80,
    duration_minutes: 120,
    instructions: "",
  });

  // AI Paper Builder wizard
  const [showBuilder, setShowBuilder] = useState(false);
  const [builderStep, setBuilderStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [builderSelection, setBuilderSelection] =
    useState<CurriculumSelection | null>(null);
  const [builderForm, setBuilderForm] = useState({
    title: "",
    exam_type: "Unit Test",
    total_marks: 80,
    duration_minutes: 120,
  });
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [chapterWeights, setChapterWeights] = useState<Record<string, number>>(
    {},
  );
  const [assembling, setAssembling] = useState(false);
  const [assemblyResult, setAssemblyResult] =
    useState<PaperAssemblyResult | null>(null);
  const [assemblyProgress, setAssemblyProgress] = useState("");
  const [savingPaper, setSavingPaper] = useState(false);

  useEffect(() => {
    paperAPI.list().then((res) => {
      setPapers(res.data);
      setLoading(false);
    });
  }, []);

  const loadQuestions = () => {
    questionAPI
      .list({
        board: form.board,
        class_grade: form.class_grade,
        subject: form.subject,
      })
      .then((res) => setAvailableQuestions(res.data));
  };

  const createPaper = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      questions: selectedQs.map((qId, i) => ({
        question_id: qId,
        order: i + 1,
        section: "Section A",
      })),
    };
    const { data } = await paperAPI.create(payload);
    setPapers([data, ...papers]);
    setShowForm(false);
    setSelectedQs([]);
  };

  const updateStatus = async (paperId: number, newStatus: string) => {
    try {
      const { data } = await paperAPI.updateStatus(paperId, {
        status: newStatus,
      });
      setPapers(
        papers.map((p) =>
          p.id === paperId ? { ...p, status: data.status } : p,
        ),
      );
    } catch (err: any) {
      alert(err.response?.data?.detail || "Status update failed");
    }
  };

  const getNextStatuses = (current: string): string[] => {
    const transitions: Record<string, string[]> = {
      draft: ["review", "published"],
      review: ["draft", "published"],
      published: ["active", "draft"],
      active: ["completed"],
      completed: ["archived"],
    };
    return transitions[current] || [];
  };

  // AI Paper Builder handlers
  const openBuilder = () => {
    setShowBuilder(true);
    setShowForm(false);
    setBuilderStep(1);
    setBuilderSelection(null);
    setBuilderForm({
      title: "",
      exam_type: "Unit Test",
      total_marks: 80,
      duration_minutes: 120,
    });
    setSelectedChapters([]);
    setChapterWeights({});
    setAssemblyResult(null);
    setAssemblyProgress("");
  };

  const handleCurriculumChange = (sel: CurriculumSelection) => {
    setBuilderSelection(sel);
    // Add the chapter if not already selected
    if (sel.chapter && !selectedChapters.includes(sel.chapter)) {
      setSelectedChapters((prev) => [...prev, sel.chapter]);
      setChapterWeights((prev) => ({ ...prev, [sel.chapter]: 1 }));
    }
  };

  const removeChapter = (chapter: string) => {
    setSelectedChapters((prev) => prev.filter((c) => c !== chapter));
    setChapterWeights((prev) => {
      const next = { ...prev };
      delete next[chapter];
      return next;
    });
  };

  const handleAssemble = async () => {
    if (!builderSelection || selectedChapters.length === 0) return;
    setAssembling(true);
    setAssemblyProgress("Analyzing question bank...");

    try {
      setTimeout(
        () => setAssemblyProgress("Identifying gaps and generating..."),
        1500,
      );
      setTimeout(
        () => setAssemblyProgress("Assembling balanced paper..."),
        3000,
      );

      const { data } = await paperAPI.assembleWithAI({
        board: builderSelection.board,
        class_grade: builderSelection.class_grade,
        subject: builderSelection.subject,
        chapters: selectedChapters,
        total_marks: builderForm.total_marks,
        duration_minutes: builderForm.duration_minutes,
        exam_type: builderForm.exam_type,
      });
      setAssemblyResult(data);
      setAssemblyProgress("");
      setBuilderStep(4);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to assemble paper with AI");
      setAssemblyProgress("");
    } finally {
      setAssembling(false);
    }
  };

  const moveQuestion = (idx: number, direction: "up" | "down") => {
    if (!assemblyResult) return;
    const questions = [...assemblyResult.questions];
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= questions.length) return;
    [questions[idx], questions[swapIdx]] = [questions[swapIdx], questions[idx]];
    // Re-number
    questions.forEach((q, i) => (q.order = i + 1));
    setAssemblyResult({ ...assemblyResult, questions });
  };

  const removeAssemblyQuestion = (idx: number) => {
    if (!assemblyResult) return;
    const questions = assemblyResult.questions.filter((_, i) => i !== idx);
    questions.forEach((q, i) => (q.order = i + 1));
    setAssemblyResult({ ...assemblyResult, questions });
  };

  const savePaperDraft = async () => {
    if (!assemblyResult || !builderSelection) return;
    setSavingPaper(true);
    try {
      const payload = {
        title:
          builderForm.title ||
          assemblyResult.paper.title ||
          `${builderSelection.subject} - ${builderForm.exam_type}`,
        board: builderSelection.board,
        class_grade: builderSelection.class_grade,
        subject: builderSelection.subject,
        exam_type: builderForm.exam_type,
        total_marks: builderForm.total_marks,
        duration_minutes: builderForm.duration_minutes,
        instructions: assemblyResult.paper.instructions,
        questions: assemblyResult.questions.map((q) => ({
          question_id: q.question?.id,
          order: q.order,
          section: q.section,
          // For AI-generated questions that don't have IDs, include full data
          ...(q.question?.id
            ? {}
            : {
                question_type: q.question?.question_type,
                question_text: q.question?.question_text,
                marks: q.question?.marks,
                difficulty: q.question?.difficulty,
                topic: q.question?.topic,
                model_answer: q.question?.model_answer,
              }),
        })),
      };
      const { data } = await paperAPI.create(payload);
      setPapers([data, ...papers]);
      setShowBuilder(false);
      setBuilderStep(1);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to save paper");
    } finally {
      setSavingPaper(false);
    }
  };

  const exportPDF = async (paperId: number, title: string) => {
    try {
      const response = await api.get(`/papers/${paperId}/export/pdf`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to export PDF");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display tracking-tight">
            Question Papers
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage exam papers manually or with AI assistance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setShowForm(!showForm);
              setShowBuilder(false);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Manual Create
          </Button>
          <Button onClick={openBuilder}>
            <Sparkles className="h-4 w-4 mr-2" />
            Create with AI
          </Button>
        </div>
      </div>

      {/* Manual Create Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Create Question Paper</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createPaper} className="space-y-4">
              <Input
                placeholder="Paper Title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Select
                  value={form.board}
                  onChange={(e) => setForm({ ...form, board: e.target.value })}
                  options={[
                    { value: "CBSE", label: "CBSE" },
                    { value: "ICSE", label: "ICSE" },
                    { value: "State Board", label: "State Board" },
                  ]}
                />
                <Select
                  value={String(form.class_grade)}
                  onChange={(e) =>
                    setForm({ ...form, class_grade: Number(e.target.value) })
                  }
                  options={[7, 8, 9, 10, 11, 12].map((c) => ({
                    value: String(c),
                    label: `Class ${c}`,
                  }))}
                />
                <Input
                  placeholder="Subject"
                  value={form.subject}
                  onChange={(e) =>
                    setForm({ ...form, subject: e.target.value })
                  }
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Select
                  value={form.exam_type}
                  onChange={(e) =>
                    setForm({ ...form, exam_type: e.target.value })
                  }
                  options={EXAM_TYPES}
                />
                <Input
                  type="number"
                  placeholder="Total Marks"
                  value={form.total_marks}
                  onChange={(e) =>
                    setForm({ ...form, total_marks: Number(e.target.value) })
                  }
                />
                <Input
                  type="number"
                  placeholder="Duration (min)"
                  value={form.duration_minutes}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      duration_minutes: Number(e.target.value),
                    })
                  }
                />
              </div>
              <Textarea
                placeholder="Instructions (optional)"
                value={form.instructions}
                onChange={(e) =>
                  setForm({ ...form, instructions: e.target.value })
                }
                className="min-h-[60px]"
              />
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={loadQuestions}
                >
                  Load Questions for {form.subject || "..."}
                </Button>
                {availableQuestions.length > 0 && (
                  <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-1">
                    {availableQuestions.map((q) => (
                      <label
                        key={q.id}
                        className="flex items-start gap-2 text-sm p-1.5 rounded hover:bg-accent cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedQs.includes(q.id)}
                          onChange={(e) => {
                            if (e.target.checked)
                              setSelectedQs([...selectedQs, q.id]);
                            else
                              setSelectedQs(
                                selectedQs.filter((id) => id !== q.id),
                              );
                          }}
                          className="mt-0.5"
                        />
                        <span className="flex-1">
                          <Badge variant="outline" className="text-xs mr-1">
                            {q.question_type}
                          </Badge>
                          {q.question_text.slice(0, 80)}...
                          <span className="text-muted-foreground ml-1">
                            ({q.marks}m)
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {selectedQs.length} questions selected
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="submit">Create Paper</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* AI Paper Builder Wizard */}
      {showBuilder && (
        <Card className="border-primary/20 bg-primary/[0.02]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Wand2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">AI Paper Builder</CardTitle>
                  <CardDescription>
                    Assemble a balanced exam paper from your question bank with
                    AI gap-filling
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Step indicators */}
                <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                  {(
                    [
                      { step: 1, label: "Setup" },
                      { step: 2, label: "Chapters" },
                      { step: 3, label: "Assemble" },
                      { step: 4, label: "Review" },
                      { step: 5, label: "Save" },
                    ] as const
                  ).map((s, i) => (
                    <React.Fragment key={s.step}>
                      {i > 0 && (
                        <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                      )}
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded",
                          builderStep === s.step
                            ? "text-primary font-medium bg-primary/10"
                            : builderStep > s.step
                              ? "text-green-600 dark:text-green-400"
                              : "",
                        )}
                      >
                        {s.label}
                      </span>
                    </React.Fragment>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowBuilder(false)}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Step 1: Paper Setup */}
            {builderStep === 1 && (
              <div className="space-y-4">
                <Input
                  placeholder="Paper Title (optional -- AI will suggest one)"
                  value={builderForm.title}
                  onChange={(e) =>
                    setBuilderForm({ ...builderForm, title: e.target.value })
                  }
                />
                <CurriculumPicker onSelectionChange={handleCurriculumChange} />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Exam Type
                    </label>
                    <Select
                      value={builderForm.exam_type}
                      onChange={(e) =>
                        setBuilderForm({
                          ...builderForm,
                          exam_type: e.target.value,
                        })
                      }
                      options={EXAM_TYPES}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Total Marks
                    </label>
                    <Input
                      type="number"
                      value={builderForm.total_marks}
                      onChange={(e) =>
                        setBuilderForm({
                          ...builderForm,
                          total_marks: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Duration (minutes)
                    </label>
                    <Input
                      type="number"
                      value={builderForm.duration_minutes}
                      onChange={(e) =>
                        setBuilderForm({
                          ...builderForm,
                          duration_minutes: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
                <Button
                  onClick={() => setBuilderStep(2)}
                  disabled={!builderSelection}
                >
                  Next: Select Chapters
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}

            {/* Step 2: Chapter Selection */}
            {builderStep === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Add chapters to include
                    </span>
                  </div>
                  <CurriculumPicker
                    onSelectionChange={(sel) => {
                      if (
                        sel.chapter &&
                        !selectedChapters.includes(sel.chapter)
                      ) {
                        setSelectedChapters((prev) => [...prev, sel.chapter]);
                        setChapterWeights((prev) => ({
                          ...prev,
                          [sel.chapter]: 1,
                        }));
                      }
                    }}
                    defaultBoard={builderSelection?.board}
                    defaultClass={builderSelection?.class_grade}
                  />
                </div>

                {/* Selected Chapters List */}
                {selectedChapters.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Selected Chapters ({selectedChapters.length})
                    </span>
                    <div className="space-y-2">
                      {selectedChapters.map((chapter) => (
                        <div
                          key={chapter}
                          className="flex items-center gap-3 rounded-lg border p-3"
                        >
                          <BookOpen className="h-4 w-4 text-primary flex-shrink-0" />
                          <span className="flex-1 text-sm font-medium">
                            {chapter}
                          </span>
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-muted-foreground">
                              Weight:
                            </label>
                            <Input
                              type="number"
                              value={chapterWeights[chapter] || 1}
                              onChange={(e) =>
                                setChapterWeights((prev) => ({
                                  ...prev,
                                  [chapter]: Number(e.target.value),
                                }))
                              }
                              min={1}
                              max={5}
                              className="w-16 text-sm"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeChapter(chapter)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setBuilderStep(1)}>
                    Back
                  </Button>
                  <Button
                    onClick={() => {
                      setBuilderStep(3);
                      handleAssemble();
                    }}
                    disabled={selectedChapters.length === 0 || assembling}
                  >
                    {assembling ? (
                      <>
                        <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                        Assembling...
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4 mr-2" />
                        Assemble Paper
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Assembly Progress */}
            {builderStep === 3 && assembling && (
              <div className="flex flex-col items-center gap-4 py-12">
                <Sparkles className="h-8 w-8 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">
                  {assemblyProgress || "Assembling paper..."}
                </p>
                <Progress value={45} className="w-48" />
              </div>
            )}

            {/* Step 4: Paper Review */}
            {builderStep === 4 && assemblyResult && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Paper Preview (2/3 width) */}
                  <div className="lg:col-span-2 space-y-4">
                    {/* Paper Header */}
                    <div className="rounded-lg border p-4 space-y-2 bg-background">
                      <h3 className="text-lg font-semibold">
                        {builderForm.title ||
                          assemblyResult.paper.title ||
                          "Exam Paper"}
                      </h3>
                      <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                        <Badge variant="outline">
                          {builderSelection?.board}
                        </Badge>
                        <Badge variant="outline">
                          Class {builderSelection?.class_grade}
                        </Badge>
                        <Badge variant="outline">
                          {builderSelection?.subject}
                        </Badge>
                        <Badge variant="secondary">
                          {builderForm.total_marks} marks
                        </Badge>
                        <Badge variant="secondary">
                          {builderForm.duration_minutes} min
                        </Badge>
                      </div>
                      {assemblyResult.paper.instructions && (
                        <p className="text-xs text-muted-foreground italic">
                          {assemblyResult.paper.instructions}
                        </p>
                      )}
                    </div>

                    {/* Questions List */}
                    <div className="space-y-2">
                      {assemblyResult.questions.map((item, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border p-3 flex items-start gap-3"
                        >
                          <span className="text-sm font-bold text-muted-foreground mt-0.5 w-6 flex-shrink-0">
                            {item.order}.
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                {item.question?.question_type?.replace(
                                  "_",
                                  " ",
                                ) || "question"}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {item.question?.marks || "?"} marks
                              </Badge>
                              {item.question?.topic && (
                                <Badge variant="outline" className="text-xs">
                                  {item.question.topic}
                                </Badge>
                              )}
                              <Badge
                                variant={
                                  item.source === "bank"
                                    ? "secondary"
                                    : "default"
                                }
                                className="text-xs"
                              >
                                {item.source === "bank" ? (
                                  <>
                                    <BookOpen className="h-3 w-3 mr-1" />
                                    From Bank
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="h-3 w-3 mr-1" />
                                    AI Generated
                                  </>
                                )}
                              </Badge>
                              {item.section && (
                                <span className="text-xs text-muted-foreground ml-auto">
                                  {item.section}
                                </span>
                              )}
                            </div>
                            <p className="text-sm">
                              {item.question?.question_text || "Question text"}
                            </p>
                          </div>
                          <div className="flex flex-col gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => moveQuestion(idx, "up")}
                              disabled={idx === 0}
                              className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveQuestion(idx, "down")}
                              disabled={
                                idx === assemblyResult.questions.length - 1
                              }
                              className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeAssemblyQuestion(idx)}
                              className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {assemblyResult.gaps_filled > 0 && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-primary" />
                        {assemblyResult.gaps_filled} new questions were
                        AI-generated to fill gaps
                      </p>
                    )}
                  </div>

                  {/* Coverage Analysis Sidebar (1/3 width) */}
                  <div className="space-y-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-1.5">
                          <Target className="h-4 w-4" />
                          Coverage Analysis
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Topic Coverage */}
                        {assemblyResult.coverage_analysis.topic_coverage && (
                          <div className="space-y-2">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              Topic Coverage
                            </span>
                            <div className="space-y-1.5">
                              {Object.entries(
                                assemblyResult.coverage_analysis.topic_coverage,
                              ).map(([topic, pct]) => (
                                <div key={topic} className="space-y-0.5">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="truncate max-w-[120px]">
                                      {topic}
                                    </span>
                                    <span className="font-medium">
                                      {Math.round(pct)}%
                                    </span>
                                  </div>
                                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-primary rounded-full"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Bloom's Distribution */}
                        {assemblyResult.coverage_analysis
                          .blooms_distribution && (
                          <div className="space-y-2">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                              <Brain className="h-3 w-3" />
                              Bloom's Taxonomy
                            </span>
                            <div className="space-y-1">
                              {Object.entries(
                                assemblyResult.coverage_analysis
                                  .blooms_distribution,
                              ).map(([level, pct]) => (
                                <div
                                  key={level}
                                  className="flex items-center justify-between text-xs"
                                >
                                  <span className="capitalize">{level}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {Math.round(pct)}%
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Difficulty Distribution */}
                        {assemblyResult.coverage_analysis
                          .difficulty_distribution && (
                          <div className="space-y-2">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                              <Layers className="h-3 w-3" />
                              Difficulty
                            </span>
                            <div className="flex gap-2">
                              {Object.entries(
                                assemblyResult.coverage_analysis
                                  .difficulty_distribution,
                              ).map(([diff, pct]) => (
                                <div key={diff} className="flex-1 text-center">
                                  <div
                                    className={cn(
                                      "text-lg font-bold",
                                      diff === "easy"
                                        ? "text-green-600"
                                        : diff === "medium"
                                          ? "text-amber-600"
                                          : "text-red-600",
                                    )}
                                  >
                                    {Math.round(pct)}%
                                  </div>
                                  <div className="text-xs text-muted-foreground capitalize">
                                    {diff}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setBuilderStep(2)}>
                    Back to Chapters
                  </Button>
                  <Button onClick={savePaperDraft} disabled={savingPaper}>
                    {savingPaper ? (
                      "Saving..."
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Save as Draft
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Papers List */}
      {papers.length === 0 && !showForm && !showBuilder ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">No papers yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create a paper manually or use the AI paper builder
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {papers.map((paper) => (
            <Card key={paper.id} className="transition-all hover:shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-sm">{paper.title}</h4>
                      <Badge
                        variant={
                          STATUS_MAP[paper.status]?.variant || "secondary"
                        }
                        className="text-xs"
                      >
                        {STATUS_MAP[paper.status]?.label || paper.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {paper.board} | Class {paper.class_grade} |{" "}
                      {paper.subject} | {paper.total_marks} marks |{" "}
                      {paper.duration_minutes} min | {paper.question_count}{" "}
                      questions
                    </p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportPDF(paper.id, paper.title)}
                      className="text-xs gap-1"
                    >
                      <Download className="h-3.5 w-3.5" />
                      PDF
                    </Button>
                    {getNextStatuses(paper.status).map((ns) => (
                      <Button
                        key={ns}
                        variant="outline"
                        size="sm"
                        onClick={() => updateStatus(paper.id, ns)}
                        className="text-xs"
                      >
                        {ns}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default PapersPage;
