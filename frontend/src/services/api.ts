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
  }
);

export default api;

// ── Auth ──

export const authAPI = {
  register: (data: any) => api.post("/auth/register", data),
  login: (data: { email: string; password: string }) =>
    api.post("/auth/login", data),
  me: () => api.get("/auth/me"),
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
  teacherStats: (params?: any) => api.get("/dashboard/teacher/stats", { params }),
};
