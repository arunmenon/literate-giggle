import React, { useState } from "react";
import { authAPI } from "../services/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  Input,
  Button,
} from "./ui";
import type { ConsentStatus } from "../types";

interface ConsentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConsentGranted?: (status: ConsentStatus) => void;
}

const ConsentModal: React.FC<ConsentModalProps> = ({
  open,
  onOpenChange,
  onConsentGranted,
}) => {
  const [guardianName, setGuardianName] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const canSubmit =
    guardianName.trim().length > 0 &&
    guardianEmail.trim().length > 0 &&
    confirmed &&
    !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setError("");
    setLoading(true);
    try {
      const { data } = await authAPI.grantConsent({
        guardian_name: guardianName.trim(),
        guardian_email: guardianEmail.trim(),
      });
      setSuccess(true);
      onConsentGranted?.({
        parental_consent_given: data.parental_consent_given,
        consent_given_at: data.consent_given_at,
        guardian_name: data.guardian_name,
        voice_features_enabled: data.voice_features_enabled,
      });
    } catch (err: any) {
      setError(
        err.response?.data?.detail || "Failed to grant consent. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setGuardianName("");
      setGuardianEmail("");
      setConfirmed(false);
      setError("");
      setSuccess(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {success ? "Consent Granted" : "Parental Consent Required"}
          </DialogTitle>
          <DialogDescription>
            {success
              ? "Voice features are now enabled for this account."
              : "Voice features require parental consent under the Digital Personal Data Protection (DPDP) Act, 2023. All students in Classes 7-12 are considered minors and need guardian approval."}
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="space-y-4">
            <div className="rounded-md border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-400">
              Consent granted! Voice features are now enabled.
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
              <p className="font-medium">What this enables:</p>
              <ul className="mt-1 list-disc pl-4 space-y-0.5">
                <li>Voice-to-text for exam answers</li>
                <li>AI Tutor voice conversations</li>
                <li>Voice navigation commands</li>
              </ul>
              <p className="mt-2 text-xs">
                No audio is stored. Only text transcripts are retained.
              </p>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="guardian_name"
                className="text-sm font-medium text-foreground"
              >
                Parent/Guardian Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="guardian_name"
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
                placeholder="Full name of parent or guardian"
                required
                autoComplete="name"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="guardian_email"
                className="text-sm font-medium text-foreground"
              >
                Parent/Guardian Email <span className="text-destructive">*</span>
              </label>
              <Input
                id="guardian_email"
                type="email"
                value={guardianEmail}
                onChange={(e) => setGuardianEmail(e.target.value)}
                placeholder="guardian@example.com"
                required
                autoComplete="email"
              />
              <p className="text-xs text-muted-foreground">
                Must be different from the student's email address.
              </p>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
              />
              <span className="text-sm text-foreground leading-tight">
                I confirm that I am the parent/guardian of this student and I
                consent to the processing of voice data for educational purposes
                under the DPDP Act, 2023.
              </span>
            </label>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {loading ? "Granting consent..." : "Grant Consent"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ConsentModal;
