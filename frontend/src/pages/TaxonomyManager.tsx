import React, { useEffect, useState, useCallback } from "react";
import { taxonomyAPI } from "../services/api";
import type {
  CurriculumListItem,
  ImpactAnalysis as ImpactAnalysisType,
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
  Skeleton,
  StatCard,
  useToast,
} from "../components/ui";
import { TaxonomyCreator } from "../components/TaxonomyCreator";
import { ImpactAnalysis } from "../components/ImpactAnalysis";
import { cn } from "../lib/utils";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Copy,
  GraduationCap,
  Layers,
  Library,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  X,
} from "lucide-react";

// ── Subject detail from backend ──

interface SubjectDetail {
  id: number;
  name: string;
  class_grade: number;
  textbook_name?: string;
  chapters: SubjectChapter[];
}

interface SubjectChapter {
  id: number;
  number: number;
  name: string;
  textbook_reference?: string;
  marks_weightage?: number;
  question_pattern_notes?: string;
  topics: SubjectTopic[];
}

interface SubjectTopic {
  id: number;
  name: string;
  description?: string;
  learning_outcomes: SubjectOutcome[];
}

interface SubjectOutcome {
  id: number;
  code: string;
  description: string;
  bloom_level?: string;
}

// ── Chapter edit state ──

interface ChapterEditState {
  chapterId: number;
  chapterName: string;
  field: string;
  value: string;
  impact: ImpactAnalysisType | null;
  loadingImpact: boolean;
  saving: boolean;
}

const TaxonomyManager: React.FC = () => {
  const [curricula, setCurricula] = useState<CurriculumListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Grouped by board
  const [expandedBoards, setExpandedBoards] = useState<Set<string>>(new Set());
  const [expandedSubjects, setExpandedSubjects] = useState<
    Record<number, SubjectDetail | null>
  >({});
  const [loadingSubjects, setLoadingSubjects] = useState<Set<number>>(
    new Set(),
  );

  // Create wizard
  const [showCreator, setShowCreator] = useState(false);
  const [showCreatorPicker, setShowCreatorPicker] = useState(false);
  const [creatorContext, setCreatorContext] = useState<{
    board: string;
    classGrade: number;
    subject: string;
  } | null>(null);
  const [pickerForm, setPickerForm] = useState({
    board: "CBSE",
    classGrade: "10",
    subject: "",
  });

  // Clone modal
  const [cloneModal, setCloneModal] = useState<{
    curriculum: CurriculumListItem;
  } | null>(null);
  const [cloneYear, setCloneYear] = useState("");
  const [cloning, setCloning] = useState(false);

  // Chapter edit
  const [chapterEdit, setChapterEdit] = useState<ChapterEditState | null>(null);

  const { toast, ToastContainer } = useToast();

  // Adding chapter
  const [addingChapter, setAddingChapter] = useState<{
    subjectId: number;
    name: string;
    textbook_reference: string;
    marks_weightage: number;
  } | null>(null);
  const [savingNewChapter, setSavingNewChapter] = useState(false);

  // ── Fetch curricula ──

  const fetchCurricula = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await taxonomyAPI.list();
      setCurricula(data.curricula ?? data);
      // Auto-expand all boards
      const boards = new Set<string>(
        data.map((c: CurriculumListItem) => c.board_code),
      );
      setExpandedBoards(boards);
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Failed to load curricula");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurricula();
  }, [fetchCurricula]);

  // ── Group by board ──

  const groupedByBoard = curricula.reduce(
    (acc, c) => {
      const key = c.board_code;
      if (!acc[key]) acc[key] = { name: c.board_name, items: [] };
      acc[key].items.push(c);
      return acc;
    },
    {} as Record<string, { name: string; items: CurriculumListItem[] }>,
  );

  // ── Stats ──

  const totalCurricula = curricula.length;
  const totalSubjects = curricula.reduce(
    (sum, c) => sum + c.subjects.length,
    0,
  );
  const totalChapters = curricula.reduce(
    (sum, c) => sum + c.subjects.reduce((s2, sub) => s2 + sub.chapter_count, 0),
    0,
  );
  const activeCount = curricula.filter((c) => c.is_active).length;

  // ── Subject detail loading ──

  const toggleSubject = async (subjectId: number) => {
    if (expandedSubjects[subjectId] !== undefined) {
      setExpandedSubjects((prev) => {
        const next = { ...prev };
        delete next[subjectId];
        return next;
      });
      return;
    }

    setLoadingSubjects((prev) => new Set(prev).add(subjectId));
    try {
      const { data } = await taxonomyAPI.getSubjectDetail(subjectId);
      setExpandedSubjects((prev) => ({ ...prev, [subjectId]: data }));
    } catch {
      setExpandedSubjects((prev) => ({ ...prev, [subjectId]: null }));
    } finally {
      setLoadingSubjects((prev) => {
        const next = new Set(prev);
        next.delete(subjectId);
        return next;
      });
    }
  };

  // ── Clone handler ──

  const handleClone = async () => {
    if (!cloneModal || !cloneYear.trim()) return;
    setCloning(true);
    try {
      await taxonomyAPI.clone({
        source_curriculum_id: cloneModal.curriculum.id,
        new_academic_year: cloneYear.trim(),
      });
      setCloneModal(null);
      setCloneYear("");
      await fetchCurricula();
    } catch (err: any) {
      toast(err.response?.data?.detail ?? "Clone failed", "error");
    } finally {
      setCloning(false);
    }
  };

  // ── Chapter edit handlers ──

  const startChapterEdit = async (
    chapterId: number,
    chapterName: string,
    field: string,
    currentValue: string,
  ) => {
    setChapterEdit({
      chapterId,
      chapterName,
      field,
      value: currentValue,
      impact: null,
      loadingImpact: true,
      saving: false,
    });

    try {
      const { data } = await taxonomyAPI.analyzeImpact({
        chapter_id: chapterId,
        change_type: field === "name" ? "rename" : "modify",
        new_value: currentValue,
      });
      setChapterEdit((prev) =>
        prev ? { ...prev, impact: data, loadingImpact: false } : null,
      );
    } catch {
      setChapterEdit((prev) =>
        prev ? { ...prev, loadingImpact: false } : null,
      );
    }
  };

  const applyChapterEdit = async () => {
    if (!chapterEdit) return;
    setChapterEdit((prev) => (prev ? { ...prev, saving: true } : null));
    try {
      await taxonomyAPI.updateChapter(chapterEdit.chapterId, {
        [chapterEdit.field]: chapterEdit.value,
        impact_acknowledged: true,
      });
      // Refresh affected subjects
      const affectedSubjectIds = Object.keys(expandedSubjects).map(Number);
      for (const sid of affectedSubjectIds) {
        try {
          const { data } = await taxonomyAPI.getSubjectDetail(sid);
          setExpandedSubjects((prev) => ({ ...prev, [sid]: data }));
        } catch {
          // Ignore -- stale data is fine
        }
      }
      setChapterEdit(null);
    } catch (err: any) {
      toast(err.response?.data?.detail ?? "Update failed", "error");
      setChapterEdit((prev) => (prev ? { ...prev, saving: false } : null));
    }
  };

  const deprecateChapter = async () => {
    if (!chapterEdit) return;
    setChapterEdit((prev) => (prev ? { ...prev, saving: true } : null));
    try {
      await taxonomyAPI.deprecateChapter(chapterEdit.chapterId);
      // Refresh
      const affectedSubjectIds = Object.keys(expandedSubjects).map(Number);
      for (const sid of affectedSubjectIds) {
        try {
          const { data } = await taxonomyAPI.getSubjectDetail(sid);
          setExpandedSubjects((prev) => ({ ...prev, [sid]: data }));
        } catch {
          // Ignore
        }
      }
      setChapterEdit(null);
    } catch (err: any) {
      toast(err.response?.data?.detail ?? "Deprecation failed", "error");
      setChapterEdit((prev) => (prev ? { ...prev, saving: false } : null));
    }
  };

  // ── Add chapter handler ──

  const handleAddChapter = async () => {
    if (!addingChapter || !addingChapter.name.trim()) return;
    setSavingNewChapter(true);
    try {
      await taxonomyAPI.addChapter({
        curriculum_subject_id: addingChapter.subjectId,
        name: addingChapter.name.trim(),
        textbook_reference: addingChapter.textbook_reference || undefined,
        marks_weightage: addingChapter.marks_weightage || undefined,
      });
      // Refresh subject detail
      const { data } = await taxonomyAPI.getSubjectDetail(
        addingChapter.subjectId,
      );
      setExpandedSubjects((prev) => ({
        ...prev,
        [addingChapter.subjectId]: data,
      }));
      setAddingChapter(null);
    } catch (err: any) {
      toast(err.response?.data?.detail ?? "Failed to add chapter", "error");
    } finally {
      setSavingNewChapter(false);
    }
  };

  // ── Creator context (for creating from this page) ──

  const openCreator = () => {
    setShowCreatorPicker(true);
  };

  const launchCreator = () => {
    if (!pickerForm.subject.trim()) return;
    setCreatorContext({
      board: pickerForm.board,
      classGrade: Number(pickerForm.classGrade),
      subject: pickerForm.subject.trim(),
    });
    setShowCreatorPicker(false);
    setShowCreator(true);
  };

  // ── Loading state ──

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ToastContainer />
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display tracking-tight">
            Curriculum Management
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Browse, create, and manage subject taxonomies
          </p>
        </div>
        <Button onClick={openCreator}>
          <Plus className="h-4 w-4 mr-2" />
          Create New Curriculum
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center justify-between">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={fetchCurricula}>
            Retry
          </Button>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          title="Total Curricula"
          value={totalCurricula}
          icon={<Library className="h-5 w-5" />}
        />
        <StatCard
          title="Subjects"
          value={totalSubjects}
          icon={<BookOpen className="h-5 w-5" />}
        />
        <StatCard
          title="Chapters"
          value={totalChapters}
          icon={<Layers className="h-5 w-5" />}
        />
        <StatCard
          title="Active"
          value={`${activeCount}/${totalCurricula}`}
          icon={<GraduationCap className="h-5 w-5" />}
          subtitle={`${totalCurricula - activeCount} inactive`}
        />
      </div>

      {/* Board/Class/Subject Picker before Creator */}
      {showCreatorPicker && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Create New Curriculum</CardTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowCreatorPicker(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription>Select the board, class, and subject for the new curriculum. AI will research the official syllabus and generate a chapter/topic structure.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Board</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={pickerForm.board}
                  onChange={(e) => setPickerForm((f) => ({ ...f, board: e.target.value }))}
                >
                  <option value="CBSE">CBSE</option>
                  <option value="ICSE">ICSE</option>
                  <option value="State Board">State Board</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Class</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={pickerForm.classGrade}
                  onChange={(e) => setPickerForm((f) => ({ ...f, classGrade: e.target.value }))}
                >
                  {[7, 8, 9, 10, 11, 12].map((g) => (
                    <option key={g} value={String(g)}>Class {g}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Subject</label>
              <Input
                placeholder="e.g. Mathematics, Science, English, Social Studies"
                value={pickerForm.subject}
                onChange={(e) => setPickerForm((f) => ({ ...f, subject: e.target.value }))}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Common subjects: Mathematics, Science, English, Social Studies, Hindi, Physics, Chemistry, Biology, Computer Science
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowCreatorPicker(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={launchCreator} disabled={!pickerForm.subject.trim()}>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Generate with AI
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TaxonomyCreator overlay */}
      {showCreator && creatorContext && (
        <TaxonomyCreator
          board={creatorContext.board}
          classGrade={creatorContext.classGrade}
          subject={creatorContext.subject}
          onComplete={() => {
            setShowCreator(false);
            fetchCurricula();
          }}
          onCancel={() => setShowCreator(false)}
        />
      )}

      {/* Clone Modal */}
      {cloneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Clone Curriculum</CardTitle>
                <button
                  onClick={() => {
                    setCloneModal(null);
                    setCloneYear("");
                  }}
                  className="rounded p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <CardDescription>
                Clone{" "}
                <strong>
                  {cloneModal.curriculum.board_name}{" "}
                  {cloneModal.curriculum.academic_year}
                </strong>{" "}
                curriculum as a new version
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">New Academic Year</label>
                <Input
                  placeholder="e.g. 2026-27"
                  value={cloneYear}
                  onChange={(e) => setCloneYear(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  The source curriculum will be set to inactive. The new version
                  will share the same chapters.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCloneModal(null);
                    setCloneYear("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleClone}
                  disabled={!cloneYear.trim() || cloning}
                >
                  {cloning ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Cloning...
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      Clone
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chapter Edit Modal with Impact Analysis */}
      {chapterEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-lg mx-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Edit Chapter: {chapterEdit.chapterName}
                </CardTitle>
                <button
                  onClick={() => setChapterEdit(null)}
                  className="rounded p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium capitalize">
                  {chapterEdit.field}
                </label>
                <Input
                  value={chapterEdit.value}
                  onChange={(e) =>
                    setChapterEdit((prev) =>
                      prev ? { ...prev, value: e.target.value } : null,
                    )
                  }
                />
              </div>

              {chapterEdit.loadingImpact && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing impact...
                </div>
              )}

              {chapterEdit.impact && (
                <ImpactAnalysis
                  impact={chapterEdit.impact}
                  loading={chapterEdit.saving}
                  onProceed={applyChapterEdit}
                  onDeprecate={deprecateChapter}
                  onCancel={() => setChapterEdit(null)}
                />
              )}

              {!chapterEdit.loadingImpact && !chapterEdit.impact && (
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setChapterEdit(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={applyChapterEdit}
                    disabled={chapterEdit.saving}
                  >
                    {chapterEdit.saving ? "Saving..." : "Apply Change"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Curricula List (grouped by board) */}
      {curricula.length === 0 && !showCreator ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Library className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">
              No curricula yet
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Seed data or create with AI to get started
            </p>
            <Button className="mt-4" size="sm" onClick={openCreator}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Create with AI
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedByBoard).map(([boardCode, group]) => (
            <Card key={boardCode}>
              <CardHeader className="pb-3">
                <button
                  className="flex w-full items-center gap-2 text-left"
                  onClick={() =>
                    setExpandedBoards((prev) => {
                      const next = new Set(prev);
                      if (next.has(boardCode)) next.delete(boardCode);
                      else next.add(boardCode);
                      return next;
                    })
                  }
                >
                  {expandedBoards.has(boardCode) ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <Badge variant="default" className="text-xs">
                    {boardCode}
                  </Badge>
                  <CardTitle className="text-base flex-1">
                    {group.name}
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {group.items.length} curriculum
                    {group.items.length !== 1 ? "s" : ""}
                  </span>
                </button>
              </CardHeader>

              {expandedBoards.has(boardCode) && (
                <CardContent className="space-y-3 pt-0">
                  {group.items.map((curriculum) => (
                    <div
                      key={curriculum.id}
                      className="rounded-lg border bg-background p-4 space-y-3"
                    >
                      {/* Curriculum header */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">
                            {curriculum.academic_year}
                          </span>
                          <Badge
                            variant={
                              curriculum.is_active ? "success" : "secondary"
                            }
                            className="text-xs"
                          >
                            {curriculum.is_active ? "Active" : "Inactive"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {curriculum.subjects.length} subject
                            {curriculum.subjects.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs gap-1"
                          onClick={() => {
                            setCloneModal({ curriculum });
                            setCloneYear("");
                          }}
                        >
                          <Copy className="h-3 w-3" />
                          Clone for New Year
                        </Button>
                      </div>

                      {/* Subjects */}
                      <div className="space-y-2">
                        {curriculum.subjects.map((subject) => {
                          const isExpanded =
                            expandedSubjects[subject.id] !== undefined;
                          const subjectDetail = expandedSubjects[subject.id];
                          const isLoading = loadingSubjects.has(subject.id);

                          return (
                            <div key={subject.id} className="rounded-md border">
                              {/* Subject header */}
                              <button
                                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors rounded-md"
                                onClick={() => toggleSubject(subject.id)}
                              >
                                {isLoading ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                                ) : isExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                                <BookOpen className="h-3.5 w-3.5 text-primary" />
                                <span className="text-sm font-medium flex-1">
                                  {subject.name}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  Class {subject.class_grade}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {subject.chapter_count} chapters
                                </span>
                              </button>

                              {/* Subject detail (expanded) */}
                              {isExpanded && subjectDetail && (
                                <div className="border-t px-3 py-2 space-y-2">
                                  {subjectDetail.chapters.map((chapter) => (
                                    <ChapterRow
                                      key={chapter.id}
                                      chapter={chapter}
                                      onEdit={(field, value) =>
                                        startChapterEdit(
                                          chapter.id,
                                          chapter.name,
                                          field,
                                          value,
                                        )
                                      }
                                    />
                                  ))}

                                  {/* Add Chapter */}
                                  {addingChapter?.subjectId ===
                                  subjectDetail.id ? (
                                    <div className="rounded-md border border-dashed p-3 space-y-2">
                                      <Input
                                        placeholder="Chapter name"
                                        value={addingChapter.name}
                                        onChange={(e) =>
                                          setAddingChapter({
                                            ...addingChapter,
                                            name: e.target.value,
                                          })
                                        }
                                        autoFocus
                                      />
                                      <div className="grid grid-cols-2 gap-2">
                                        <Input
                                          placeholder="Textbook reference"
                                          value={
                                            addingChapter.textbook_reference
                                          }
                                          onChange={(e) =>
                                            setAddingChapter({
                                              ...addingChapter,
                                              textbook_reference:
                                                e.target.value,
                                            })
                                          }
                                        />
                                        <Input
                                          type="number"
                                          placeholder="Marks weightage"
                                          value={
                                            addingChapter.marks_weightage || ""
                                          }
                                          onChange={(e) =>
                                            setAddingChapter({
                                              ...addingChapter,
                                              marks_weightage:
                                                Number(e.target.value) || 0,
                                            })
                                          }
                                        />
                                      </div>
                                      <div className="flex gap-2">
                                        <Button
                                          size="sm"
                                          onClick={handleAddChapter}
                                          disabled={
                                            !addingChapter.name.trim() ||
                                            savingNewChapter
                                          }
                                        >
                                          {savingNewChapter
                                            ? "Adding..."
                                            : "Add Chapter"}
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => setAddingChapter(null)}
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      className="flex items-center gap-1.5 text-xs text-primary hover:underline mt-1"
                                      onClick={() =>
                                        setAddingChapter({
                                          subjectId: subjectDetail.id,
                                          name: "",
                                          textbook_reference: "",
                                          marks_weightage: 0,
                                        })
                                      }
                                    >
                                      <Plus className="h-3 w-3" />
                                      Add Chapter
                                    </button>
                                  )}
                                </div>
                              )}

                              {/* Loading state for subject detail */}
                              {isExpanded && !subjectDetail && !isLoading && (
                                <div className="border-t px-3 py-4 text-center text-xs text-muted-foreground">
                                  Failed to load subject detail
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Chapter row in subject detail ──

function ChapterRow({
  chapter,
  onEdit,
}: {
  chapter: SubjectChapter;
  onEdit: (field: string, value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-md border bg-card">
      <div className="group flex items-center gap-2 px-3 py-2">
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

        <span className="text-xs font-medium text-muted-foreground shrink-0">
          Ch {chapter.number}
        </span>

        <span className="text-sm font-medium flex-1 truncate">
          {chapter.name}
        </span>

        {chapter.textbook_reference && (
          <span className="hidden sm:inline text-xs text-muted-foreground truncate max-w-[150px]">
            {chapter.textbook_reference}
          </span>
        )}

        {chapter.marks_weightage != null && chapter.marks_weightage > 0 && (
          <Badge variant="outline" className="text-xs shrink-0">
            {chapter.marks_weightage}m
          </Badge>
        )}

        <span className="text-xs text-muted-foreground shrink-0">
          {chapter.topics.length} topics
        </span>

        <button
          className="hidden shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-foreground group-hover:inline-flex"
          onClick={(e) => {
            e.stopPropagation();
            onEdit("name", chapter.name);
          }}
          aria-label={`Edit ${chapter.name}`}
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>

      {expanded && (
        <div className="border-t px-4 py-2 space-y-1.5">
          {chapter.topics.length === 0 ? (
            <p className="text-xs text-muted-foreground py-1">No topics</p>
          ) : (
            chapter.topics.map((topic) => (
              <div key={topic.id} className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-primary shrink-0" />
                  <span className="text-xs font-medium">{topic.name}</span>
                </div>
                {topic.learning_outcomes.length > 0 && (
                  <div className="ml-3 space-y-0.5">
                    {topic.learning_outcomes.map((lo) => (
                      <div
                        key={lo.id}
                        className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
                      >
                        {lo.bloom_level && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[9px] px-1 py-0 h-4",
                              lo.bloom_level === "Remember" &&
                                "border-blue-300 text-blue-600 dark:border-blue-800 dark:text-blue-400",
                              lo.bloom_level === "Understand" &&
                                "border-teal-300 text-teal-600 dark:border-teal-800 dark:text-teal-400",
                              lo.bloom_level === "Apply" &&
                                "border-green-300 text-green-600 dark:border-green-800 dark:text-green-400",
                              lo.bloom_level === "Analyze" &&
                                "border-amber-300 text-amber-600 dark:border-amber-800 dark:text-amber-400",
                              lo.bloom_level === "Evaluate" &&
                                "border-orange-300 text-orange-600 dark:border-orange-800 dark:text-orange-400",
                              lo.bloom_level === "Create" &&
                                "border-red-300 text-red-600 dark:border-red-800 dark:text-red-400",
                            )}
                          >
                            {lo.bloom_level}
                          </Badge>
                        )}
                        <span className="truncate">{lo.description}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default TaxonomyManager;
