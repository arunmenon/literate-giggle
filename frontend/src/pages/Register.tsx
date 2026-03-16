import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
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
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const update = (field: string, value: any) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload: any = {
        user: {
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          role: form.role,
        },
      };
      if (form.role === "student") {
        payload.student_profile = {
          board: form.board,
          class_grade: form.class_grade,
          school_name: form.school_name || undefined,
        };
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
    } catch (err: any) {
      setError(err.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">
            Join ExamIQ
          </CardTitle>
          <CardDescription>Create your account</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
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
              />
            </div>
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
