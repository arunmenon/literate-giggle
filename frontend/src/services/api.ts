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

// Handle 401 - redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export default api;

// ── Auth ──

export const authAPI = {
  register: (data: any) => api.post("/auth/register", data),
  login: (data: { email: string; password: string }) =>
    api.post("/auth/login", data),
  me: () => api.get("/auth/me"),
  getPreferences: () => api.get("/auth/me/preferences"),
  updatePreferences: (data: any) => api.patch("/auth/me/preferences", data),
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
