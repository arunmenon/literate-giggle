import React, { useState, useEffect, useCallback } from "react";
import { classAPI, paperAPI } from "../services/api";
import { useAuth } from "../store/AuthContext";
import type { ClassGroup, Enrollment, ExamAssignment } from "../types";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Input,
  Select,
  Badge,
  Skeleton,
} from "../components/ui";
import {
  Plus,
  Users,
  BookOpen,
  ClipboardList,
  ArrowLeft,
  Trash2,
  UserPlus,
  Calendar,
  GraduationCap,
} from "lucide-react";
import { cn } from "../lib/utils";

type View = "list" | "create" | "detail";

const GRADES = Array.from({ length: 6 }, (_, i) => ({
  value: String(i + 7),
  label: `Class ${i + 7}`,
}));
const SECTIONS = ["A", "B", "C", "D"].map((s) => ({ value: s, label: s }));
const CURRENT_YEAR = new Date().getFullYear();
const ACADEMIC_YEARS = [
  {
    value: `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`,
    label: `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`,
  },
  {
    value: `${CURRENT_YEAR - 1}-${CURRENT_YEAR}`,
    label: `${CURRENT_YEAR - 1}-${CURRENT_YEAR}`,
  },
];

const ClassManagement: React.FC = () => {
  const { workspaceName } = useAuth();
  const [view, setView] = useState<View>("list");
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Selected class for detail view
  const [selectedClass, setSelectedClass] = useState<ClassGroup | null>(null);
  const [students, setStudents] = useState<Enrollment[]>([]);
  const [assignments, setAssignments] = useState<ExamAssignment[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Create class form
  const [createForm, setCreateForm] = useState({
    name: "",
    grade: "10",
    section: "A",
    subject: "",
    academic_year: ACADEMIC_YEARS[0].value,
  });
  const [createLoading, setCreateLoading] = useState(false);

  // Enroll student form
  const [enrollEmail, setEnrollEmail] = useState("");
  const [enrollLoading, setEnrollLoading] = useState(false);

  // Assign exam form
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [papers, setPapers] = useState<Array<{ id: number; title: string }>>(
    [],
  );
  const [assignForm, setAssignForm] = useState({
    paper_id: "",
    label: "",
    start_at: "",
    end_at: "",
    is_practice: false,
  });
  const [assignLoading, setAssignLoading] = useState(false);

  const loadClasses = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await classAPI.list();
      setClasses(data);
    } catch {
      setError("Failed to load classes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  const loadClassDetail = async (cls: ClassGroup) => {
    setSelectedClass(cls);
    setView("detail");
    setDetailLoading(true);
    try {
      const [studentsRes, assignmentsRes] = await Promise.all([
        classAPI.getStudents(cls.id),
        classAPI.getAssignments(cls.id),
      ]);
      setStudents(studentsRes.data);
      setAssignments(assignmentsRes.data);
    } catch {
      setError("Failed to load class details");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setCreateLoading(true);
    try {
      await classAPI.create({
        name:
          createForm.name.trim() ||
          `Class ${createForm.grade}-${createForm.section}`,
        grade: Number(createForm.grade),
        section: createForm.section,
        subject: createForm.subject.trim() || undefined,
        academic_year: createForm.academic_year,
      });
      setCreateForm({
        name: "",
        grade: "10",
        section: "A",
        subject: "",
        academic_year: ACADEMIC_YEARS[0].value,
      });
      setView("list");
      await loadClasses();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to create class");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass || !enrollEmail.trim()) return;
    setError("");
    setEnrollLoading(true);
    try {
      await classAPI.enrollStudent(selectedClass.id, {
        email: enrollEmail.trim(),
      });
      setEnrollEmail("");
      const { data } = await classAPI.getStudents(selectedClass.id);
      setStudents(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to enroll student");
    } finally {
      setEnrollLoading(false);
    }
  };

  const handleRemoveStudent = async (studentId: number) => {
    if (!selectedClass) return;
    setError("");
    try {
      await classAPI.removeStudent(selectedClass.id, studentId);
      setStudents((prev) => prev.filter((s) => s.student_id !== studentId));
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to remove student");
    }
  };

  const handleAssignExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass || !assignForm.paper_id) return;
    setError("");
    setAssignLoading(true);
    try {
      await classAPI.assignExam(selectedClass.id, {
        paper_id: Number(assignForm.paper_id),
        label: assignForm.label.trim() || undefined,
        start_at: assignForm.start_at || undefined,
        end_at: assignForm.end_at || undefined,
        is_practice: assignForm.is_practice,
      });
      setAssignForm({
        paper_id: "",
        label: "",
        start_at: "",
        end_at: "",
        is_practice: false,
      });
      setShowAssignForm(false);
      const { data } = await classAPI.getAssignments(selectedClass.id);
      setAssignments(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to assign exam");
    } finally {
      setAssignLoading(false);
    }
  };

  const openAssignForm = async () => {
    setShowAssignForm(true);
    try {
      const { data } = await paperAPI.list({ status: "published" });
      setPapers(
        (data.papers || data || []).map((p: any) => ({
          id: p.id,
          title: p.title,
        })),
      );
    } catch {
      setPapers([]);
    }
  };

  // Detail view
  if (view === "detail" && selectedClass) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setView("list");
              setSelectedClass(null);
              setError("");
            }}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {selectedClass.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              Grade {selectedClass.grade}
              {selectedClass.section && ` - Section ${selectedClass.section}`}
              {selectedClass.subject && ` | ${selectedClass.subject}`}
              {" | "}
              {selectedClass.academic_year}
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {detailLoading ? (
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Students section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">
                      Students ({students.length})
                    </CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleEnrollStudent} className="flex gap-2">
                  <Input
                    placeholder="Student email"
                    value={enrollEmail}
                    onChange={(e) => setEnrollEmail(e.target.value)}
                    type="email"
                    className="flex-1"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={enrollLoading || !enrollEmail.trim()}
                  >
                    <UserPlus className="mr-1 h-4 w-4" />
                    {enrollLoading ? "Adding..." : "Add"}
                  </Button>
                </form>

                {students.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No students enrolled yet. Add students by email above.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {students.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between rounded-md border px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {(s.student_name || "S").charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm">
                            {s.student_name || `Student #${s.student_id}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {!s.is_active && (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveStudent(s.student_id)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            aria-label={`Remove ${s.student_name || "student"}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Exam assignments section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">
                      Exam Assignments ({assignments.length})
                    </CardTitle>
                  </div>
                  {!showAssignForm && (
                    <Button size="sm" onClick={openAssignForm}>
                      <Plus className="mr-1 h-4 w-4" />
                      Assign
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {showAssignForm && (
                  <form
                    onSubmit={handleAssignExam}
                    className="space-y-3 rounded-md border bg-muted/30 p-3"
                  >
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">
                        Paper
                      </label>
                      {papers.length > 0 ? (
                        <Select
                          options={papers.map((p) => ({
                            value: String(p.id),
                            label: p.title,
                          }))}
                          placeholder="Select a paper"
                          value={assignForm.paper_id}
                          onChange={(e) =>
                            setAssignForm((f) => ({
                              ...f,
                              paper_id: e.target.value,
                            }))
                          }
                        />
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          No published papers available
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">
                        Label (optional)
                      </label>
                      <Input
                        placeholder="e.g. Unit Test 1, Retake"
                        value={assignForm.label}
                        onChange={(e) =>
                          setAssignForm((f) => ({
                            ...f,
                            label: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">
                          Start (optional)
                        </label>
                        <Input
                          type="datetime-local"
                          value={assignForm.start_at}
                          onChange={(e) =>
                            setAssignForm((f) => ({
                              ...f,
                              start_at: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">
                          End (optional)
                        </label>
                        <Input
                          type="datetime-local"
                          value={assignForm.end_at}
                          onChange={(e) =>
                            setAssignForm((f) => ({
                              ...f,
                              end_at: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={assignForm.is_practice}
                        onChange={(e) =>
                          setAssignForm((f) => ({
                            ...f,
                            is_practice: e.target.checked,
                          }))
                        }
                        className="rounded border-input"
                      />
                      Practice exam (no grading)
                    </label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAssignForm(false)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={assignLoading || !assignForm.paper_id}
                        className="flex-1"
                      >
                        {assignLoading ? "Assigning..." : "Assign Exam"}
                      </Button>
                    </div>
                  </form>
                )}

                {assignments.length === 0 && !showAssignForm ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No exams assigned yet. Click "Assign" to add one.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {assignments.map((a) => (
                      <div key={a.id} className="rounded-md border px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {a.paper_title || `Paper #${a.paper_id}`}
                          </span>
                          <Badge
                            variant={
                              a.status === "active"
                                ? "success"
                                : a.status === "draft"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {a.status}
                          </Badge>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {a.label && <span>{a.label}</span>}
                          {a.is_practice && (
                            <Badge variant="outline" className="text-xs">
                              Practice
                            </Badge>
                          )}
                          {a.start_at && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(a.start_at).toLocaleDateString()}
                            </span>
                          )}
                          {a.end_at && (
                            <span>
                              - {new Date(a.end_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );
  }

  // Create class form
  if (view === "create") {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setView("list");
              setError("");
            }}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Create Class</h1>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleCreateClass} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Class Name
                </label>
                <Input
                  placeholder="e.g. Class 10-A Mathematics"
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, name: e.target.value }))
                  }
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to auto-generate from grade and section
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Grade
                  </label>
                  <Select
                    options={GRADES}
                    value={createForm.grade}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, grade: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Section
                  </label>
                  <Select
                    options={SECTIONS}
                    value={createForm.section}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        section: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Subject (optional)
                </label>
                <Input
                  placeholder="e.g. Mathematics, Science"
                  value={createForm.subject}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, subject: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Academic Year
                </label>
                <Select
                  options={ACADEMIC_YEARS}
                  value={createForm.academic_year}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      academic_year: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setView("list");
                    setError("");
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createLoading}
                  className="flex-1"
                >
                  {createLoading ? "Creating..." : "Create Class"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Class list view (default)
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Classes</h1>
          {workspaceName && (
            <p className="text-sm text-muted-foreground">{workspaceName}</p>
          )}
        </div>
        <Button onClick={() => setView("create")} className="gap-2">
          <Plus className="h-4 w-4" />
          New Class
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : classes.length === 0 ? (
        <Card className="py-12 text-center">
          <CardContent>
            <GraduationCap className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-lg font-medium text-foreground">
              No classes yet
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first class to start enrolling students and assigning
              exams.
            </p>
            <Button onClick={() => setView("create")} className="mt-4 gap-2">
              <Plus className="h-4 w-4" />
              Create Your First Class
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls) => (
            <Card
              key={cls.id}
              className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg"
              onClick={() => loadClassDetail(cls)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && loadClassDetail(cls)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{cls.name}</CardTitle>
                  {cls.subject && (
                    <Badge variant="secondary">{cls.subject}</Badge>
                  )}
                </div>
                <CardDescription>
                  Grade {cls.grade}
                  {cls.section && `, Section ${cls.section}`}
                  {" | "}
                  {cls.academic_year}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {cls.student_count ?? 0} students
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClassManagement;
