import React, { useState, useCallback } from "react";
import { taxonomyAPI, curriculumAPI } from "../services/api";
import type {
  GeneratedTaxonomyTree,
  GeneratedTaxonomyChapter,
  GeneratedTaxonomyTopic,
  GeneratedTaxonomyOutcome,
} from "../types";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Badge,
  Input,
  Skeleton,
} from "./ui";
import { cn } from "../lib/utils";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";

// ── Wizard steps ──

type WizardStep = "generate" | "review" | "approve";

const BLOOMS_LEVELS = [
  "Remember",
  "Understand",
  "Apply",
  "Analyze",
  "Evaluate",
  "Create",
];

// ── Props ──

export interface TaxonomyCreatorProps {
  board: string;
  classGrade: number;
  subject: string;
  onComplete: () => void;
  onCancel: () => void;
}

// ── Main component ──

const TaxonomyCreator: React.FC<TaxonomyCreatorProps> = ({
  board,
  classGrade,
  subject,
  onComplete,
  onCancel,
}) => {
  const [step, setStep] = useState<WizardStep>("generate");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taxonomy, setTaxonomy] = useState<GeneratedTaxonomyTree | null>(null);
  const [documentId, setDocumentId] = useState<number | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [pdfFilename, setPdfFilename] = useState<string | null>(null);
  const [saveConflict, setSaveConflict] = useState<{
    existingId: number;
  } | null>(null);

  // ── Step 1: Generate ──

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      let res;
      if (documentId) {
        res = await taxonomyAPI.generateFromPdf(documentId);
      } else {
        res = await taxonomyAPI.generate({
          board,
          class_grade: classGrade,
          subject,
        });
      }
      setTaxonomy(res.data.taxonomy ?? res.data);
      setStep("review");
    } catch (err: any) {
      setError(
        err.response?.data?.detail ??
          "Failed to generate curriculum. Please try again.",
      );
    } finally {
      setGenerating(false);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPdf(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await curriculumAPI.uploadDocument(formData);
      setDocumentId(res.data.document.id);
      setPdfFilename(file.name);
    } catch (err: any) {
      setError("Failed to upload PDF. Please try again.");
    } finally {
      setUploadingPdf(false);
    }
  };

  // ── Step 2: Review (tree editing) ──

  const updateChapter = (
    index: number,
    updates: Partial<GeneratedTaxonomyChapter>,
  ) => {
    if (!taxonomy) return;
    const chapters = [...taxonomy.chapters];
    chapters[index] = { ...chapters[index], ...updates };
    setTaxonomy({ ...taxonomy, chapters });
  };

  const removeChapter = (index: number) => {
    if (!taxonomy) return;
    setTaxonomy({
      ...taxonomy,
      chapters: taxonomy.chapters.filter((_, i) => i !== index),
    });
  };

  const addChapter = () => {
    if (!taxonomy) return;
    const newChapter: GeneratedTaxonomyChapter = {
      number: taxonomy.chapters.length + 1,
      name: "",
      textbook_reference: "",
      marks_weightage: 0,
      question_pattern_notes: "",
      topics: [],
    };
    setTaxonomy({
      ...taxonomy,
      chapters: [...taxonomy.chapters, newChapter],
    });
  };

  const updateTopic = (
    chapterIdx: number,
    topicIdx: number,
    updates: Partial<GeneratedTaxonomyTopic>,
  ) => {
    if (!taxonomy) return;
    const chapters = [...taxonomy.chapters];
    const topics = [...chapters[chapterIdx].topics];
    topics[topicIdx] = { ...topics[topicIdx], ...updates };
    chapters[chapterIdx] = { ...chapters[chapterIdx], topics };
    setTaxonomy({ ...taxonomy, chapters });
  };

  const removeTopic = (chapterIdx: number, topicIdx: number) => {
    if (!taxonomy) return;
    const chapters = [...taxonomy.chapters];
    chapters[chapterIdx] = {
      ...chapters[chapterIdx],
      topics: chapters[chapterIdx].topics.filter((_, i) => i !== topicIdx),
    };
    setTaxonomy({ ...taxonomy, chapters });
  };

  const addTopic = (chapterIdx: number) => {
    if (!taxonomy) return;
    const chapters = [...taxonomy.chapters];
    chapters[chapterIdx] = {
      ...chapters[chapterIdx],
      topics: [
        ...chapters[chapterIdx].topics,
        { name: "", description: "", learning_outcomes: [] },
      ],
    };
    setTaxonomy({ ...taxonomy, chapters });
  };

  const updateOutcome = (
    chapterIdx: number,
    topicIdx: number,
    outcomeIdx: number,
    updates: Partial<GeneratedTaxonomyOutcome>,
  ) => {
    if (!taxonomy) return;
    const chapters = [...taxonomy.chapters];
    const topics = [...chapters[chapterIdx].topics];
    const outcomes = [...topics[topicIdx].learning_outcomes];
    outcomes[outcomeIdx] = { ...outcomes[outcomeIdx], ...updates };
    topics[topicIdx] = { ...topics[topicIdx], learning_outcomes: outcomes };
    chapters[chapterIdx] = { ...chapters[chapterIdx], topics };
    setTaxonomy({ ...taxonomy, chapters });
  };

  const removeOutcome = (
    chapterIdx: number,
    topicIdx: number,
    outcomeIdx: number,
  ) => {
    if (!taxonomy) return;
    const chapters = [...taxonomy.chapters];
    const topics = [...chapters[chapterIdx].topics];
    topics[topicIdx] = {
      ...topics[topicIdx],
      learning_outcomes: topics[topicIdx].learning_outcomes.filter(
        (_, i) => i !== outcomeIdx,
      ),
    };
    chapters[chapterIdx] = { ...chapters[chapterIdx], topics };
    setTaxonomy({ ...taxonomy, chapters });
  };

  const addOutcome = (chapterIdx: number, topicIdx: number) => {
    if (!taxonomy) return;
    const chapters = [...taxonomy.chapters];
    const topics = [...chapters[chapterIdx].topics];
    topics[topicIdx] = {
      ...topics[topicIdx],
      learning_outcomes: [
        ...topics[topicIdx].learning_outcomes,
        { description: "", bloom_level: "Remember" },
      ],
    };
    chapters[chapterIdx] = { ...chapters[chapterIdx], topics };
    setTaxonomy({ ...taxonomy, chapters });
  };

  // ── Step 3: Save ──

  const handleSave = async () => {
    if (!taxonomy) return;
    setSaving(true);
    setError(null);
    setSaveConflict(null);
    try {
      await taxonomyAPI.save({
        board,
        class_grade: classGrade,
        subject,
        academic_year: new Date().getFullYear().toString(),
        textbook_name: taxonomy.textbook_name,
        chapters: taxonomy.chapters,
      });
      setStep("approve");
    } catch (err: any) {
      if (err.response?.status === 409) {
        setSaveConflict({
          existingId: err.response.data?.existing_id,
        });
      } else {
        setError(err.response?.data?.detail ?? "Failed to save curriculum.");
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Render ──

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Create Curriculum</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            {board} Class {classGrade} {subject}
          </Badge>
        </div>
        {/* Step indicators */}
        <div className="mt-3 flex items-center gap-2 text-xs">
          <StepIndicator
            step={1}
            label="Generate"
            active={step === "generate"}
            completed={step === "review" || step === "approve"}
          />
          <div className="h-px flex-1 bg-border" />
          <StepIndicator
            step={2}
            label="Review"
            active={step === "review"}
            completed={step === "approve"}
          />
          <div className="h-px flex-1 bg-border" />
          <StepIndicator
            step={3}
            label="Approve"
            active={step === "approve"}
            completed={false}
          />
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* ── Step 1: Generate ── */}
        {step === "generate" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              AI will research the official syllabus and generate a
              chapter/topic structure for {board} Class {classGrade} {subject}.
            </p>

            {/* Optional PDF upload */}
            <div className="rounded-lg border border-dashed p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Upload className="h-4 w-4 text-muted-foreground" />
                Upload a textbook PDF for better results
                <Badge variant="outline" className="text-[10px]">
                  Optional
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                The AI will use the table of contents to generate a more
                accurate curriculum structure.
              </p>

              {pdfFilename ? (
                <div className="mt-2 flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1.5 text-sm">
                  <BookOpen className="h-3.5 w-3.5 text-primary" />
                  <span className="flex-1 truncate">{pdfFilename}</span>
                  <button
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setDocumentId(null);
                      setPdfFilename(null);
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted/50">
                  {uploadingPdf ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Upload className="h-3 w-3" />
                  )}
                  {uploadingPdf ? "Uploading..." : "Choose PDF"}
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={handlePdfUpload}
                    disabled={uploadingPdf}
                  />
                </label>
              )}
            </div>
          </div>
        )}

        {/* ── Step 2: Review ── */}
        {step === "review" && taxonomy && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Review and edit the generated curriculum. Click any field to edit.
            </p>

            {taxonomy.chapters.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No chapters yet.{" "}
                <button className="text-primary underline" onClick={addChapter}>
                  Add your first chapter
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {taxonomy.chapters.map((chapter, chIdx) => (
                  <ChapterEditor
                    key={chIdx}
                    chapter={chapter}
                    index={chIdx}
                    onUpdate={(u) => updateChapter(chIdx, u)}
                    onRemove={() => removeChapter(chIdx)}
                    onUpdateTopic={(tIdx, u) => updateTopic(chIdx, tIdx, u)}
                    onRemoveTopic={(tIdx) => removeTopic(chIdx, tIdx)}
                    onAddTopic={() => addTopic(chIdx)}
                    onUpdateOutcome={(tIdx, oIdx, u) =>
                      updateOutcome(chIdx, tIdx, oIdx, u)
                    }
                    onRemoveOutcome={(tIdx, oIdx) =>
                      removeOutcome(chIdx, tIdx, oIdx)
                    }
                    onAddOutcome={(tIdx) => addOutcome(chIdx, tIdx)}
                  />
                ))}
              </div>
            )}

            <Button variant="outline" size="sm" onClick={addChapter}>
              <Plus className="mr-1 h-3 w-3" />
              Add Chapter
            </Button>
          </div>
        )}

        {/* ── Step 3: Approved ── */}
        {step === "approve" && (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="mb-3 rounded-full bg-emerald-100 p-3 dark:bg-emerald-900/30">
              <Check className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-sm font-medium">Curriculum Saved</p>
            <p className="mt-1 text-xs text-muted-foreground">
              This curriculum is now available to all teachers on the platform.
            </p>
          </div>
        )}

        {/* Conflict handling */}
        {saveConflict && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/30">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
              This curriculum was just created by another teacher.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSaveConflict(null);
                  onComplete();
                }}
              >
                View Existing Curriculum
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (taxonomy) {
                    const blob = new Blob([JSON.stringify(taxonomy, null, 2)], {
                      type: "application/json",
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `taxonomy-${board}-${classGrade}-${subject}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }
                }}
              >
                Download Your Draft as JSON
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="justify-between">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <div className="flex items-center gap-2">
          {step === "review" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep("generate")}
            >
              Back
            </Button>
          )}
          {step === "generate" && (
            <Button size="sm" onClick={handleGenerate} disabled={generating}>
              {generating ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  Generate Curriculum
                </>
              )}
            </Button>
          )}
          {step === "review" && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || (taxonomy?.chapters.length ?? 0) === 0}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save & Make Available"
              )}
            </Button>
          )}
          {step === "approve" && (
            <Button size="sm" onClick={onComplete}>
              Done
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
};

// ── Step indicator ──

function StepIndicator({
  step,
  label,
  active,
  completed,
}: {
  step: number;
  label: string;
  active: boolean;
  completed: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium",
          completed
            ? "bg-primary text-primary-foreground"
            : active
              ? "bg-primary/20 text-primary ring-1 ring-primary"
              : "bg-muted text-muted-foreground",
        )}
      >
        {completed ? <Check className="h-3 w-3" /> : step}
      </span>
      <span
        className={cn(
          "text-xs",
          active ? "font-medium text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </div>
  );
}

// ── Chapter editor ──

function ChapterEditor({
  chapter,
  index,
  onUpdate,
  onRemove,
  onUpdateTopic,
  onRemoveTopic,
  onAddTopic,
  onUpdateOutcome,
  onRemoveOutcome,
  onAddOutcome,
}: {
  chapter: GeneratedTaxonomyChapter;
  index: number;
  onUpdate: (updates: Partial<GeneratedTaxonomyChapter>) => void;
  onRemove: () => void;
  onUpdateTopic: (
    topicIdx: number,
    updates: Partial<GeneratedTaxonomyTopic>,
  ) => void;
  onRemoveTopic: (topicIdx: number) => void;
  onAddTopic: () => void;
  onUpdateOutcome: (
    topicIdx: number,
    outcomeIdx: number,
    updates: Partial<GeneratedTaxonomyOutcome>,
  ) => void;
  onRemoveOutcome: (topicIdx: number, outcomeIdx: number) => void;
  onAddOutcome: (topicIdx: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border bg-card">
      {/* Chapter header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          className="shrink-0 rounded p-0.5 hover:bg-muted"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>

        <Sparkles className="h-3 w-3 shrink-0 text-amber-500" />

        <span className="mr-1 shrink-0 text-xs font-medium text-muted-foreground">
          Ch {chapter.number}
        </span>

        <EditableText
          value={chapter.name}
          placeholder="Chapter name"
          onChange={(name) => onUpdate({ name })}
          className="flex-1 text-sm font-medium"
        />

        <Input
          type="number"
          value={chapter.marks_weightage || ""}
          onChange={(e) =>
            onUpdate({ marks_weightage: Number(e.target.value) || 0 })
          }
          className="h-6 w-14 px-1 text-center text-xs"
          placeholder="Marks"
          title="Marks weightage"
        />

        <button
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={onRemove}
          aria-label="Remove chapter"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t px-3 py-2 space-y-2">
          {/* Textbook reference */}
          <div className="flex items-center gap-2 text-xs">
            <span className="shrink-0 text-muted-foreground">Ref:</span>
            <EditableText
              value={chapter.textbook_reference}
              placeholder="e.g. NCERT Ch 3, pg 45-72"
              onChange={(textbook_reference) =>
                onUpdate({ textbook_reference })
              }
              className="flex-1 text-xs"
            />
          </div>

          {/* Topics */}
          {chapter.topics.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted-foreground">
              No topics.{" "}
              <button className="text-primary underline" onClick={onAddTopic}>
                Add topics
              </button>
            </p>
          ) : (
            <div className="space-y-1.5 pl-2">
              {chapter.topics.map((topic, tIdx) => (
                <TopicEditor
                  key={tIdx}
                  topic={topic}
                  onUpdate={(u) => onUpdateTopic(tIdx, u)}
                  onRemove={() => onRemoveTopic(tIdx)}
                  onUpdateOutcome={(oIdx, u) => onUpdateOutcome(tIdx, oIdx, u)}
                  onRemoveOutcome={(oIdx) => onRemoveOutcome(tIdx, oIdx)}
                  onAddOutcome={() => onAddOutcome(tIdx)}
                />
              ))}
            </div>
          )}

          <button
            className="flex items-center gap-1 text-xs text-primary hover:underline"
            onClick={onAddTopic}
          >
            <Plus className="h-2.5 w-2.5" />
            Add Topic
          </button>
        </div>
      )}
    </div>
  );
}

// ── Topic editor ──

function TopicEditor({
  topic,
  onUpdate,
  onRemove,
  onUpdateOutcome,
  onRemoveOutcome,
  onAddOutcome,
}: {
  topic: GeneratedTaxonomyTopic;
  onUpdate: (updates: Partial<GeneratedTaxonomyTopic>) => void;
  onRemove: () => void;
  onUpdateOutcome: (
    outcomeIdx: number,
    updates: Partial<GeneratedTaxonomyOutcome>,
  ) => void;
  onRemoveOutcome: (outcomeIdx: number) => void;
  onAddOutcome: () => void;
}) {
  return (
    <div className="rounded border-l-2 border-primary/20 pl-2 py-1">
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-2.5 w-2.5 shrink-0 text-amber-400" />
        <EditableText
          value={topic.name}
          placeholder="Topic name"
          onChange={(name) => onUpdate({ name })}
          className="flex-1 text-xs font-medium"
        />
        <button
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-2.5 w-2.5" />
        </button>
      </div>

      {/* Learning outcomes */}
      {topic.learning_outcomes.length > 0 && (
        <div className="mt-1 space-y-0.5 pl-4">
          {topic.learning_outcomes.map((lo, oIdx) => (
            <div key={oIdx} className="flex items-center gap-1 text-[11px]">
              <select
                value={lo.bloom_level}
                onChange={(e) =>
                  onUpdateOutcome(oIdx, { bloom_level: e.target.value })
                }
                className="h-5 rounded border border-input bg-background px-1 text-[10px]"
              >
                {BLOOMS_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
              <EditableText
                value={lo.description}
                placeholder="Learning outcome"
                onChange={(description) =>
                  onUpdateOutcome(oIdx, { description })
                }
                className="flex-1 text-[11px] text-muted-foreground"
              />
              <button
                className="shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => onRemoveOutcome(oIdx)}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        className="mt-0.5 ml-4 flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-primary"
        onClick={onAddOutcome}
      >
        <Plus className="h-2 w-2" />
        Outcome
      </button>
    </div>
  );
}

// ── Inline editable text ──

function EditableText({
  value,
  placeholder,
  onChange,
  className,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          onChange(draft);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onChange(draft);
            setEditing(false);
          }
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className={cn(
          "rounded border border-primary/40 bg-transparent px-1 py-0 outline-none focus:ring-1 focus:ring-primary/40",
          className,
        )}
        placeholder={placeholder}
        autoFocus
      />
    );
  }

  return (
    <span
      className={cn(
        "cursor-pointer rounded px-1 transition-colors hover:bg-muted/60",
        !value && "italic text-muted-foreground",
        className,
      )}
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          setDraft(value);
          setEditing(true);
        }
      }}
    >
      {value || placeholder}
    </span>
  );
}

export { TaxonomyCreator };
