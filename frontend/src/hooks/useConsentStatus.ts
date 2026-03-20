import { useState, useEffect, useCallback } from "react";
import { authAPI } from "../services/api";
import type { ConsentStatus } from "../types";

interface UseConsentStatusReturn {
  consentStatus: ConsentStatus | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  isVoiceEnabled: boolean;
}

export function useConsentStatus(): UseConsentStatusReturn {
  const [consentStatus, setConsentStatus] = useState<ConsentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await authAPI.getConsentStatus();
      setConsentStatus(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to fetch consent status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    consentStatus,
    loading,
    error,
    refetch: fetchStatus,
    isVoiceEnabled: consentStatus?.voice_features_enabled ?? false,
  };
}
