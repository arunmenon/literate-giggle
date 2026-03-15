import React, { useEffect, useState, useCallback, useRef } from "react";
import { questionAPI } from "../services/api";
import type { CurriculumSelection, ChapterDetail } from "../types";
import { Select, Input, Badge } from "./ui";
import { cn } from "../lib/utils";
import { BookOpen, Layers, XCircle } from "lucide-react";

interface CurriculumPickerProps {
  onSelectionChange: (selection: CurriculumSelection) => void;
  showTopicFilter?: boolean;
  defaultBoard?: string;
  defaultClass?: number;
  className?: string;
}

interface CurriculumData {
  boards: string[];
  classes: number[];
  subjects: string[];
  chapters: string[];
  chapterDetail: ChapterDetail | null;
}

function CurriculumPicker({
  onSelectionChange,
  showTopicFilter = false,
  defaultBoard,
  defaultClass,
  className,
}: CurriculumPickerProps) {
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;

  const [board, setBoard] = useState(defaultBoard || "");
  const [classGrade, setClassGrade] = useState<number | "">(defaultClass || "");
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);

  // Free-text fallbacks when API returns empty
  const [freeTextSubject, setFreeTextSubject] = useState("");
  const [freeTextChapter, setFreeTextChapter] = useState("");
  const [useFreeTextSubject, setUseFreeTextSubject] = useState(false);
  const [useFreeTextChapter, setUseFreeTextChapter] = useState(false);

  const [data, setData] = useState<CurriculumData>({
    boards: [],
    classes: [],
    subjects: [],
    chapters: [],
    chapterDetail: null,
  });

  const [loading, setLoading] = useState({
    boards: true,
    classes: false,
    subjects: false,
    chapters: false,
    detail: false,
  });

  // Fetch boards on mount
  useEffect(() => {
    setLoading((prev) => ({ ...prev, boards: true }));
    questionAPI
      .getCurriculum()
      .then((res) => {
        const payload = res.data;
        const boards = payload.boards || payload.data || payload || [];
        setData((prev) => ({
          ...prev,
          boards: Array.isArray(boards) ? boards : [],
        }));
      })
      .catch(() => {
        // Fallback boards if API isn't ready
        setData((prev) => ({
          ...prev,
          boards: ["CBSE", "ICSE", "State Board"],
        }));
      })
      .finally(() => setLoading((prev) => ({ ...prev, boards: false })));
  }, []);

  // Fetch classes when board changes
  useEffect(() => {
    if (!board) {
      setData((prev) => ({
        ...prev,
        classes: [],
        subjects: [],
        chapters: [],
        chapterDetail: null,
      }));
      return;
    }
    setLoading((prev) => ({ ...prev, classes: true }));
    setClassGrade("");
    setSubject("");
    setChapter("");
    setSelectedTopics([]);
    setUseFreeTextSubject(false);
    setUseFreeTextChapter(false);

    questionAPI
      .getCurriculum({ board })
      .then((res) => {
        const payload = res.data;
        const classes = payload.classes || payload.data || payload || [];
        setData((prev) => ({
          ...prev,
          classes: Array.isArray(classes) ? classes : [],
          subjects: [],
          chapters: [],
          chapterDetail: null,
        }));
      })
      .catch(() => {
        setData((prev) => ({
          ...prev,
          classes: [7, 8, 9, 10, 11, 12],
          subjects: [],
          chapters: [],
          chapterDetail: null,
        }));
      })
      .finally(() => setLoading((prev) => ({ ...prev, classes: false })));
  }, [board]);

  // Fetch subjects when class changes
  useEffect(() => {
    if (!board || !classGrade) {
      setData((prev) => ({
        ...prev,
        subjects: [],
        chapters: [],
        chapterDetail: null,
      }));
      return;
    }
    setLoading((prev) => ({ ...prev, subjects: true }));
    setSubject("");
    setChapter("");
    setSelectedTopics([]);
    setUseFreeTextSubject(false);
    setUseFreeTextChapter(false);

    questionAPI
      .getCurriculum({ board, class_grade: classGrade })
      .then((res) => {
        const payload = res.data;
        const subjects = payload.subjects || payload.data || payload || [];
        const subjectArr = Array.isArray(subjects) ? subjects : [];
        setUseFreeTextSubject(subjectArr.length === 0);
        setData((prev) => ({
          ...prev,
          subjects: subjectArr,
          chapters: [],
          chapterDetail: null,
        }));
      })
      .catch(() => {
        setUseFreeTextSubject(true);
        setData((prev) => ({
          ...prev,
          subjects: [],
          chapters: [],
          chapterDetail: null,
        }));
      })
      .finally(() => setLoading((prev) => ({ ...prev, subjects: false })));
  }, [board, classGrade]);

  // Fetch chapters when subject changes
  useEffect(() => {
    const activeSubject = useFreeTextSubject ? freeTextSubject : subject;
    if (!board || !classGrade || !activeSubject) {
      setData((prev) => ({ ...prev, chapters: [], chapterDetail: null }));
      return;
    }
    setLoading((prev) => ({ ...prev, chapters: true }));
    setChapter("");
    setSelectedTopics([]);
    setUseFreeTextChapter(false);

    questionAPI
      .getCurriculum({
        board,
        class_grade: classGrade,
        subject: activeSubject,
      })
      .then((res) => {
        const payload = res.data;
        const chapters = payload.chapters || payload.data || payload || [];
        const chapterArr = Array.isArray(chapters)
          ? chapters.map((ch: any) => (typeof ch === "string" ? ch : ch.name))
          : [];
        setUseFreeTextChapter(chapterArr.length === 0);
        setData((prev) => ({
          ...prev,
          chapters: chapterArr,
          chapterDetail: null,
        }));
      })
      .catch(() => {
        setUseFreeTextChapter(true);
        setData((prev) => ({
          ...prev,
          chapters: [],
          chapterDetail: null,
        }));
      })
      .finally(() => setLoading((prev) => ({ ...prev, chapters: false })));
  }, [board, classGrade, subject, freeTextSubject, useFreeTextSubject]);

  // Fetch chapter detail when chapter changes
  useEffect(() => {
    const activeSubject = useFreeTextSubject ? freeTextSubject : subject;
    const activeChapter = useFreeTextChapter ? freeTextChapter : chapter;
    if (!board || !classGrade || !activeSubject || !activeChapter) {
      setData((prev) => ({ ...prev, chapterDetail: null }));
      return;
    }
    setLoading((prev) => ({ ...prev, detail: true }));
    setSelectedTopics([]);

    questionAPI
      .getCurriculum({
        board,
        class_grade: classGrade,
        subject: activeSubject,
        chapter: activeChapter,
      })
      .then((res) => {
        const payload = res.data;
        const detail =
          payload.chapter_detail || payload.data || payload || null;
        // Normalize: API returns { name, textbook_ref, topics, ... }
        // CurriculumPicker expects { chapter_name, textbook_ref, topics }
        const normalized = detail
          ? {
              ...detail,
              chapter_name: detail.chapter_name || detail.name || activeChapter,
            }
          : null;
        setData((prev) => ({ ...prev, chapterDetail: normalized }));
      })
      .catch(() => {
        setData((prev) => ({ ...prev, chapterDetail: null }));
      })
      .finally(() => setLoading((prev) => ({ ...prev, detail: false })));
  }, [
    board,
    classGrade,
    subject,
    chapter,
    freeTextSubject,
    freeTextChapter,
    useFreeTextSubject,
    useFreeTextChapter,
  ]);

  // Emit selection changes
  const emitSelection = useCallback(() => {
    const activeSubject = useFreeTextSubject ? freeTextSubject : subject;
    const activeChapter = useFreeTextChapter ? freeTextChapter : chapter;
    if (board && classGrade && activeSubject && activeChapter) {
      onSelectionChangeRef.current({
        board,
        class_grade: classGrade as number,
        subject: activeSubject,
        chapter: activeChapter,
        topics: selectedTopics.length > 0 ? selectedTopics : undefined,
      });
    }
  }, [
    board,
    classGrade,
    subject,
    chapter,
    freeTextSubject,
    freeTextChapter,
    useFreeTextSubject,
    useFreeTextChapter,
    selectedTopics,
  ]);

  useEffect(() => {
    emitSelection();
  }, [emitSelection]);

  const toggleTopic = (topic: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic],
    );
  };

  const activeSubject = useFreeTextSubject ? freeTextSubject : subject;
  const activeChapter = useFreeTextChapter ? freeTextChapter : chapter;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Cascading Dropdowns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Board */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Board
          </label>
          {loading.boards ? (
            <div className="h-10 rounded-md border border-input bg-muted animate-pulse" />
          ) : (
            <Select
              value={board}
              onChange={(e) => setBoard(e.target.value)}
              placeholder="Select board"
              options={data.boards.map((b) => ({ value: b, label: b }))}
            />
          )}
        </div>

        {/* Class */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Class
          </label>
          {loading.classes ? (
            <div className="h-10 rounded-md border border-input bg-muted animate-pulse" />
          ) : (
            <Select
              value={classGrade ? String(classGrade) : ""}
              onChange={(e) => setClassGrade(Number(e.target.value))}
              placeholder="Select class"
              options={data.classes.map((c) => ({
                value: String(c),
                label: `Class ${c}`,
              }))}
              disabled={!board}
            />
          )}
        </div>

        {/* Subject */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Subject
          </label>
          {loading.subjects ? (
            <div className="h-10 rounded-md border border-input bg-muted animate-pulse" />
          ) : useFreeTextSubject ? (
            <Input
              placeholder="Enter subject"
              value={freeTextSubject}
              onChange={(e) => setFreeTextSubject(e.target.value)}
              disabled={!board || !classGrade}
            />
          ) : (
            <Select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Select subject"
              options={data.subjects.map((s) => ({ value: s, label: s }))}
              disabled={!board || !classGrade}
            />
          )}
        </div>

        {/* Chapter */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Chapter
          </label>
          {loading.chapters ? (
            <div className="h-10 rounded-md border border-input bg-muted animate-pulse" />
          ) : useFreeTextChapter ? (
            <Input
              placeholder="Enter chapter"
              value={freeTextChapter}
              onChange={(e) => setFreeTextChapter(e.target.value)}
              disabled={!board || !classGrade || !activeSubject}
            />
          ) : (
            <Select
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              placeholder="Select chapter"
              options={data.chapters.map((ch) => ({ value: ch, label: ch }))}
              disabled={!board || !classGrade || !activeSubject}
            />
          )}
        </div>
      </div>

      {/* Chapter Info Chip */}
      {data.chapterDetail && activeChapter && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 dark:bg-primary/10 px-3 py-2 text-sm">
            <BookOpen className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="font-medium text-foreground">
              {data.chapterDetail.chapter_name || activeChapter}
            </span>
            {data.chapterDetail.textbook_ref && (
              <span className="text-muted-foreground">
                -- {data.chapterDetail.textbook_ref}
              </span>
            )}
            {data.chapterDetail.topics && (
              <Badge variant="secondary" className="ml-1">
                <Layers className="h-3 w-3 mr-1" />
                {data.chapterDetail.topics.length} topics
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Topic Multi-Select (Expert Mode) */}
      {showTopicFilter &&
        data.chapterDetail?.topics &&
        data.chapterDetail.topics.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Filter by Topics
              </label>
              {selectedTopics.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedTopics([])}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  <XCircle className="h-3 w-3" />
                  Clear ({selectedTopics.length})
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {data.chapterDetail.topics.map((topic) => {
                const isSelected = selectedTopics.includes(topic);
                return (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => toggleTopic(topic)}
                    className={cn(
                      "inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs font-medium transition-all cursor-pointer",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    {topic}
                  </button>
                );
              })}
            </div>
          </div>
        )}
    </div>
  );
}

export { CurriculumPicker };
export type { CurriculumPickerProps };
