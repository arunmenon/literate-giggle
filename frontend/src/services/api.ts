import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// Attach JWT token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 - redirect to login (skip for auth endpoints)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || "";
    const isAuthEndpoint =
      url.includes("/auth/login") ||
      url.includes("/auth/register") ||
      url.includes("/auth/google/verify");
    if (error.response?.status === 401 && !isAuthEndpoint) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export default api;

// ── Voice WebSocket (FR-005) ──

/**
 * Build a WebSocket URL for voice endpoints with JWT auth.
 * Uses the current page origin, swapping http(s) for ws(s).
 */
export function getVoiceWsUrl(endpoint: string): string {
  const token = localStorage.getItem("token");
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  const path = `/api/voice/${endpoint}`.replace(/\/+/g, "/");
  const url = `${protocol}//${host}${path}`;
  return token ? `${url}?token=${encodeURIComponent(token)}` : url;
}

// ── Auth ──

export const authAPI = {
  register: (data: any) => api.post("/auth/register", data),
  login: (data: { email: string; password: string }) =>
    api.post("/auth/login", data),
  googleVerify: (data: {
    credential: string;
    role?: string;
    student_profile?: any;
    teacher_profile?: any;
    invite_code?: string;
    class_join_code?: string;
  }) => api.post("/auth/google/verify", data),
  me: () => api.get("/auth/me"),
  getPreferences: () => api.get("/auth/me/preferences"),
  updatePreferences: (data: any) => api.patch("/auth/me/preferences", data),
  // DPDP Consent (FR-005)
  grantConsent: (data: { guardian_name: string; guardian_email: string }) =>
    api.post("/auth/consent", data),
  getConsentStatus: () => api.get("/auth/consent/status"),
  revokeConsent: () => api.post("/auth/consent/revoke"),
};

// ── Questions ──

export const questionAPI = {
  createBank: (data: any) => api.post("/questions/banks", data),
  listBanks: (params?: any) => api.get("/questions/banks", { params }),
  create: (data: any) => api.post("/questions", data),
  list: (params?: any) => api.get("/questions", { params }),
  get: (id: number) => api.get(`/questions/${id}`),
  update: (id: number, data: any) => api.put(`/questions/${id}`, data),
  delete: (id: number) => api.delete(`/questions/${id}`),
  generate: (data: any) => api.post("/questions/generate", data),
  generateBulk: (data: any) => api.post("/questions/generate/bulk", data),
  approveGenerated: (data: any) =>
    api.post("/questions/generate/approve", data),
  getCurriculum: (params?: any) => api.get("/questions/curriculum", { params }),
  research: (data: any) => api.post("/questions/research", data),
  regenerateQuestion: (data: any) =>
    api.post("/questions/generate/regenerate", data),
  getBankAnalytics: (bankId: number) =>
    api.get(`/questions/banks/${bankId}/analytics`),
  getBankHeatmap: (bankId: number) =>
    api.get(`/questions/banks/${bankId}/heatmap`),
  getCalibration: (questionId: number) =>
    api.get(`/questions/${questionId}/calibration`),
  getBankCalibration: (bankId: number) =>
    api.get(`/questions/banks/${bankId}/calibration`),
  uploadImage: (questionId: number, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post(`/questions/${questionId}/upload-image`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  generateDiagram: (
    questionId: number,
    data: { subject: string; topic: string; question_text: string },
  ) => api.post(`/questions/${questionId}/generate-diagram`, data),
  acceptDiagram: (
    questionId: number,
    data: { svg_url: string; alt_text?: string },
  ) => api.post(`/questions/${questionId}/accept-diagram`, data),
};

// ── Papers ──

export const paperAPI = {
  create: (data: any) => api.post("/papers", data),
  list: (params?: any) => api.get("/papers", { params }),
  get: (id: number) => api.get(`/papers/${id}`),
  updateStatus: (id: number, data: any) =>
    api.patch(`/papers/${id}/status`, data),
  addQuestion: (paperId: number, data: any) =>
    api.post(`/papers/${paperId}/questions`, data),
  assembleWithAI: (data: any) => api.post("/papers/assemble", data),
  getCoverage: (paperId: number) => api.get(`/papers/${paperId}/coverage`),
};

// ── Exams ──

export const examAPI = {
  start: (data: { paper_id: number; is_practice?: boolean }) =>
    api.post("/exams/start", data),
  save: (sessionId: number, data: any) =>
    api.post(`/exams/${sessionId}/save`, data),
  submit: (sessionId: number) => api.post(`/exams/${sessionId}/submit`),
  flag: (sessionId: number, pqId: number) =>
    api.post(`/exams/${sessionId}/flag/${pqId}`),
  get: (sessionId: number) => api.get(`/exams/${sessionId}`),
  list: () => api.get("/exams"),
  getAllWorkspaces: () => api.get("/exams/all-workspaces"),
  uploadAnswerImage: (sessionId: number, paperQuestionId: number, blob: Blob) => {
    const fd = new FormData();
    fd.append("file", blob, `answer_${paperQuestionId}.png`);
    fd.append("paper_question_id", String(paperQuestionId));
    return api.post(`/exams/${sessionId}/upload-answer-image`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

// ── Evaluations ──

export const evaluationAPI = {
  evaluate: (data: { session_id: number; method?: string }) =>
    api.post("/evaluations/evaluate", data),
  get: (id: number) => api.get(`/evaluations/${id}`),
  paperSummary: (paperId: number) =>
    api.get(`/evaluations/paper/${paperId}/summary`),
};

// ── Learning ──

export const learningAPI = {
  generatePlan: (data: any) => api.post("/learning/plans/generate", data),
  listPlans: () => api.get("/learning/plans"),
  getPlan: (id: number) => api.get(`/learning/plans/${id}`),
  updateObjective: (id: number, data: any) =>
    api.patch(`/learning/objectives/${id}`, data),
  getMastery: (subject?: string) =>
    api.get("/learning/mastery", { params: { subject } }),
  getProgress: (subject: string) => api.get(`/learning/progress/${subject}`),
};

// ── Dashboard ──

export const dashboardAPI = {
  student: () => api.get("/dashboard/student"),
  teacherStats: (params?: any) =>
    api.get("/dashboard/teacher/stats", { params }),
};

// ── AI Tutor ──

export const aiAPI = {
  hint: (data: { session_id: number; paper_question_id: number }) =>
    api.post("/ai/hint", data),
  explain: (data: { question_evaluation_id: number }) =>
    api.post("/ai/explain", data),
};

// ── Workspace ──

export const workspaceAPI = {
  create: (data: { name: string; type: "personal" | "school" }) =>
    api.post("/workspace", data),
  get: () => api.get("/workspace"),
  getMembers: () => api.get("/workspace/members"),
  generateInviteCode: () => api.post("/workspace/invite"),
  joinByCode: (data: { invite_code: string }) =>
    api.post("/workspace/join", data),
  getMine: () => api.get("/workspace/mine"),
  switchWorkspace: (data: { workspace_id: number }) =>
    api.post("/auth/switch-workspace", data),
};

// ── Classes ──

export const classAPI = {
  create: (data: any) => api.post("/classes", data),
  list: () => api.get("/classes"),
  getStudents: (classId: number) => api.get(`/classes/${classId}/students`),
  enrollStudent: (classId: number, data: any) =>
    api.post(`/classes/${classId}/enroll`, data),
  removeStudent: (classId: number, studentId: number) =>
    api.delete(`/classes/${classId}/enroll/${studentId}`),
  assignExam: (classId: number, data: any) =>
    api.post(`/classes/${classId}/assign-exam`, data),
  getAssignments: (classId: number) =>
    api.get(`/classes/${classId}/assignments`),
  join: (data: { join_code: string }) => api.post("/classes/join", data),
  getQRCode: (classId: number, size?: number) =>
    api.get(`/classes/${classId}/qr-code`, {
      params: { size },
      responseType: "blob",
    }),
  regenerateCode: (classId: number) =>
    api.post(`/classes/${classId}/regenerate-code`),
  toggleJoinCode: (classId: number, active: boolean) =>
    api.patch(`/classes/${classId}/join-code`, { active }),
  copyRoster: (classId: number, data: { source_class_id: number }) =>
    api.post(`/classes/${classId}/copy-roster`, data),
  getStudentsPaginated: (
    classId: number,
    params?: {
      page?: number;
      per_page?: number;
      search?: string;
      sort_by?: string;
      sort_order?: string;
      active_only?: boolean;
    },
  ) => api.get(`/classes/${classId}/students`, { params }),
  bulkEnroll: (
    classId: number,
    data: { emails: string[]; skip_unregistered?: boolean },
  ) => api.post(`/classes/${classId}/students/bulk`, data),
  importStudents: (classId: number, formData: FormData) =>
    api.post(`/classes/${classId}/students/import`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  generateInviteLink: (
    classId: number,
    data: { expires_in_hours?: number },
  ) => api.post(`/classes/${classId}/invite-link`, data),
  joinByLink: (token: string) => api.post(`/classes/join/link/${token}`),
};

// ── Taxonomy ──

export const taxonomyAPI = {
  generate: (data: { board: string; class_grade: number; subject: string }) =>
    api.post("/taxonomy/generate", data),
  generateFromPdf: (documentId: number) =>
    api.post("/taxonomy/generate/from-pdf", { document_id: documentId }),
  save: (data: any) => api.post("/taxonomy/save", data),
  analyzeImpact: (data: {
    chapter_id: number;
    change_type: string;
    new_value?: string;
  }) => api.post("/taxonomy/impact-analysis", data),
  updateChapter: (
    id: number,
    data: {
      name?: string;
      textbook_reference?: string;
      marks_weightage?: number;
      question_pattern_notes?: string;
      order?: number;
      impact_acknowledged: boolean;
    },
  ) => api.put(`/taxonomy/chapters/${id}`, data),
  deprecateChapter: (id: number) =>
    api.post(`/taxonomy/chapters/${id}/deprecate`),
  addChapter: (data: {
    curriculum_subject_id: number;
    name: string;
    textbook_reference?: string;
    marks_weightage?: number;
    order?: number;
  }) => api.post("/taxonomy/chapters", data),
  list: (params?: { board?: string; class_grade?: number }) =>
    api.get("/taxonomy/list", { params }),
  clone: (data: { source_curriculum_id: number; new_academic_year: string }) =>
    api.post("/taxonomy/clone", data),
  getSubjectDetail: (subjectId: number) =>
    api.get(`/taxonomy/subjects/${subjectId}`),
};

// ── Voice AI ──

export const voiceAPI = {
  dictateQuestion: (audioFile: File) => {
    const fd = new FormData();
    fd.append("audio", audioFile);
    return api.post("/voice/dictate-question", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  uploadAudioFeedback: (
    evaluationId: number,
    questionEvaluationId: number,
    audioFile: File,
  ) => {
    const fd = new FormData();
    fd.append("audio", audioFile);
    fd.append("question_evaluation_id", String(questionEvaluationId));
    return api.post(`/voice/evaluations/${evaluationId}/audio-feedback`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  getAudioFeedbackUrl: (evaluationId: number, questionEvaluationId: number) =>
    `/api/voice/evaluations/${evaluationId}/audio-feedback/${questionEvaluationId}`,
};

// ── Curriculum ──

export const curriculumAPI = {
  getBoards: () => api.get("/curriculum/boards"),
  getClasses: (board: string) => api.get(`/curriculum/${board}/classes`),
  getSubjects: (board: string, classGrade: number) =>
    api.get(`/curriculum/${board}/${classGrade}/subjects`),
  getChapters: (board: string, classGrade: number, subject: string) =>
    api.get(`/curriculum/${board}/${classGrade}/${subject}/chapters`),
  getChapterDetail: (chapterId: number) =>
    api.get(`/curriculum/chapters/${chapterId}`),
  uploadDocument: (formData: FormData) =>
    api.post("/curriculum/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  getDocuments: (chapterId?: number) =>
    api.get("/curriculum/documents", { params: { chapter_id: chapterId } }),
};
