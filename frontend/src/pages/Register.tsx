import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { authAPI } from "../services/api";
import { useAuth } from "../store/AuthContext";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Input,
  Button,
  Select,
} from "../components/ui";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

const BOARDS = [
  { value: "CBSE", label: "CBSE" },
  { value: "ICSE", label: "ICSE" },
  { value: "State Board", label: "State Board" },
];
const CLASSES = [7, 8, 9, 10, 11, 12].map((c) => ({
  value: String(c),
  label: `Class ${c}`,
}));

const Register: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialJoinCode = searchParams.get("join_code") || searchParams.get("class_join_code") || "";
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "student",
    board: "CBSE",
    class_grade: 10,
    school_name: "",
    subjects: "Mathematics",
    institution: "",
    class_join_code: initialJoinCode,
    guardian_name: "",
    guardian_email: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleCredential, setGoogleCredential] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Pre-fill from URL params when redirected from login page with Google credential
  useEffect(() => {
    const credential = searchParams.get("google_credential");
    const googleEmail = searchParams.get("email");
    const googleName = searchParams.get("name");
    const classJoinCode = searchParams.get("class_join_code");

    if (credential) {
      setGoogleCredential(credential);
      setForm((f) => ({
        ...f,
        email: googleEmail || f.email,
        full_name: googleName || f.full_name,
        class_join_code: classJoinCode || f.class_join_code,
      }));
    }
  }, [searchParams]);

  const update = (field: string, value: any) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setError("");
    setLoading(true);
    try {
      // First attempt: check if existing user
      const { data } = await authAPI.googleVerify({
        credential: credentialResponse.credential,
      });
      // Existing user -- log in directly
      login(data);
      navigate("/");
    } catch (err: any) {
      const status = err.response?.status;
      const responseData = err.response?.data;
      if (status === 422 && responseData?.is_new_user) {
        // New user -- store credential and pre-fill form
        setGoogleCredential(credentialResponse.credential);
        setForm((f) => ({
          ...f,
          email: responseData.email || f.email,
          full_name: responseData.full_name || f.full_name,
        }));
      } else {
        setError(responseData?.detail || "Google sign-up failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (googleCredential) {
        // Google registration flow
        const googlePayload: any = {
          credential: googleCredential,
          role: form.role,
          class_join_code: form.class_join_code.trim() || undefined,
        };
        if (form.role === "student") {
          googlePayload.student_profile = {
            board: form.board,
            class_grade: form.class_grade,
            school_name: form.school_name || undefined,
          };
          if (form.guardian_name.trim()) {
            googlePayload.guardian_name = form.guardian_name.trim();
          }
          if (form.guardian_email.trim()) {
            googlePayload.guardian_email = form.guardian_email.trim();
          }
        } else {
          googlePayload.teacher_profile = {
            board: form.board,
            subjects: form.subjects.split(",").map((s: string) => s.trim()),
            classes: [7, 8, 9, 10, 11, 12],
            institution: form.institution || undefined,
          };
        }
        const { data } = await authAPI.googleVerify(googlePayload);
        login(data);
        navigate("/");
      } else {
        // Standard email/password registration flow
        const payload: any = {
          user: {
            email: form.email,
            password: form.password,
            full_name: form.full_name,
            role: form.role,
          },
          class_join_code: form.class_join_code.trim() || undefined,
        };
        if (form.role === "student") {
          payload.student_profile = {
            board: form.board,
            class_grade: form.class_grade,
            school_name: form.school_name || undefined,
          };
          if (form.guardian_name.trim()) {
            payload.guardian_name = form.guardian_name.trim();
          }
          if (form.guardian_email.trim()) {
            payload.guardian_email = form.guardian_email.trim();
          }
        } else {
          payload.teacher_profile = {
            board: form.board,
            subjects: form.subjects.split(",").map((s: string) => s.trim()),
            classes: [7, 8, 9, 10, 11, 12],
            institution: form.institution || undefined,
          };
        }
        const { data } = await authAPI.register(payload);
        login(data);
        navigate("/");
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const isGoogleFlow = !!googleCredential;

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">
            Join ExamIQ
          </CardTitle>
          <CardDescription>
            {isGoogleFlow
              ? "Complete your profile to finish signing up"
              : "Create your account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Google Sign-Up (only when not already in Google flow) */}
          {GOOGLE_CLIENT_ID && !isGoogleFlow && (
            <>
              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError("Google sign-up failed. Please try again.")}
                  theme="outline"
                  size="large"
                  width="100%"
                  text="signup_with"
                />
              </div>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>
            </>
          )}

          {/* Google flow indicator */}
          {isGoogleFlow && (
            <div className="mb-4 rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">
              Signing up with Google. Select your role and fill in your profile below.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="full_name"
                className="text-sm font-medium text-foreground"
              >
                Full Name
              </label>
              <Input
                id="full_name"
                value={form.full_name}
                onChange={(e) => update("full_name", e.target.value)}
                required
                autoComplete="name"
                readOnly={isGoogleFlow}
                className={isGoogleFlow ? "bg-muted" : ""}
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="reg_email"
                className="text-sm font-medium text-foreground"
              >
                Email
              </label>
              <Input
                id="reg_email"
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                required
                autoComplete="email"
                readOnly={isGoogleFlow}
                className={isGoogleFlow ? "bg-muted" : ""}
              />
            </div>

            {/* Hide password for Google flow */}
            {!isGoogleFlow && (
              <div className="space-y-2">
                <label
                  htmlFor="reg_password"
                  className="text-sm font-medium text-foreground"
                >
                  Password
                </label>
                <Input
                  id="reg_password"
                  type="password"
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
            )}

            <div className="space-y-2">
              <label
                htmlFor="role"
                className="text-sm font-medium text-foreground"
              >
                Role
              </label>
              <Select
                id="role"
                options={[
                  { value: "student", label: "Student" },
                  { value: "teacher", label: "Teacher" },
                ]}
                value={form.role}
                onChange={(e) => update("role", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="board"
                className="text-sm font-medium text-foreground"
              >
                Board
              </label>
              <Select
                id="board"
                options={BOARDS}
                value={form.board}
                onChange={(e) => update("board", e.target.value)}
              />
            </div>
            {form.role === "student" && (
              <>
                <div className="space-y-2">
                  <label
                    htmlFor="class_grade"
                    className="text-sm font-medium text-foreground"
                  >
                    Class
                  </label>
                  <Select
                    id="class_grade"
                    options={CLASSES}
                    value={String(form.class_grade)}
                    onChange={(e) =>
                      update("class_grade", Number(e.target.value))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="school_name"
                    className="text-sm font-medium text-foreground"
                  >
                    School Name (optional)
                  </label>
                  <Input
                    id="school_name"
                    value={form.school_name}
                    onChange={(e) => update("school_name", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="class_join_code"
                    className="text-sm font-medium text-foreground"
                  >
                    Class Join Code (optional)
                  </label>
                  <Input
                    id="class_join_code"
                    placeholder="e.g. JOIN10A"
                    value={form.class_join_code}
                    onChange={(e) =>
                      update(
                        "class_join_code",
                        e.target.value.toUpperCase(),
                      )
                    }
                    className="font-mono tracking-wider"
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">
                    Have a join code from your teacher? Enter it to join the
                    class automatically.
                  </p>
                </div>

                {/* Guardian Information (optional, for voice features) */}
                <div className="rounded-md border border-muted px-4 py-3 space-y-3">
                  <p className="text-sm font-medium text-foreground">
                    Guardian Information{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Required for voice features. Can be provided later from your
                    dashboard.
                  </p>
                  <div className="space-y-2">
                    <label
                      htmlFor="guardian_name"
                      className="text-sm font-medium text-foreground"
                    >
                      Guardian Name
                    </label>
                    <Input
                      id="guardian_name"
                      value={form.guardian_name}
                      onChange={(e) => update("guardian_name", e.target.value)}
                      placeholder="Parent or guardian's full name"
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="guardian_email"
                      className="text-sm font-medium text-foreground"
                    >
                      Guardian Email
                    </label>
                    <Input
                      id="guardian_email"
                      type="email"
                      value={form.guardian_email}
                      onChange={(e) => update("guardian_email", e.target.value)}
                      placeholder="guardian@example.com"
                      autoComplete="off"
                    />
                  </div>
                </div>
              </>
            )}
            {form.role === "teacher" && (
              <>
                <div className="space-y-2">
                  <label
                    htmlFor="subjects"
                    className="text-sm font-medium text-foreground"
                  >
                    Subjects (comma-separated)
                  </label>
                  <Input
                    id="subjects"
                    value={form.subjects}
                    onChange={(e) => update("subjects", e.target.value)}
                    placeholder="Mathematics, Science"
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="institution"
                    className="text-sm font-medium text-foreground"
                  >
                    Institution (optional)
                  </label>
                  <Input
                    id="institution"
                    value={form.institution}
                    onChange={(e) => update("institution", e.target.value)}
                  />
                </div>
              </>
            )}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Creating account..." : "Create Account"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-medium text-primary hover:underline"
            >
              Sign In
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Register;
