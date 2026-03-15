// ── Auth & User ──

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: "student" | "teacher" | "admin";
  is_active: boolean;
  created_at: string;
}

export interface StudentProfile {
  id: number;
  board: string;
  class_grade: number;
  school_name?: string;
  section?: string;
  academic_year: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  role: string;
  full_name: string;
  workspace_id?: number | null;
  workspace_role?: string | null;
  workspace_name?: string | null;
  workspace_type?: string | null;
}

// ── Workspace & Tenancy ──

export interface Workspace {
  id: number;
  name: string;
  type: "personal" | "school";
  invite_code: string;
  owner_id: number;
  created_at: string;
}

export interface WorkspaceMember {
  id: number;
  workspace_id: number;
  user_id: number;
  role: "owner" | "admin" | "teacher" | "student";
  full_name?: string;
  email?: string;
  joined_at: string;
}

export interface ClassGroup {
  id: number;
  workspace_id: number;
  name: string;
  grade: number;
  section?: string;
  subject?: string;
  academic_year: string;
  teacher_id?: number;
  student_count?: number;
  created_at: string;
}

export interface Enrollment {
  id: number;
  class_id: number;
  student_id: number;
  student_name?: string;
  enrolled_at: string;
  is_active: boolean;
}

export interface ExamAssignment {
  id: number;
  paper_id: number;
  class_id: number;
  status: "draft" | "active" | "closed";
  label?: string;
  start_at?: string;
  end_at?: string;
  is_practice: boolean;
  paper_title?: string;
  class_name?: string;
  created_at: string;
}

// ── Question Bank ──

export interface QuestionBank {
  id: number;
  name: string;
  board: string;
  class_grade: number;
  subject: string;
  chapter?: string;
  question_count: number;
  created_at: string;
}

export interface Question {
  id: number;
  bank_id: number;
  question_type: string;
  question_text: string;
  marks: number;
  difficulty: string;
  blooms_level: string;
  topic: string;
  subtopic?: string;
  model_answer?: string;
  mcq_options?: Record<string, string>;
  source?: string;
  times_used: number;
  avg_score_pct?: number;
  created_at: string;
}

// ── Question Paper ──

export interface QuestionPaper {
  id: number;
  title: string;
  board: string;
  class_grade: number;
  subject: string;
  exam_type?: string;
  total_marks: number;
  duration_minutes: number;
  status: string;
  sections?: Array<{ name: string; instructions?: string; marks?: number }>;
  question_count: number;
  instructions?: string;
  questions?: PaperQuestionDetail[];
  created_at: string;
  published_at?: string;
  starts_at?: string;
  ends_at?: string;
}

export interface PaperQuestionDetail {
  paper_question_id: number;
  question_id: number;
  section?: string;
  order: number;
  marks: number;
  is_compulsory: boolean;
  choice_group?: string;
  question_type: string;
  question_text: string;
  mcq_options?: Record<string, string>;
  difficulty: string;
  topic: string;
}

// ── Exam Session ──

export interface ExamSession {
  id: number;
  paper_id: number;
  status: string;
  started_at?: string;
  submitted_at?: string;
  time_spent_seconds: number;
  is_practice: boolean;
  total_score?: number;
  percentage?: number;
  grade?: string;
}

export interface StudentAnswer {
  paper_question_id: number;
  answer_text?: string;
  selected_option?: string;
  is_flagged?: boolean;
}

// ── Evaluation ──

export interface QuestionEvaluation {
  id: number;
  question_text: string;
  question_type: string;
  marks_obtained: number;
  marks_possible: number;
  student_answer?: string;
  model_answer?: string;
  feedback?: string;
  keywords_found?: string[];
  keywords_missing?: string[];
  improvement_hint?: string;
}

export interface Evaluation {
  id: number;
  session_id: number;
  total_marks_obtained: number;
  total_marks_possible: number;
  percentage: number;
  grade?: string;
  topic_scores?: Record<string, { obtained: number; total: number }>;
  blooms_scores?: Record<string, number>;
  difficulty_scores?: Record<string, number>;
  strengths?: string[];
  weaknesses?: string[];
  recommendations?: string;
  evaluated_by?: string;
  evaluated_at: string;
  is_final: boolean;
  question_evaluations: QuestionEvaluation[];
}

// ── Learning ──

export interface LearningObjective {
  id: number;
  topic: string;
  subtopic?: string;
  description: string;
  priority: number;
  status: string;
  resources?: Array<{ type: string; title: string; url?: string }>;
  target_mastery: string;
  current_mastery: string;
  attempts: number;
  best_score_pct?: number;
  order: number;
}

export interface LearningPlan {
  id: number;
  subject: string;
  board: string;
  class_grade: number;
  title: string;
  description?: string;
  focus_areas?: string[];
  target_score?: number;
  current_score?: number;
  estimated_hours?: number;
  progress_pct: number;
  is_active: boolean;
  objectives: LearningObjective[];
  start_date?: string;
  target_date?: string;
  created_at: string;
}

export interface TopicMastery {
  id: number;
  subject: string;
  topic: string;
  subtopic?: string;
  mastery_level: string;
  avg_score_pct: number;
  last_score_pct?: number;
  total_attempts: number;
  trend?: string;
}

// ── Dashboard ──

export interface StudentDashboard {
  user: User;
  profile: StudentProfile;
  total_exams_taken: number;
  average_score?: number;
  recent_scores: Array<{
    exam: string;
    subject: string;
    score: number;
    grade: string;
    date?: string;
  }>;
  strengths: string[];
  weaknesses: string[];
  active_learning_plans: number;
}

// ── AI Question Generation ──

export interface GeneratedQuestion {
  question_text: string;
  question_type: string;
  marks: number;
  difficulty: string;
  blooms_level: string;
  topic: string;
  subtopic?: string;
  model_answer: string;
  answer_keywords: string[];
  mcq_options?: Record<string, string>;
  correct_option?: string;
  marking_scheme?: Array<{ step: string; marks: number; keywords?: string[] }>;
  source?: string;
}

export interface GenerateResponse {
  questions: GeneratedQuestion[];
  count: number;
}

// ── AI Tutor ──

export interface HintResponse {
  hint: string;
  hint_level: number;
  hint_number: number;
  marks_penalty_pct: number;
  total_penalty_pct: number;
}

export interface ExplainResponse {
  explanation: string;
  key_concept: string;
  common_mistake: string;
  study_tip: string;
}

// ── Curriculum-Grounded Generation ──

export interface CurriculumSelection {
  board: string;
  class_grade: number;
  subject: string;
  chapter: string;
  topics?: string[];
}

export interface ChapterDetail {
  chapter_name: string;
  textbook_ref: string;
  topics: string[];
  learning_outcomes: string[];
  question_patterns: string;
  suggested_distribution: Record<string, number>;
}

export interface ResearchResult {
  chapter_info: ChapterDetail;
  generation_brief: string;
  suggested_distribution: Record<string, number>;
  key_concepts: string[];
  misconceptions: string[];
  teacher_notes_incorporated?: string;
  web_sources?: Array<{ title: string; url: string; snippet: string }>;
  document_sources?: Array<{ filename: string; content_type: string }>;
}

export interface TeacherPreferences {
  ai_assistance_level: "auto" | "guided" | "expert";
}

export interface PaperAssemblyRequest {
  board: string;
  class_grade: number;
  subject: string;
  chapters: string[];
  total_marks: number;
  duration_minutes: number;
  exam_type?: string;
  sections?: Array<{ name: string; marks: number }>;
}

export interface PaperAssemblyResult {
  paper: { title: string; sections: any[]; instructions: string };
  questions: Array<{
    question: any;
    section: string;
    order: number;
    source: string;
  }>;
  coverage_analysis: {
    topic_coverage: Record<string, number>;
    blooms_distribution: Record<string, number>;
    difficulty_distribution: Record<string, number>;
  };
  gaps_filled: number;
}

// ── Curriculum DB ──

export interface CurriculumBoard {
  id: number;
  code: string;
  name: string;
}

export interface CurriculumSubjectInfo {
  id: number;
  code: string;
  name: string;
  class_grade: number;
  textbook_name?: string;
}

export interface CurriculumChapterInfo {
  id: number;
  number: number;
  name: string;
  textbook_reference?: string;
  marks_weightage?: number;
  topic_count: number;
}

export interface CurriculumTopicInfo {
  id: number;
  name: string;
  description?: string;
}

export interface LearningOutcomeInfo {
  id: number;
  code: string;
  description: string;
  bloom_level?: string;
}

// ── Uploaded Documents ──

export interface UploadedDocument {
  id: number;
  filename: string;
  content_type: string;
  chapter_id?: number;
  extracted_text?: string;
  extracted_questions?: any[];
  uploaded_at: string;
}

export interface PDFUploadResponse {
  document: UploadedDocument;
  extracted_text_preview: string;
  question_count?: number;
}
