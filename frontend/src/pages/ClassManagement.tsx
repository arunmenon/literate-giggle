import React, { useState, useEffect, useCallback, useRef } from "react";
import { classAPI, paperAPI } from "../services/api";
import { useAuth } from "../store/AuthContext";
import type {
  ClassGroup,
  Enrollment,
  ExamAssignment,
  PaginatedEnrollmentResponse,
  BulkEnrollResult,
  ImportResult,
  InviteLinkResponse,
} from "../types";
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
  Textarea,
  useToast,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
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
  Share2,
  Copy,
  QrCode,
  RefreshCw,
  Download,
  MessageCircle,
  Link,
  ToggleLeft,
  ToggleRight,
  FolderInput,
  Search,
  ChevronLeft,
  ChevronRight,
  Check,
  Upload,
  FileSpreadsheet,
  Mail,
  X,
  ArrowUpDown,
  LinkIcon,
  Clock,
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

  // Share & enrollment
  const { toast, ToastContainer } = useToast();
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [regeneratingCode, setRegeneratingCode] = useState(false);
  const [togglingCode, setTogglingCode] = useState(false);
  const [showCopyRoster, setShowCopyRoster] = useState(false);
  const [copyRosterSourceId, setCopyRosterSourceId] = useState("");
  const [copyingRoster, setCopyingRoster] = useState(false);

  // Roster pagination, search, sort
  const [rosterPage, setRosterPage] = useState(1);
  const [rosterPerPage, setRosterPerPage] = useState(25);
  const [rosterSearch, setRosterSearch] = useState("");
  const [rosterSortBy, setRosterSortBy] = useState("name");
  const [rosterSortOrder, setRosterSortOrder] = useState<"asc" | "desc">("asc");
  const [rosterTotal, setRosterTotal] = useState(0);
  const [rosterTotalPages, setRosterTotalPages] = useState(0);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bulk selection
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<number>>(new Set());
  const [bulkRemoving, setBulkRemoving] = useState(false);

  // Import modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importMode, setImportMode] = useState<"file" | "email">("file");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importEmails, setImportEmails] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<BulkEnrollResult | ImportResult | null>(null);

  // Invite link
  const [inviteLink, setInviteLink] = useState<InviteLinkResponse | null>(null);
  const [generatingInviteLink, setGeneratingInviteLink] = useState(false);

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

  const loadStudents = useCallback(
    async (
      classId: number,
      page = 1,
      perPage = 25,
      search = "",
      sortBy = "name",
      sortOrder = "asc",
    ) => {
      try {
        const { data } = await classAPI.getStudentsPaginated(classId, {
          page,
          per_page: perPage,
          search: search || undefined,
          sort_by: sortBy,
          sort_order: sortOrder,
        });
        // Handle paginated wrapper response
        const paginated = data as PaginatedEnrollmentResponse;
        setStudents(paginated.students);
        setRosterTotal(paginated.total);
        setRosterTotalPages(paginated.total_pages);
      } catch {
        // Fallback: try legacy flat array response
        try {
          const { data } = await classAPI.getStudents(classId);
          const arr = Array.isArray(data) ? data : (data as any).students || [];
          setStudents(arr);
          setRosterTotal(arr.length);
          setRosterTotalPages(1);
        } catch {
          setStudents([]);
          setRosterTotal(0);
          setRosterTotalPages(0);
        }
      }
    },
    [],
  );

  const loadClassDetail = async (cls: ClassGroup) => {
    setSelectedClass(cls);
    setView("detail");
    setDetailLoading(true);
    setQrCodeUrl(null);
    setSelectedStudentIds(new Set());
    setRosterPage(1);
    setRosterSearch("");
    setRosterSortBy("name");
    setRosterSortOrder("asc");
    setInviteLink(null);
    try {
      const [, assignmentsRes] = await Promise.all([
        loadStudents(cls.id, 1, rosterPerPage, "", "name", "asc"),
        classAPI.getAssignments(cls.id),
      ]);
      setAssignments(assignmentsRes.data);
      // Load QR code
      if (cls.join_code) {
        try {
          const qrRes = await classAPI.getQRCode(cls.id, 200);
          const url = URL.createObjectURL(qrRes.data);
          setQrCodeUrl(url);
        } catch {
          // QR code is optional, don't block on failure
        }
      }
    } catch {
      setError("Failed to load class details");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCopyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${label} copied to clipboard`, "success");
    } catch {
      toast("Failed to copy to clipboard", "error");
    }
  };

  const joinUrl = selectedClass?.join_code
    ? `${window.location.origin}/join/${selectedClass.join_code}`
    : "";

  const whatsAppMessage = selectedClass
    ? `Join my class "${selectedClass.name}" on ExamIQ!\n\nUse code: ${selectedClass.join_code}\nOr click: ${joinUrl}`
    : "";

  const handleWhatsAppShare = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(whatsAppMessage)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleDownloadQR = async () => {
    if (!selectedClass) return;
    try {
      const res = await classAPI.getQRCode(selectedClass.id, 400);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedClass.name}-qr-code.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast("Failed to download QR code", "error");
    }
  };

  const handleRegenerateCode = async () => {
    if (!selectedClass) return;
    setRegeneratingCode(true);
    try {
      const { data } = await classAPI.regenerateCode(selectedClass.id);
      setSelectedClass((prev) =>
        prev ? { ...prev, join_code: data.join_code, join_code_active: data.join_code_active } : prev,
      );
      // Reload QR code
      try {
        const qrRes = await classAPI.getQRCode(selectedClass.id, 200);
        const url = URL.createObjectURL(qrRes.data);
        setQrCodeUrl(url);
      } catch { /* optional */ }
      toast("Join code regenerated", "success");
    } catch (err: any) {
      toast(err.response?.data?.detail || "Failed to regenerate code", "error");
    } finally {
      setRegeneratingCode(false);
    }
  };

  const handleToggleCode = async () => {
    if (!selectedClass) return;
    const newActive = !selectedClass.join_code_active;
    setTogglingCode(true);
    try {
      await classAPI.toggleJoinCode(selectedClass.id, newActive);
      setSelectedClass((prev) =>
        prev ? { ...prev, join_code_active: newActive } : prev,
      );
      toast(newActive ? "Join code activated" : "Join code deactivated", "success");
    } catch (err: any) {
      toast(err.response?.data?.detail || "Failed to toggle join code", "error");
    } finally {
      setTogglingCode(false);
    }
  };

  const handleCopyRoster = async () => {
    if (!selectedClass || !copyRosterSourceId) return;
    setCopyingRoster(true);
    try {
      const { data } = await classAPI.copyRoster(selectedClass.id, {
        source_class_id: Number(copyRosterSourceId),
      });
      toast(`Imported ${data.copied} students (${data.skipped} already enrolled)`, "success");
      setCopyRosterSourceId("");
      setShowCopyRoster(false);
      // Refresh students list
      await loadStudents(
        selectedClass.id,
        rosterPage,
        rosterPerPage,
        rosterSearch,
        rosterSortBy,
        rosterSortOrder,
      );
    } catch (err: any) {
      toast(err.response?.data?.detail || "Failed to copy roster", "error");
    } finally {
      setCopyingRoster(false);
    }
  };

  // Debounced search
  const handleSearchChange = (value: string) => {
    setRosterSearch(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      if (selectedClass) {
        setRosterPage(1);
        setSelectedStudentIds(new Set());
        loadStudents(selectedClass.id, 1, rosterPerPage, value, rosterSortBy, rosterSortOrder);
      }
    }, 300);
  };

  const handleSortChange = (sortBy: string) => {
    const newOrder = sortBy === rosterSortBy && rosterSortOrder === "asc" ? "desc" : "asc";
    setRosterSortBy(sortBy);
    setRosterSortOrder(newOrder);
    setRosterPage(1);
    setSelectedStudentIds(new Set());
    if (selectedClass) {
      loadStudents(selectedClass.id, 1, rosterPerPage, rosterSearch, sortBy, newOrder);
    }
  };

  const handlePageChange = (page: number) => {
    setRosterPage(page);
    setSelectedStudentIds(new Set());
    if (selectedClass) {
      loadStudents(selectedClass.id, page, rosterPerPage, rosterSearch, rosterSortBy, rosterSortOrder);
    }
  };

  const handlePerPageChange = (perPage: number) => {
    setRosterPerPage(perPage);
    setRosterPage(1);
    setSelectedStudentIds(new Set());
    if (selectedClass) {
      loadStudents(selectedClass.id, 1, perPage, rosterSearch, rosterSortBy, rosterSortOrder);
    }
  };

  // Bulk selection
  const handleToggleStudent = (studentId: number) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const handleToggleAll = () => {
    if (selectedStudentIds.size === students.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(students.map((s) => s.student_id)));
    }
  };

  const handleBulkRemove = async () => {
    if (!selectedClass || selectedStudentIds.size === 0) return;
    setBulkRemoving(true);
    try {
      const promises = Array.from(selectedStudentIds).map((sid) =>
        classAPI.removeStudent(selectedClass.id, sid),
      );
      await Promise.all(promises);
      toast(`Removed ${selectedStudentIds.size} student(s)`, "success");
      setSelectedStudentIds(new Set());
      await loadStudents(
        selectedClass.id,
        rosterPage,
        rosterPerPage,
        rosterSearch,
        rosterSortBy,
        rosterSortOrder,
      );
    } catch {
      toast("Failed to remove some students", "error");
    } finally {
      setBulkRemoving(false);
    }
  };

  // Import modal handlers
  const handleImport = async () => {
    if (!selectedClass) return;
    setImportLoading(true);
    setImportResult(null);
    try {
      if (importMode === "file" && importFile) {
        const formData = new FormData();
        formData.append("file", importFile);
        const { data } = await classAPI.importStudents(selectedClass.id, formData);
        setImportResult(data);
        toast(`Imported ${data.enrolled} student(s)`, "success");
      } else if (importMode === "email" && importEmails.trim()) {
        const emails = importEmails
          .split("\n")
          .map((e) => e.trim())
          .filter((e) => e.length > 0);
        const { data } = await classAPI.bulkEnroll(selectedClass.id, {
          emails,
          skip_unregistered: true,
        });
        setImportResult(data);
        toast(`Enrolled ${data.enrolled.length} student(s)`, "success");
      }
      await loadStudents(
        selectedClass.id,
        rosterPage,
        rosterPerPage,
        rosterSearch,
        rosterSortBy,
        rosterSortOrder,
      );
    } catch (err: any) {
      toast(err.response?.data?.detail || "Import failed", "error");
    } finally {
      setImportLoading(false);
    }
  };

  const resetImportModal = () => {
    setImportFile(null);
    setImportEmails("");
    setImportResult(null);
    setImportMode("file");
  };

  // Invite link
  const handleGenerateInviteLink = async () => {
    if (!selectedClass) return;
    setGeneratingInviteLink(true);
    try {
      const { data } = await classAPI.generateInviteLink(selectedClass.id, {
        expires_in_hours: 72,
      });
      setInviteLink(data);
      toast("Invite link generated", "success");
    } catch (err: any) {
      toast(err.response?.data?.detail || "Failed to generate invite link", "error");
    } finally {
      setGeneratingInviteLink(false);
    }
  };

  // Compute active/inactive counts
  const activeCount = students.filter((s) => s.is_active).length;
  const inactiveCount = students.filter((s) => !s.is_active).length;

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
      await loadStudents(
        selectedClass.id,
        rosterPage,
        rosterPerPage,
        rosterSearch,
        rosterSortBy,
        rosterSortOrder,
      );
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
      setSelectedStudentIds((prev) => {
        const next = new Set(prev);
        next.delete(studentId);
        return next;
      });
      await loadStudents(
        selectedClass.id,
        rosterPage,
        rosterPerPage,
        rosterSearch,
        rosterSortBy,
        rosterSortOrder,
      );
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
          <div className="space-y-6">
            {/* Share & Enrollment panel */}
            {selectedClass.join_code && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Share2 className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-base">
                        Share & Enrollment
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleToggleCode}
                        disabled={togglingCode}
                        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={selectedClass.join_code_active ? "Deactivate join code" : "Activate join code"}
                      >
                        {selectedClass.join_code_active ? (
                          <ToggleRight className="h-5 w-5 text-green-600" />
                        ) : (
                          <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                        )}
                        <span className="text-xs">
                          {selectedClass.join_code_active ? "Active" : "Inactive"}
                        </span>
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-[1fr_auto_1fr]">
                    {/* Join code + actions */}
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Join Code
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-2xl font-bold tracking-wider text-foreground">
                            {selectedClass.join_code}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleCopyToClipboard(
                                selectedClass.join_code || "",
                                "Join code",
                              )
                            }
                            className="h-8 w-8 p-0"
                            aria-label="Copy join code"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        {!selectedClass.join_code_active && (
                          <p className="text-xs text-amber-600 mt-1">
                            Code is currently disabled. Students cannot join.
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleCopyToClipboard(joinUrl, "Join link")
                          }
                          className="gap-1.5"
                        >
                          <Link className="h-3.5 w-3.5" />
                          Copy Link
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleWhatsAppShare}
                          className="gap-1.5 text-green-700 border-green-200 hover:bg-green-50 hover:text-green-800 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-950"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          WhatsApp
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleRegenerateCode}
                          disabled={regeneratingCode}
                          className="gap-1.5"
                        >
                          <RefreshCw
                            className={cn(
                              "h-3.5 w-3.5",
                              regeneratingCode && "animate-spin",
                            )}
                          />
                          {regeneratingCode ? "Regenerating..." : "Regenerate"}
                        </Button>
                      </div>

                      {/* Copy Roster */}
                      <div>
                        {!showCopyRoster ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowCopyRoster(true)}
                            className="gap-1.5"
                          >
                            <FolderInput className="h-3.5 w-3.5" />
                            Import from Another Class
                          </Button>
                        ) : (
                          <div className="flex gap-2 items-end">
                            <div className="flex-1 space-y-1">
                              <label className="text-xs font-medium text-muted-foreground">
                                Source Class
                              </label>
                              <Select
                                options={classes
                                  .filter((c) => c.id !== selectedClass.id)
                                  .map((c) => ({
                                    value: String(c.id),
                                    label: c.name,
                                  }))}
                                placeholder="Select class..."
                                value={copyRosterSourceId}
                                onChange={(e) =>
                                  setCopyRosterSourceId(e.target.value)
                                }
                              />
                            </div>
                            <Button
                              size="sm"
                              onClick={handleCopyRoster}
                              disabled={copyingRoster || !copyRosterSourceId}
                            >
                              {copyingRoster ? "Importing..." : "Import"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setShowCopyRoster(false);
                                setCopyRosterSourceId("");
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* QR Code */}
                    <div className="flex flex-col items-center gap-2">
                      {qrCodeUrl ? (
                        <>
                          <div className="rounded-lg border bg-white p-2">
                            <img
                              src={qrCodeUrl}
                              alt={`QR code for ${selectedClass.name}`}
                              className="h-[150px] w-[150px]"
                            />
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleDownloadQR}
                            className="gap-1.5 text-xs"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Download QR
                          </Button>
                        </>
                      ) : (
                        <div className="flex h-[150px] w-[150px] items-center justify-center rounded-lg border bg-muted/30">
                          <QrCode className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Invite Link Section */}
            {selectedClass.join_code && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <LinkIcon className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">Invite Link</CardTitle>
                  </div>
                  <CardDescription>
                    Generate a time-limited invite link for students
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {inviteLink ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                        <span className="flex-1 truncate text-sm font-mono">
                          {inviteLink.invite_url}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 shrink-0"
                          onClick={() =>
                            handleCopyToClipboard(inviteLink.invite_url, "Invite link")
                          }
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        Expires{" "}
                        {new Date(inviteLink.expires_at).toLocaleString()}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleGenerateInviteLink}
                        disabled={generatingInviteLink}
                      >
                        <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", generatingInviteLink && "animate-spin")} />
                        Regenerate
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={handleGenerateInviteLink}
                      disabled={generatingInviteLink}
                    >
                      <LinkIcon className="mr-1.5 h-4 w-4" />
                      {generatingInviteLink ? "Generating..." : "Generate Invite Link"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Students roster section */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">Students</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        resetImportModal();
                        setShowImportModal(true);
                      }}
                    >
                      <Upload className="mr-1 h-4 w-4" />
                      Import
                    </Button>
                  </div>
                </div>
                {/* Summary header */}
                <div className="flex flex-wrap gap-3 text-sm">
                  <span className="text-muted-foreground">
                    <span className="font-semibold text-foreground">{rosterTotal}</span> total
                  </span>
                  <span className="text-muted-foreground">
                    <span className="font-semibold text-green-600">{activeCount}</span> active
                  </span>
                  {inactiveCount > 0 && (
                    <span className="text-muted-foreground">
                      <span className="font-semibold text-amber-600">{inactiveCount}</span> inactive
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Enroll + Search bar */}
                <div className="flex flex-col gap-3 sm:flex-row">
                  <form onSubmit={handleEnrollStudent} className="flex gap-2 flex-1">
                    <Input
                      placeholder="Enroll by email"
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
                      {enrollLoading ? "..." : "Add"}
                    </Button>
                  </form>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search students..."
                      value={rosterSearch}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      className="pl-9 w-full sm:w-56"
                    />
                  </div>
                </div>

                {/* Sort controls */}
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Sort by:</span>
                  {[
                    { key: "name", label: "Name" },
                    { key: "email", label: "Email" },
                    { key: "enrolled_at", label: "Enrolled" },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => handleSortChange(key)}
                      className={cn(
                        "flex items-center gap-1 rounded-md px-2 py-1 transition-colors",
                        rosterSortBy === key
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted",
                      )}
                    >
                      {label}
                      {rosterSortBy === key && (
                        <ArrowUpDown className="h-3 w-3" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Bulk action toolbar */}
                {selectedStudentIds.size > 0 && (
                  <div className="flex items-center gap-3 rounded-md border bg-muted/50 px-3 py-2">
                    <span className="text-sm font-medium">
                      {selectedStudentIds.size} selected
                    </span>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleBulkRemove}
                      disabled={bulkRemoving}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      {bulkRemoving ? "Removing..." : "Remove Selected"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedStudentIds(new Set())}
                    >
                      Clear
                    </Button>
                  </div>
                )}

                {/* Student list */}
                {students.length === 0 ? (
                  <div className="py-8 text-center">
                    <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      {rosterSearch
                        ? "No students match your search."
                        : "No students enrolled yet. Add students by email, import, or share the join code."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {/* Select all header */}
                    <div className="flex items-center gap-3 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground border-b">
                      <input
                        type="checkbox"
                        checked={
                          students.length > 0 &&
                          selectedStudentIds.size === students.length
                        }
                        onChange={handleToggleAll}
                        className="rounded border-input"
                        aria-label="Select all students"
                      />
                      <span className="flex-1">Student</span>
                      <span className="hidden sm:block w-40">Email</span>
                      <span className="hidden sm:block w-28">Enrolled</span>
                      <span className="w-20 text-center">Status</span>
                      <span className="w-8" />
                    </div>
                    {students.map((s) => (
                      <div
                        key={s.id}
                        className={cn(
                          "flex items-center gap-3 rounded-md border px-3 py-2 transition-colors",
                          selectedStudentIds.has(s.student_id) && "bg-primary/5 border-primary/30",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.has(s.student_id)}
                          onChange={() => handleToggleStudent(s.student_id)}
                          className="rounded border-input"
                          aria-label={`Select ${s.student_name || "student"}`}
                        />
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {(s.student_name || "S").charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm truncate">
                            {s.student_name || `Student #${s.student_id}`}
                          </span>
                        </div>
                        <span className="hidden sm:block w-40 text-sm text-muted-foreground truncate">
                          {s.student_email || "—"}
                        </span>
                        <span className="hidden sm:block w-28 text-xs text-muted-foreground">
                          {new Date(s.enrolled_at).toLocaleDateString()}
                        </span>
                        <span className="w-20 text-center">
                          {s.is_active ? (
                            <Badge variant="success" className="text-xs">Active</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Inactive</Badge>
                          )}
                        </span>
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
                    ))}
                  </div>
                )}

                {/* Pagination controls */}
                {rosterTotalPages > 1 && (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2 border-t">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Show</span>
                      <select
                        value={rosterPerPage}
                        onChange={(e) => handlePerPageChange(Number(e.target.value))}
                        className="rounded-md border bg-background px-2 py-1 text-sm"
                      >
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                      <span>per page</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={rosterPage <= 1}
                        onClick={() => handlePageChange(rosterPage - 1)}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      {Array.from({ length: Math.min(rosterTotalPages, 5) }, (_, i) => {
                        let pageNum: number;
                        if (rosterTotalPages <= 5) {
                          pageNum = i + 1;
                        } else if (rosterPage <= 3) {
                          pageNum = i + 1;
                        } else if (rosterPage >= rosterTotalPages - 2) {
                          pageNum = rosterTotalPages - 4 + i;
                        } else {
                          pageNum = rosterPage - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={rosterPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageChange(pageNum)}
                            className="h-8 w-8 p-0"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={rosterPage >= rosterTotalPages}
                        onClick={() => handlePageChange(rosterPage + 1)}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      Page {rosterPage} of {rosterTotalPages}
                    </span>
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
        {/* Import Students Modal */}
        <Dialog
          open={showImportModal}
          onOpenChange={(open) => {
            setShowImportModal(open);
            if (!open) resetImportModal();
          }}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Import Students</DialogTitle>
              <DialogDescription>
                Add students via CSV/Excel file upload or by pasting email addresses.
              </DialogDescription>
            </DialogHeader>

            {importResult ? (
              <div className="space-y-4">
                <div className="rounded-md border bg-muted/30 p-4 space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">Import Results</h4>
                  {"enrolled" in importResult && Array.isArray((importResult as BulkEnrollResult).enrolled) ? (
                    // BulkEnrollResult
                    (() => {
                      const r = importResult as BulkEnrollResult;
                      return (
                        <>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <span className="text-muted-foreground">Enrolled:</span>
                            <span className="font-medium text-green-600">{r.enrolled.length}</span>
                            <span className="text-muted-foreground">Already enrolled:</span>
                            <span className="font-medium">{r.already_enrolled.length}</span>
                            <span className="text-muted-foreground">Not found:</span>
                            <span className="font-medium text-amber-600">{r.not_found.length}</span>
                          </div>
                          {r.not_found.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs font-medium text-muted-foreground mb-1">Not found emails:</p>
                              <div className="max-h-24 overflow-auto rounded border bg-background px-2 py-1 text-xs">
                                {r.not_found.join(", ")}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()
                  ) : (
                    // ImportResult (file-based)
                    (() => {
                      const r = importResult as ImportResult;
                      return (
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <span className="text-muted-foreground">Total rows:</span>
                          <span className="font-medium">{r.total_rows}</span>
                          <span className="text-muted-foreground">Enrolled:</span>
                          <span className="font-medium text-green-600">{r.enrolled}</span>
                          <span className="text-muted-foreground">Skipped:</span>
                          <span className="font-medium">{r.skipped}</span>
                        </div>
                      );
                    })()
                  )}
                  {importResult.errors && importResult.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-destructive mb-1">Errors:</p>
                      <div className="max-h-24 overflow-auto rounded border border-destructive/20 bg-destructive/5 px-2 py-1 text-xs text-destructive">
                        {importResult.errors.join("; ")}
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => {
                      setShowImportModal(false);
                      resetImportModal();
                    }}
                  >
                    Done
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Mode toggle */}
                <div className="flex rounded-md border p-1">
                  <button
                    onClick={() => setImportMode("file")}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 rounded px-3 py-2 text-sm transition-colors",
                      importMode === "file"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Upload File
                  </button>
                  <button
                    onClick={() => setImportMode("email")}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 rounded px-3 py-2 text-sm transition-colors",
                      importMode === "email"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Mail className="h-4 w-4" />
                    Paste Emails
                  </button>
                </div>

                {importMode === "file" ? (
                  <div className="space-y-3">
                    <div
                      className={cn(
                        "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors",
                        importFile
                          ? "border-primary/50 bg-primary/5"
                          : "border-muted-foreground/25 hover:border-muted-foreground/50",
                      )}
                    >
                      {importFile ? (
                        <div className="flex items-center gap-2 text-sm">
                          <FileSpreadsheet className="h-5 w-5 text-primary" />
                          <span className="font-medium">{importFile.name}</span>
                          <button
                            onClick={() => setImportFile(null)}
                            className="ml-2 text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <Upload className="mb-2 h-8 w-8 text-muted-foreground/50" />
                          <p className="text-sm text-muted-foreground">
                            Drop a CSV or Excel file here
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Expected columns: name, email
                          </p>
                        </>
                      )}
                      <input
                        type="file"
                        accept=".csv,.xlsx"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setImportFile(file);
                        }}
                        className={cn(
                          "absolute inset-0 cursor-pointer opacity-0",
                          importFile && "pointer-events-none",
                        )}
                        style={{ position: "relative" }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Textarea
                      placeholder={"student1@example.com\nstudent2@example.com\nstudent3@example.com"}
                      value={importEmails}
                      onChange={(e) => setImportEmails(e.target.value)}
                      rows={6}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      One email address per line. Students must already have accounts.
                    </p>
                  </div>
                )}

                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button
                    onClick={handleImport}
                    disabled={
                      importLoading ||
                      (importMode === "file" && !importFile) ||
                      (importMode === "email" && !importEmails.trim())
                    }
                  >
                    {importLoading ? "Importing..." : "Import"}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <ToastContainer />
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
