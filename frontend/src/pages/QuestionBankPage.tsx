import React, { useEffect, useState, useRef } from "react";
import { questionAPI, authAPI, curriculumAPI } from "../services/api";
import type {
  QuestionBank,
  Question,
  GeneratedQuestion,
  TeacherPreferences,
  CurriculumSelection,
  ResearchResult,
  UploadedDocument,
} from "../types";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter,
  Badge,
  Input,
  Textarea,
  Select,
  Skeleton,
  Progress,
} from "../components/ui";
import { CurriculumPicker } from "../components/CurriculumPicker";
import { ResearchBrief } from "../components/ResearchBrief";
import {
  QuestionReviewCard,
  type ReviewStatus,
  type ReviewQuestionData,
} from "../components/QuestionReviewCard";
import { cn } from "../lib/utils";
import {
  BookOpen,
  Plus,
  Sparkles,
  Wand2,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  Brain,
  Target,
  FileText,
  Settings,
  Search,
  ChevronRight,
  Upload,
  File,
  X,
} from "lucide-react";

const BOARDS = ["CBSE", "ICSE", "State Board"];
const CLASSES = [7, 8, 9, 10, 11, 12];
const TYPES = [
  { value: "mcq", label: "MCQ" },
  { value: "short_answer", label: "Short Answer" },
  { value: "long_answer", label: "Long Answer" },
  { value: "very_short", label: "Very Short" },
  { value: "fill_in_blank", label: "Fill in Blank" },
  { value: "true_false", label: "True/False" },
  { value: "numerical", label: "Numerical" },
  { value: "case_study", label: "Case Study" },
];
const DIFFICULTIES = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

// AI Settings Popover
const AI_MODES = [
  {
    value: "auto" as const,
    label: "Auto",
    description: "AI picks defaults, you triage results",
  },
  {
    value: "guided" as const,
    label: "Guided",
    description: "See AI reasoning, edit suggested defaults",
  },
  {
    value: "expert" as const,
    label: "Expert",
    description: "Full control over research, prompts, editing",
  },
];

function AISettingsPopover({
  level,
  onChange,
  saving,
}: {
  level: TeacherPreferences["ai_assistance_level"];
  onChange: (level: TeacherPreferences["ai_assistance_level"]) => void;
  saving: boolean;
}) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={popoverRef}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(!open)}
        className="gap-1.5"
      >
        <Settings className="h-4 w-4" />
        <span className="hidden sm:inline capitalize">{level}</span>
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-lg border border-border bg-popover p-3 shadow-lg z-50">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            AI Assistance Level
          </p>
          <div className="space-y-1">
            {AI_MODES.map((mode) => (
              <button
                key={mode.value}
                type="button"
                onClick={() => {
                  onChange(mode.value);
                  setOpen(false);
                }}
                disabled={saving}
                className={cn(
                  "w-full text-left rounded-md px-3 py-2.5 transition-colors",
                  level === mode.value
                    ? "bg-primary/10 dark:bg-primary/20 border border-primary/30"
                    : "hover:bg-accent border border-transparent",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{mode.label}</span>
                  {level === mode.value && (
                    <CheckCircle className="h-4 w-4 text-primary" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {mode.description}
                </p>
              </button>
            ))}
          </div>
          {saving && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Saving...
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const QuestionBankPage: React.FC = () => {
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedBank, setSelectedBank] = useState<number | null>(null);
  const [showBankForm, setShowBankForm] = useState(false);
  const [showQForm, setShowQForm] = useState(false);
  const [showGenPanel, setShowGenPanel] = useState(false);
  const [loading, setLoading] = useState(true);

  // AI preferences
  const [aiLevel, setAiLevel] =
    useState<TeacherPreferences["ai_assistance_level"]>("guided");
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Bank form state
  const [bankForm, setBankForm] = useState({
    name: "",
    board: "CBSE",
    class_grade: 10,
    subject: "",
    chapter: "",
  });

  // Manual question form state
  const [qForm, setQForm] = useState({
    question_type: "mcq",
    question_text: "",
    marks: 1,
    difficulty: "medium",
    topic: "",
    model_answer: "",
    answer_keywords: "",
    mcq_a: "",
    mcq_b: "",
    mcq_c: "",
    mcq_d: "",
    correct_option: "a",
  });

  // Adaptive generation flow state
  const [genStep, setGenStep] = useState<
    "select" | "research" | "configure" | "generate" | "review"
  >("select");
  const [curriculumSelection, setCurriculumSelection] =
    useState<CurriculumSelection | null>(null);
  const [researchResult, setResearchResult] = useState<ResearchResult | null>(
    null,
  );
  const [teacherNotes, setTeacherNotes] = useState("");
  const [researching, setResearching] = useState(false);

  // Generation config
  const [genConfig, setGenConfig] = useState({
    difficulty: "medium",
    question_type: "mcq",
    count: 5,
  });

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadContentType, setUploadContentType] = useState("textbook");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocument[]>([]);
  const [lastUploadResult, setLastUploadResult] = useState<{
    document: UploadedDocument;
    extracted_text_preview: string;
    question_count?: number;
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [generatedQuestions, setGeneratedQuestions] = useState<
    ReviewQuestionData[]
  >([]);
  const [reviewStatuses, setReviewStatuses] = useState<
    Map<number, ReviewStatus>
  >(new Map());
  const [reviewRatings, setReviewRatings] = useState<Map<number, number>>(
    new Map(),
  );
  const [regenCounts, setRegenCounts] = useState<Map<number, number>>(
    new Map(),
  );
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    questionAPI.listBanks().then((res) => {
      setBanks(res.data);
      setLoading(false);
    });
    // Load teacher AI preferences
    authAPI
      .getPreferences()
      .then((res) => {
        if (res.data?.ai_assistance_level) {
          setAiLevel(res.data.ai_assistance_level);
        }
      })
      .catch(() => {
        // Preferences endpoint may not exist yet; keep default
      });
  }, []);

  const handleAiLevelChange = async (
    level: TeacherPreferences["ai_assistance_level"],
  ) => {
    setSavingPrefs(true);
    setAiLevel(level);
    try {
      await authAPI.updatePreferences({ ai_assistance_level: level });
    } catch {
      // Silently fail -- preference will be applied locally
    } finally {
      setSavingPrefs(false);
    }
  };

  const loadQuestions = (bankId: number) => {
    setSelectedBank(bankId);
    questionAPI.list({ bank_id: bankId }).then((res) => setQuestions(res.data));
  };

  const createBank = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data } = await questionAPI.createBank(bankForm);
    setBanks([data, ...banks]);
    setShowBankForm(false);
    setBankForm({
      name: "",
      board: "CBSE",
      class_grade: 10,
      subject: "",
      chapter: "",
    });
  };

  const createQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBank) return;
    const payload: any = {
      bank_id: selectedBank,
      question_type: qForm.question_type,
      question_text: qForm.question_text,
      marks: qForm.marks,
      difficulty: qForm.difficulty,
      topic: qForm.topic,
      model_answer: qForm.model_answer || undefined,
      answer_keywords: qForm.answer_keywords
        ? qForm.answer_keywords.split(",").map((k) => k.trim())
        : undefined,
    };
    if (qForm.question_type === "mcq") {
      payload.mcq_options = {
        a: qForm.mcq_a,
        b: qForm.mcq_b,
        c: qForm.mcq_c,
        d: qForm.mcq_d,
      };
      payload.correct_option = qForm.correct_option;
    }
    const { data } = await questionAPI.create(payload);
    setQuestions([data, ...questions]);
    setShowQForm(false);
  };

  // Research step
  const handleResearch = async () => {
    if (!curriculumSelection) return;
    setResearching(true);
    try {
      const { data } = await questionAPI.research({
        board: curriculumSelection.board,
        class_grade: curriculumSelection.class_grade,
        subject: curriculumSelection.subject,
        chapter: curriculumSelection.chapter,
        teacher_notes: teacherNotes || undefined,
      });
      setResearchResult(data);
      // Pre-fill config from research suggestions
      if (data.suggested_distribution) {
        // Use suggested distribution to pick most common difficulty
        const entries = Object.entries(
          data.suggested_distribution as Record<string, number>,
        );
        if (entries.length > 0) {
          const topDiff = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
          setGenConfig((prev) => ({ ...prev, difficulty: topDiff[0] }));
        }
      }
      setGenStep("configure");
    } catch (err: any) {
      // Research is optional -- proceed to configure even if it fails
      setResearchResult(null);
      setGenStep("configure");
    } finally {
      setResearching(false);
    }
  };

  // Fetch uploaded documents for current chapter
  const fetchUploadedDocs = async (chapterId?: number) => {
    try {
      const { data } = await curriculumAPI.getDocuments(chapterId);
      setUploadedDocs(Array.isArray(data) ? data : []);
    } catch {
      setUploadedDocs([]);
    }
  };

  // Handle file upload
  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setUploadProgress(10);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("content_type", uploadContentType);
      setUploadProgress(30);
      const { data } = await curriculumAPI.uploadDocument(formData);
      setUploadProgress(100);
      setLastUploadResult(data);
      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      // Refresh uploaded docs list
      fetchUploadedDocs();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/pdf") {
      setUploadFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
    }
  };

  // AI Generation (adaptive)
  const handleGenerate = async () => {
    if (!curriculumSelection) return;
    setGenerating(true);
    setGeneratedQuestions([]);
    setReviewStatuses(new Map());
    setReviewRatings(new Map());
    setRegenCounts(new Map());

    // In Auto mode, do silent research first if not already done
    let researchContext: string | undefined;
    if (aiLevel === "auto" && !researchResult) {
      try {
        const { data } = await questionAPI.research({
          board: curriculumSelection.board,
          class_grade: curriculumSelection.class_grade,
          subject: curriculumSelection.subject,
          chapter: curriculumSelection.chapter,
        });
        researchContext = data.generation_brief;
      } catch {
        // Silent fail for auto mode
      }
    } else if (researchResult) {
      researchContext = researchResult.generation_brief;
    }

    try {
      const payload = {
        topic: curriculumSelection.chapter,
        subject: curriculumSelection.subject,
        board: curriculumSelection.board,
        class_grade: curriculumSelection.class_grade,
        chapter: curriculumSelection.chapter,
        difficulty: genConfig.difficulty,
        question_type: genConfig.question_type,
        count: genConfig.count,
        research_context: researchContext,
        teacher_notes: teacherNotes || undefined,
        topics: curriculumSelection.topics,
      };
      const { data } = await questionAPI.generate(payload);
      const questions: ReviewQuestionData[] = data.questions || [];
      setGeneratedQuestions(questions);
      // In Auto mode: default all to accepted. In Guided/Expert: default to pending.
      const defaultStatus: ReviewStatus =
        aiLevel === "auto" ? "accepted" : "pending";
      const statusMap = new Map<number, ReviewStatus>();
      questions.forEach((_: ReviewQuestionData, i: number) =>
        statusMap.set(i, defaultStatus),
      );
      setReviewStatuses(statusMap);
      setReviewRatings(new Map());
      setRegenCounts(new Map());
      setGenStep("review");
    } catch (err: any) {
      alert(
        err.response?.data?.detail ||
          "Failed to generate questions. Ensure AI service is configured.",
      );
    } finally {
      setGenerating(false);
    }
  };

  // Review handlers
  const handleStatusChange = (index: number, status: ReviewStatus) => {
    setReviewStatuses((prev) => {
      const next = new Map(prev);
      next.set(index, status);
      return next;
    });
  };

  const handleQuestionEdit = (
    index: number,
    updates: Partial<ReviewQuestionData>,
  ) => {
    setGeneratedQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, ...updates } : q)),
    );
  };

  const handleRegenerate = async (index: number, feedback: string) => {
    if (!curriculumSelection) return;
    try {
      const { data } = await questionAPI.regenerateQuestion({
        original_question: generatedQuestions[index],
        feedback,
        research_context: researchResult?.generation_brief,
        board: curriculumSelection.board,
        class_grade: curriculumSelection.class_grade,
        subject: curriculumSelection.subject,
        chapter: curriculumSelection.chapter,
      });
      if (data) {
        setGeneratedQuestions((prev) =>
          prev.map((q, i) => (i === index ? { ...data, ...data } : q)),
        );
        setRegenCounts((prev) => {
          const next = new Map(prev);
          next.set(index, (prev.get(index) || 0) + 1);
          return next;
        });
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to regenerate question");
    }
  };

  const handleRatingChange = (index: number, rating: number) => {
    setReviewRatings((prev) => {
      const next = new Map(prev);
      next.set(index, rating);
      return next;
    });
  };

  const acceptAllRemaining = () => {
    setReviewStatuses((prev) => {
      const next = new Map(prev);
      generatedQuestions.forEach((_, i) => {
        if (next.get(i) === "pending") next.set(i, "accepted");
      });
      return next;
    });
  };

  const rejectAllRemaining = () => {
    setReviewStatuses((prev) => {
      const next = new Map(prev);
      generatedQuestions.forEach((_, i) => {
        if (next.get(i) === "pending") next.set(i, "rejected");
      });
      return next;
    });
  };

  // Computed review stats
  const reviewStats = (() => {
    let accepted = 0;
    let rejected = 0;
    let pending = 0;
    reviewStatuses.forEach((s) => {
      if (s === "accepted") accepted++;
      else if (s === "rejected") rejected++;
      else pending++;
    });
    return { accepted, rejected, pending, total: generatedQuestions.length };
  })();

  const approveAccepted = async () => {
    if (!selectedBank || reviewStats.accepted === 0) return;
    setApproving(true);
    try {
      const questionsToApprove = generatedQuestions
        .filter((_, i) => reviewStatuses.get(i) === "accepted")
        .map((gq) => ({
          bank_id: selectedBank,
          question_type: gq.question_type,
          question_text: gq.edited_question_text ?? gq.question_text,
          marks: gq.edited_marks ?? gq.marks,
          difficulty: gq.edited_difficulty ?? gq.difficulty,
          topic: gq.topic,
          subtopic: gq.subtopic,
          model_answer: gq.edited_model_answer ?? gq.model_answer,
          answer_keywords: gq.edited_answer_keywords ?? gq.answer_keywords,
          mcq_options: gq.edited_mcq_options ?? gq.mcq_options,
          correct_option: gq.edited_correct_option ?? gq.correct_option,
          blooms_level: gq.edited_blooms_level ?? gq.blooms_level,
          original_ai_text: gq.question_text,
          teacher_edited:
            gq.edited_question_text !== undefined ||
            gq.edited_model_answer !== undefined ||
            gq.edited_marks !== undefined ||
            gq.edited_difficulty !== undefined ||
            gq.edited_blooms_level !== undefined,
          quality_rating: reviewRatings.get(generatedQuestions.indexOf(gq)),
        }));
      await questionAPI.approveGenerated({
        bank_id: selectedBank,
        questions: questionsToApprove,
      });
      loadQuestions(selectedBank);
      setGeneratedQuestions([]);
      setReviewStatuses(new Map());
      setReviewRatings(new Map());
      setRegenCounts(new Map());
      setShowGenPanel(false);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to save questions");
    } finally {
      setApproving(false);
    }
  };

  const selectedBankData = banks.find((b) => b.id === selectedBank);

  // Pre-fill and reset generation flow when panel is opened
  const openGenPanel = () => {
    setCurriculumSelection(null);
    setResearchResult(null);
    setTeacherNotes("");
    setGenStep("select");
    setGenConfig({ difficulty: "medium", question_type: "mcq", count: 5 });
    setShowGenPanel(true);
    setGeneratedQuestions([]);
    setReviewStatuses(new Map());
    setReviewRatings(new Map());
    setRegenCounts(new Map());
    setUploadFile(null);
    setLastUploadResult(null);
    setUploadedDocs([]);
    setUploadContentType("textbook");
  };

  const getDifficultyVariant = (difficulty: string) => {
    if (difficulty === "easy") return "success" as const;
    if (difficulty === "medium") return "warning" as const;
    return "destructive" as const;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
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
            Question Bank
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage question banks and create questions manually or with AI
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AISettingsPopover
            level={aiLevel}
            onChange={handleAiLevelChange}
            saving={savingPrefs}
          />
          <Button onClick={() => setShowBankForm(!showBankForm)}>
            <Plus className="h-4 w-4 mr-2" />
            New Bank
          </Button>
        </div>
      </div>

      {/* Create Bank Form */}
      {showBankForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Create Question Bank</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createBank} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  placeholder="Bank Name"
                  value={bankForm.name}
                  onChange={(e) =>
                    setBankForm({ ...bankForm, name: e.target.value })
                  }
                  required
                />
                <Select
                  value={bankForm.board}
                  onChange={(e) =>
                    setBankForm({ ...bankForm, board: e.target.value })
                  }
                  options={BOARDS.map((b) => ({ value: b, label: b }))}
                />
                <Select
                  value={String(bankForm.class_grade)}
                  onChange={(e) =>
                    setBankForm({
                      ...bankForm,
                      class_grade: Number(e.target.value),
                    })
                  }
                  options={CLASSES.map((c) => ({
                    value: String(c),
                    label: `Class ${c}`,
                  }))}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  placeholder="Subject"
                  value={bankForm.subject}
                  onChange={(e) =>
                    setBankForm({ ...bankForm, subject: e.target.value })
                  }
                  required
                />
                <Input
                  placeholder="Chapter (optional)"
                  value={bankForm.chapter}
                  onChange={(e) =>
                    setBankForm({ ...bankForm, chapter: e.target.value })
                  }
                />
                <div className="flex gap-2">
                  <Button type="submit">Create</Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowBankForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Banks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {banks.map((bank) => (
          <Card
            key={bank.id}
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              selectedBank === bank.id && "ring-2 ring-primary",
            )}
            onClick={() => loadQuestions(bank.id)}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h4 className="font-semibold text-sm">{bank.name}</h4>
                  <p className="text-xs text-muted-foreground">
                    {bank.board} | Class {bank.class_grade} | {bank.subject}
                  </p>
                </div>
                <div className="rounded-lg bg-primary/10 p-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="secondary">
                  {bank.question_count} questions
                </Badge>
                {bank.chapter && (
                  <Badge variant="outline" className="text-xs">
                    {bank.chapter}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Questions Section */}
      {selectedBank && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">
                Questions {selectedBankData && `- ${selectedBankData.name}`}
              </h3>
              <p className="text-sm text-muted-foreground">
                {questions.length} question{questions.length !== 1 ? "s" : ""}{" "}
                in this bank
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowQForm(!showQForm)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Manual
              </Button>
              <Button onClick={openGenPanel}>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate with AI
              </Button>
            </div>
          </div>

          {/* AI Generation Panel -- Adaptive Flow */}
          {showGenPanel && (
            <Card className="border-primary/20 bg-primary/[0.02]">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Wand2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        AI Question Generator
                      </CardTitle>
                      <CardDescription>
                        {aiLevel === "auto"
                          ? "Select a chapter and generate -- AI handles the rest"
                          : aiLevel === "expert"
                            ? "Full control over research, configuration, and editing"
                            : "Guided generation with AI research and suggested defaults"}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Step indicators for Guided/Expert */}
                    {aiLevel !== "auto" && (
                      <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                        {(
                          [
                            { key: "select", label: "Select" },
                            { key: "research", label: "Research" },
                            { key: "configure", label: "Configure" },
                            { key: "review", label: "Review" },
                          ] as const
                        ).map((step, i) => (
                          <React.Fragment key={step.key}>
                            {i > 0 && (
                              <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                            )}
                            <span
                              className={cn(
                                "px-1.5 py-0.5 rounded",
                                genStep === step.key ||
                                  (step.key === "select" &&
                                    genStep === "generate")
                                  ? "text-primary font-medium bg-primary/10"
                                  : "",
                              )}
                            >
                              {step.label}
                            </span>
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowGenPanel(false)}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {/* Step 1: Curriculum Selection (all modes) */}
              <CardContent className="space-y-4">
                <CurriculumPicker
                  onSelectionChange={(sel) => {
                    setCurriculumSelection(sel);
                    // Reset downstream state when selection changes
                    setResearchResult(null);
                    setGeneratedQuestions([]);
                    setGenStep("select");
                  }}
                  showTopicFilter={aiLevel === "expert"}
                  defaultBoard={selectedBankData?.board}
                  defaultClass={selectedBankData?.class_grade}
                />

                {/* Auto mode: single generate button + count */}
                {aiLevel === "auto" && (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-muted-foreground">
                        Questions:
                      </label>
                      <Input
                        type="number"
                        value={genConfig.count}
                        onChange={(e) =>
                          setGenConfig({
                            ...genConfig,
                            count: Number(e.target.value),
                          })
                        }
                        min={1}
                        max={20}
                        className="w-20"
                      />
                    </div>
                    <Button
                      onClick={handleGenerate}
                      disabled={generating || !curriculumSelection}
                    >
                      {generating ? (
                        <>
                          <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Wand2 className="h-4 w-4 mr-2" />
                          Generate
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* Guided/Expert mode: Step-based flow */}
                {aiLevel !== "auto" && (
                  <>
                    {/* Step transition: Select -> Research */}
                    {genStep === "select" && (
                      <div className="flex gap-2">
                        <Button
                          onClick={() => {
                            setGenStep("research");
                            handleResearch();
                            fetchUploadedDocs();
                          }}
                          disabled={!curriculumSelection || researching}
                        >
                          {researching ? (
                            <>
                              <Search className="h-4 w-4 mr-2 animate-spin" />
                              Researching...
                            </>
                          ) : (
                            <>
                              <Search className="h-4 w-4 mr-2" />
                              Research Chapter
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setGenStep("configure");
                            fetchUploadedDocs();
                          }}
                          disabled={!curriculumSelection}
                        >
                          Skip to Configure
                        </Button>
                      </div>
                    )}

                    {/* Step 2: Research Brief (Guided/Expert) */}
                    {genStep === "research" && researching && (
                      <div className="flex items-center gap-3 py-6 justify-center text-muted-foreground">
                        <Search className="h-5 w-5 animate-spin" />
                        <span className="text-sm">
                          Researching curriculum and question patterns...
                        </span>
                      </div>
                    )}

                    {/* Step 3: Configure (after research or skip) */}
                    {(genStep === "configure" || genStep === "generate") && (
                      <div className="space-y-4">
                        {/* Show Research Brief if available */}
                        {researchResult && (
                          <ResearchBrief
                            researchResult={researchResult}
                            onNotesChange={
                              aiLevel === "expert" || aiLevel === "guided"
                                ? setTeacherNotes
                                : undefined
                            }
                            showNotes={
                              aiLevel === "expert" || aiLevel === "guided"
                            }
                          />
                        )}

                        {/* Upload Reference Material */}
                        <div className="space-y-3">
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Upload Reference Material
                          </span>
                          <Card className="border-dashed border-2 border-muted-foreground/20">
                            <CardContent className="p-4 space-y-4">
                              {/* Drop zone / file picker */}
                              <div
                                className={cn(
                                  "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 transition-colors cursor-pointer",
                                  dragOver
                                    ? "border-primary bg-primary/5"
                                    : "border-muted-foreground/25 hover:border-muted-foreground/40",
                                )}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  setDragOver(true);
                                }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={handleFileDrop}
                                onClick={() => fileInputRef.current?.click()}
                              >
                                <input
                                  ref={fileInputRef}
                                  type="file"
                                  accept=".pdf"
                                  className="hidden"
                                  onChange={handleFileSelect}
                                />
                                <Upload className="h-8 w-8 text-muted-foreground/50 mb-2" />
                                <p className="text-sm font-medium text-muted-foreground">
                                  {uploadFile
                                    ? uploadFile.name
                                    : "Drop a PDF here or click to browse"}
                                </p>
                                <p className="text-xs text-muted-foreground/60 mt-1">
                                  Textbook chapters, past exam papers, or
                                  reference material
                                </p>
                              </div>

                              {/* Selected file info + content type + upload button */}
                              {uploadFile && (
                                <div className="flex items-center gap-3 flex-wrap">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <File className="h-4 w-4 text-primary shrink-0" />
                                    <span className="text-sm truncate">
                                      {uploadFile.name}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setUploadFile(null);
                                        if (fileInputRef.current)
                                          fileInputRef.current.value = "";
                                      }}
                                      className="text-muted-foreground hover:text-foreground"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                  <Select
                                    value={uploadContentType}
                                    onChange={(e) =>
                                      setUploadContentType(e.target.value)
                                    }
                                    options={[
                                      {
                                        value: "textbook",
                                        label: "Textbook Chapter",
                                      },
                                      {
                                        value: "past_paper",
                                        label: "Past Exam Paper",
                                      },
                                      {
                                        value: "reference",
                                        label: "Reference Material",
                                      },
                                    ]}
                                  />
                                  <Button
                                    size="sm"
                                    onClick={handleUpload}
                                    disabled={uploading}
                                  >
                                    {uploading ? (
                                      <>
                                        <Upload className="h-4 w-4 mr-1.5 animate-spin" />
                                        Uploading...
                                      </>
                                    ) : (
                                      <>
                                        <Upload className="h-4 w-4 mr-1.5" />
                                        Upload
                                      </>
                                    )}
                                  </Button>
                                </div>
                              )}

                              {/* Upload progress */}
                              {uploading && (
                                <Progress
                                  value={uploadProgress}
                                  className="h-1.5"
                                />
                              )}

                              {/* Last upload result */}
                              {lastUploadResult && (
                                <Card className="bg-muted/30">
                                  <CardContent className="p-3 space-y-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <CheckCircle className="h-4 w-4 text-green-500" />
                                      <span className="text-sm font-medium">
                                        {lastUploadResult.document.filename}
                                      </span>
                                      <Badge
                                        variant="secondary"
                                        className="text-xs"
                                      >
                                        {lastUploadResult.document
                                          .content_type === "past_paper"
                                          ? "Past Paper"
                                          : lastUploadResult.document
                                                .content_type === "textbook"
                                            ? "Textbook"
                                            : "Reference"}
                                      </Badge>
                                      {lastUploadResult.question_count !=
                                        null &&
                                        lastUploadResult.question_count > 0 && (
                                          <Badge className="text-xs">
                                            {lastUploadResult.question_count}{" "}
                                            questions extracted
                                          </Badge>
                                        )}
                                    </div>
                                    {lastUploadResult.extracted_text_preview && (
                                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">
                                        {lastUploadResult.extracted_text_preview.slice(
                                          0,
                                          300,
                                        )}
                                        {lastUploadResult.extracted_text_preview
                                          .length > 300 && "..."}
                                      </p>
                                    )}
                                  </CardContent>
                                </Card>
                              )}

                              {/* Previously uploaded documents */}
                              {uploadedDocs.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-xs font-medium text-muted-foreground">
                                    Previously uploaded ({uploadedDocs.length})
                                  </p>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {uploadedDocs.map((doc) => (
                                      <div
                                        key={doc.id}
                                        className="flex items-center gap-2 rounded-md border border-border p-2 text-sm"
                                      >
                                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                        <span className="truncate flex-1">
                                          {doc.filename}
                                        </span>
                                        <Badge
                                          variant="outline"
                                          className="text-xs shrink-0"
                                        >
                                          {doc.content_type === "past_paper"
                                            ? "Past Paper"
                                            : doc.content_type === "textbook"
                                              ? "Textbook"
                                              : "Reference"}
                                        </Badge>
                                        {doc.extracted_questions &&
                                          doc.extracted_questions.length >
                                            0 && (
                                            <Badge
                                              variant="secondary"
                                              className="text-xs shrink-0"
                                            >
                                              {doc.extracted_questions.length}{" "}
                                              Qs
                                            </Badge>
                                          )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </div>

                        {/* Generation Configuration */}
                        <div className="space-y-3">
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Generation Settings
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1.5">
                              <label className="text-xs text-muted-foreground">
                                Difficulty
                              </label>
                              <Select
                                value={genConfig.difficulty}
                                onChange={(e) =>
                                  setGenConfig({
                                    ...genConfig,
                                    difficulty: e.target.value,
                                  })
                                }
                                options={DIFFICULTIES}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs text-muted-foreground">
                                Question Type
                              </label>
                              <Select
                                value={genConfig.question_type}
                                onChange={(e) =>
                                  setGenConfig({
                                    ...genConfig,
                                    question_type: e.target.value,
                                  })
                                }
                                options={TYPES}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs text-muted-foreground">
                                Count
                              </label>
                              <Input
                                type="number"
                                value={genConfig.count}
                                onChange={(e) =>
                                  setGenConfig({
                                    ...genConfig,
                                    count: Number(e.target.value),
                                  })
                                }
                                min={1}
                                max={20}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            onClick={handleGenerate}
                            disabled={generating || !curriculumSelection}
                          >
                            {generating ? (
                              <>
                                <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <Wand2 className="h-4 w-4 mr-2" />
                                Generate Questions
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setGenStep("select");
                              setResearchResult(null);
                            }}
                          >
                            Back
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>

              {/* Review Step -- QuestionReviewCards (all modes) */}
              {(genStep === "review" ||
                (aiLevel === "auto" && generatedQuestions.length > 0)) &&
                generatedQuestions.length > 0 && (
                  <CardContent className="border-t pt-4 space-y-4">
                    {/* Summary Bar */}
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <Brain className="h-5 w-5 text-primary" />
                        <h4 className="font-semibold">
                          {reviewStats.total} Questions
                        </h4>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-green-600 dark:text-green-400 font-medium">
                            {reviewStats.accepted} accepted
                          </span>
                          <span className="text-muted-foreground">|</span>
                          <span className="text-red-600 dark:text-red-400 font-medium">
                            {reviewStats.rejected} rejected
                          </span>
                          <span className="text-muted-foreground">|</span>
                          <span className="text-amber-600 dark:text-amber-400 font-medium">
                            {reviewStats.pending} pending
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {reviewStats.pending > 0 && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={acceptAllRemaining}
                            >
                              <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                              Accept All Remaining
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={rejectAllRemaining}
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1.5" />
                              Reject All Remaining
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          onClick={approveAccepted}
                          disabled={approving || reviewStats.accepted === 0}
                        >
                          {approving ? (
                            "Saving..."
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve & Save ({reviewStats.accepted})
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Question Review Cards */}
                    <div className="space-y-3">
                      {generatedQuestions.map((gq, index) => (
                        <QuestionReviewCard
                          key={index}
                          question={gq}
                          index={index}
                          mode={aiLevel}
                          status={reviewStatuses.get(index) || "pending"}
                          rating={reviewRatings.get(index) || 0}
                          regenerationCount={regenCounts.get(index) || 0}
                          onStatusChange={handleStatusChange}
                          onQuestionEdit={handleQuestionEdit}
                          onRegenerate={handleRegenerate}
                          onRatingChange={handleRatingChange}
                        />
                      ))}
                    </div>
                  </CardContent>
                )}
            </Card>
          )}

          {/* Manual Add Question Form */}
          {showQForm && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Add Question Manually</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={createQuestion} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Select
                      value={qForm.question_type}
                      onChange={(e) =>
                        setQForm({ ...qForm, question_type: e.target.value })
                      }
                      options={TYPES}
                    />
                    <Select
                      value={qForm.difficulty}
                      onChange={(e) =>
                        setQForm({ ...qForm, difficulty: e.target.value })
                      }
                      options={DIFFICULTIES}
                    />
                    <Input
                      type="number"
                      placeholder="Marks"
                      value={qForm.marks}
                      onChange={(e) =>
                        setQForm({ ...qForm, marks: Number(e.target.value) })
                      }
                    />
                  </div>
                  <Input
                    placeholder="Topic"
                    value={qForm.topic}
                    onChange={(e) =>
                      setQForm({ ...qForm, topic: e.target.value })
                    }
                    required
                  />
                  <Textarea
                    placeholder="Question text"
                    value={qForm.question_text}
                    onChange={(e) =>
                      setQForm({ ...qForm, question_text: e.target.value })
                    }
                    required
                    className="min-h-[80px]"
                  />
                  {qForm.question_type === "mcq" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input
                        placeholder="Option A"
                        value={qForm.mcq_a}
                        onChange={(e) =>
                          setQForm({ ...qForm, mcq_a: e.target.value })
                        }
                      />
                      <Input
                        placeholder="Option B"
                        value={qForm.mcq_b}
                        onChange={(e) =>
                          setQForm({ ...qForm, mcq_b: e.target.value })
                        }
                      />
                      <Input
                        placeholder="Option C"
                        value={qForm.mcq_c}
                        onChange={(e) =>
                          setQForm({ ...qForm, mcq_c: e.target.value })
                        }
                      />
                      <Input
                        placeholder="Option D"
                        value={qForm.mcq_d}
                        onChange={(e) =>
                          setQForm({ ...qForm, mcq_d: e.target.value })
                        }
                      />
                      <Select
                        value={qForm.correct_option}
                        onChange={(e) =>
                          setQForm({ ...qForm, correct_option: e.target.value })
                        }
                        options={[
                          { value: "a", label: "Correct: A" },
                          { value: "b", label: "Correct: B" },
                          { value: "c", label: "Correct: C" },
                          { value: "d", label: "Correct: D" },
                        ]}
                      />
                    </div>
                  )}
                  <Textarea
                    placeholder="Model Answer"
                    value={qForm.model_answer}
                    onChange={(e) =>
                      setQForm({ ...qForm, model_answer: e.target.value })
                    }
                    className="min-h-[60px]"
                  />
                  <Input
                    placeholder="Answer keywords (comma-separated)"
                    value={qForm.answer_keywords}
                    onChange={(e) =>
                      setQForm({ ...qForm, answer_keywords: e.target.value })
                    }
                  />
                  <div className="flex gap-2">
                    <Button type="submit">Add Question</Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowQForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Questions List */}
          {questions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground font-medium">
                  No questions yet
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Add questions manually or generate them with AI
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {questions.map((q, i) => (
                <Card key={q.id} className="transition-all hover:shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="text-sm font-semibold text-muted-foreground">
                            Q{i + 1}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {q.question_type.replace("_", " ")}
                          </Badge>
                          <Badge
                            variant={getDifficultyVariant(q.difficulty)}
                            className="text-xs"
                          >
                            {q.difficulty}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {q.marks} marks
                          </Badge>
                          {q.source === "ai_generated" && (
                            <div className="flex items-center gap-1">
                              <Sparkles className="h-3 w-3 text-primary" />
                              <span className="text-xs text-primary">AI</span>
                            </div>
                          )}
                        </div>
                        <p className="text-sm leading-relaxed">
                          {q.question_text}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {q.topic}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default QuestionBankPage;
