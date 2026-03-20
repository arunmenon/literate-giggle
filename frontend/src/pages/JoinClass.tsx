import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { classAPI, authAPI } from "../services/api";
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
  Badge,
} from "../components/ui";
import { GraduationCap, LogIn, CheckCircle, AlertCircle } from "lucide-react";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

const JoinClass: React.FC = () => {
  const { code } = useParams<{ code?: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuth();

  const [joinCode, setJoinCode] = useState(code || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{
    class_name: string;
    workspace_name: string;
  } | null>(null);

  // Auto-join if code is in URL and user is authenticated
  useEffect(() => {
    if (code) {
      setJoinCode(code);
    }
  }, [code]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = joinCode.trim().toUpperCase();
    if (!trimmed) return;

    setError("");
    setLoading(true);
    try {
      const { data } = await classAPI.join({ join_code: trimmed });
      setSuccess({
        class_name: data.class_name,
        workspace_name: data.workspace_name,
      });
      // Redirect to dashboard after a brief delay
      setTimeout(() => navigate("/"), 2000);
    } catch (err: any) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;
      if (status === 404) {
        setError("Invalid join code. Please check and try again.");
      } else if (status === 400) {
        setError(detail || "You are already enrolled in this class.");
      } else if (status === 409) {
        setError("This class is currently full.");
      } else {
        setError(detail || "Failed to join class. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setError("");
    setLoading(true);
    try {
      const classJoinCode = code || joinCode.trim().toUpperCase();
      const { data } = await authAPI.googleVerify({
        credential: credentialResponse.credential,
        class_join_code: classJoinCode || undefined,
      });
      // Existing user -- log in, then join class
      login(data);
      if (classJoinCode) {
        try {
          const joinResult = await classAPI.join({ join_code: classJoinCode });
          setSuccess({
            class_name: joinResult.data.class_name,
            workspace_name: joinResult.data.workspace_name,
          });
          setTimeout(() => navigate("/"), 2000);
        } catch (joinErr: any) {
          // Already enrolled or other non-critical error -- still logged in
          navigate("/");
        }
      } else {
        navigate("/");
      }
    } catch (err: any) {
      const status = err.response?.status;
      const responseData = err.response?.data;
      if (status === 422 && responseData?.is_new_user) {
        // New user -- redirect to register with class join code preserved
        const classJoinCode = code || joinCode.trim().toUpperCase();
        const params = new URLSearchParams({
          google_credential: credentialResponse.credential,
          email: responseData.email || "",
          name: responseData.full_name || "",
          ...(classJoinCode ? { class_join_code: classJoinCode } : {}),
        });
        navigate(`/register?${params.toString()}`);
      } else {
        setError(responseData?.detail || "Google sign-in failed");
      }
    } finally {
      setLoading(false);
    }
  };

  // Success state
  if (success) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">
                Successfully Joined!
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                You have been enrolled in{" "}
                <span className="font-semibold text-foreground">
                  {success.class_name}
                </span>
              </p>
              {success.workspace_name && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {success.workspace_name}
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Redirecting to dashboard...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not authenticated - prompt to login
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <GraduationCap className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-xl">Join a Class</CardTitle>
            <CardDescription>
              You need to sign in before joining a class.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {code && (
              <div className="rounded-md border bg-muted/30 px-4 py-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Join Code</p>
                <p className="font-mono text-lg font-bold tracking-wider">
                  {code}
                </p>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Google Sign-In for join */}
            {GOOGLE_CLIENT_ID && (
              <>
                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => setError("Google sign-in failed. Please try again.")}
                    theme="outline"
                    size="large"
                    width="100%"
                    text="signin_with"
                  />
                </div>
                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">or</span>
                  </div>
                </div>
              </>
            )}

            <div className="flex flex-col gap-2">
              <Link to="/login">
                <Button className="w-full gap-2">
                  <LogIn className="h-4 w-4" />
                  Sign In to Join
                </Button>
              </Link>
              <p className="text-center text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link
                  to={code ? `/register?join_code=${code}` : "/register"}
                  className="font-medium text-primary hover:underline"
                >
                  Register first
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Authenticated - show join form
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <GraduationCap className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl">Join a Class</CardTitle>
          <CardDescription>
            Enter the join code provided by your teacher to enroll in a class.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <form onSubmit={handleJoin} className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="join-code"
                className="text-sm font-medium text-foreground"
              >
                Join Code
              </label>
              <Input
                id="join-code"
                placeholder="e.g. JOIN10A"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="text-center font-mono text-lg tracking-wider"
                autoFocus
                autoComplete="off"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loading || !joinCode.trim()}
            >
              {loading ? "Joining..." : "Join Class"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center">
          <Link
            to="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Back to Dashboard
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
};

export default JoinClass;
