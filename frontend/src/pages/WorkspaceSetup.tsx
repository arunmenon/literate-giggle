import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../store/AuthContext";
import { workspaceAPI } from "../services/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Input,
} from "../components/ui";
import {
  GraduationCap,
  Users,
  Copy,
  Check,
  BookOpen,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { cn } from "../lib/utils";

type SetupStep = "choose" | "create" | "join" | "success";

const WorkspaceSetup: React.FC = () => {
  const { role, login } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<SetupStep>("choose");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Create workspace state
  const [workspaceName, setWorkspaceName] = useState("");
  const [createdInviteCode, setCreatedInviteCode] = useState("");
  const [createdWorkspaceName, setCreatedWorkspaceName] = useState("");
  const [copied, setCopied] = useState(false);

  // Join workspace state
  const [inviteCode, setInviteCode] = useState("");
  const [joinedWorkspaceName, setJoinedWorkspaceName] = useState("");

  const isTeacher = role === "teacher" || role === "admin";

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceName.trim()) return;
    setError("");
    setLoading(true);
    try {
      const { data } = await workspaceAPI.create({
        name: workspaceName.trim(),
        type: "personal",
      });
      setCreatedInviteCode(data.invite_code);
      setCreatedWorkspaceName(data.name);
      // Switch to newly created workspace to get updated token
      const loginResponse = await workspaceAPI.switchWorkspace({
        workspace_id: data.id,
      });
      login(loginResponse.data);
      setStep("success");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to create workspace");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = inviteCode.trim().toUpperCase();
    if (!code) return;
    setError("");
    setLoading(true);
    try {
      const { data } = await workspaceAPI.joinByCode({ invite_code: code });
      setJoinedWorkspaceName(data.workspace_name || "Classroom");
      // Switch to the joined workspace
      const loginResponse = await workspaceAPI.switchWorkspace({
        workspace_id: data.workspace_id,
      });
      login(loginResponse.data);
      setStep("success");
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError("Invalid invite code. Please check and try again.");
      } else {
        setError(err.response?.data?.detail || "Failed to join workspace");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExploreSolo = async () => {
    setError("");
    setLoading(true);
    try {
      const { data } = await workspaceAPI.create({
        name: "My Study Space",
        type: "personal",
      });
      const loginResponse = await workspaceAPI.switchWorkspace({
        workspace_id: data.id,
      });
      login(loginResponse.data);
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to create workspace");
    } finally {
      setLoading(false);
    }
  };

  const copyInviteCode = async () => {
    try {
      await navigator.clipboard.writeText(createdInviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = createdInviteCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Success screen
  if (step === "success") {
    const wsName = createdWorkspaceName || joinedWorkspaceName;
    const isCreated = !!createdWorkspaceName;

    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader className="pb-4">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-xl">
              {isCreated ? "Classroom Created!" : `You've joined ${wsName}!`}
            </CardTitle>
            <CardDescription>
              {isCreated
                ? "Share your invite code with students to get them connected."
                : "You're all set to start learning."}
            </CardDescription>
          </CardHeader>

          {isCreated && createdInviteCode && (
            <CardContent className="pb-4">
              <p className="mb-2 text-sm text-muted-foreground">
                Your invite code
              </p>
              <div className="flex items-center justify-center gap-2">
                <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 px-6 py-3 font-mono text-2xl font-bold tracking-[0.3em] text-primary">
                  {createdInviteCode}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyInviteCode}
                  className="shrink-0"
                  aria-label="Copy invite code"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          )}

          <CardFooter className="justify-center">
            <Button onClick={() => navigate("/")} className="gap-2">
              Go to Dashboard
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Create workspace form
  if (step === "create") {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-xl">Create Your Classroom</CardTitle>
            <CardDescription>
              Set up a workspace and invite your students with a simple code.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <form onSubmit={handleCreateWorkspace} className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="workspace-name"
                  className="text-sm font-medium text-foreground"
                >
                  Classroom Name
                </label>
                <Input
                  id="workspace-name"
                  placeholder="e.g. Mrs. Sharma's Class"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setStep("choose");
                    setError("");
                  }}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !workspaceName.trim()}
                  className="flex-1"
                >
                  {loading ? "Creating..." : "Create Classroom"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Join workspace form
  if (step === "join") {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-xl">Join a Classroom</CardTitle>
            <CardDescription>
              Enter the 6-digit invite code from your teacher to join their
              classroom.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <form onSubmit={handleJoinWorkspace} className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="invite-code"
                  className="text-sm font-medium text-foreground"
                >
                  Invite Code
                </label>
                <Input
                  id="invite-code"
                  placeholder="e.g. ABC123"
                  value={inviteCode}
                  onChange={(e) =>
                    setInviteCode(e.target.value.toUpperCase().slice(0, 6))
                  }
                  maxLength={6}
                  className="font-mono text-center text-lg tracking-[0.3em] uppercase"
                  required
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setStep("choose");
                    setError("");
                  }}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={loading || inviteCode.trim().length < 6}
                  className="flex-1"
                >
                  {loading ? "Joining..." : "Join Classroom"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Choose step (default)
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome to ExamIQ
          </h1>
          <p className="mt-2 text-muted-foreground">
            {isTeacher
              ? "Set up your classroom to start creating exams and tracking student progress."
              : "Join your teacher's classroom or explore on your own."}
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 px-4 py-3 text-center text-sm text-destructive">
            {error}
          </div>
        )}

        <div
          className={cn(
            "grid gap-4",
            isTeacher ? "md:grid-cols-1" : "md:grid-cols-2",
          )}
        >
          {isTeacher ? (
            <Card
              className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg"
              onClick={() => setStep("create")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setStep("create")}
            >
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <GraduationCap className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">
                      Create Your Classroom
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Set up your workspace, create question banks and papers,
                      then invite students with a simple code.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-2 text-sm text-primary">
                  Get started
                  <ArrowRight className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card
                className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg"
                onClick={() => setStep("join")}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && setStep("join")}
              >
                <CardHeader>
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">Join a Classroom</CardTitle>
                  <CardDescription>
                    Enter the invite code from your teacher to join their
                    classroom and access assigned exams.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-2 text-sm text-primary">
                    Enter invite code
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg"
                onClick={handleExploreSolo}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && handleExploreSolo()}
              >
                <CardHeader>
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary/50">
                    <BookOpen className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <CardTitle className="text-lg">Explore on My Own</CardTitle>
                  <CardDescription>
                    Create a personal study space for self-practice. You can
                    always join a classroom later.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {loading ? "Setting up..." : "Start exploring"}
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkspaceSetup;
