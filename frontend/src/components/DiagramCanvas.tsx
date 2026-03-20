import React, { useRef, useCallback, useEffect, useState } from "react";
import { Excalidraw, exportToBlob } from "@excalidraw/excalidraw";
import { Button } from "./ui";
import { Save } from "lucide-react";

interface DiagramCanvasProps {
  initialState?: object;
  onSave: (state: object, imageBlob: Blob) => void;
  onAutoSave?: (state: object) => void;
  readOnly?: boolean;
}

const DiagramCanvas: React.FC<DiagramCanvasProps> = ({
  initialState,
  onSave,
  onAutoSave,
  readOnly = false,
}) => {
  const excalidrawAPIRef = useRef<any>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saving, setSaving] = useState(false);

  // Build initial data for Excalidraw from saved state
  const getInitialData = useCallback(() => {
    if (initialState && typeof initialState === "object") {
      const state = initialState as Record<string, unknown>;
      return {
        elements: (state.elements as any[]) || [],
        appState: {
          ...(state.appState as Record<string, unknown> || {}),
          viewModeEnabled: readOnly,
        },
        files: (state.files as Record<string, unknown>) || undefined,
      } as any;
    }
    return { elements: [], appState: { viewModeEnabled: readOnly } } as any;
  }, [initialState, readOnly]);

  // Get current canvas state as a serializable object
  const getCurrentState = useCallback((): object | null => {
    const api = excalidrawAPIRef.current;
    if (!api) return null;
    return {
      elements: api.getSceneElements(),
      appState: {
        viewBackgroundColor: api.getAppState().viewBackgroundColor,
      },
      files: api.getFiles(),
    };
  }, []);

  // Debounced auto-save: saves canvas JSON state (not image) every 5s after changes
  const handleChange = useCallback(() => {
    if (readOnly || !onAutoSave) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      const state = getCurrentState();
      if (state) {
        onAutoSave(state);
      }
    }, 5000);
  }, [readOnly, onAutoSave, getCurrentState]);

  // Cleanup auto-save timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Export to PNG blob and save
  const handleSaveDrawing = useCallback(async () => {
    const api = excalidrawAPIRef.current;
    if (!api) return;

    setSaving(true);
    try {
      const elements = api.getSceneElements();
      if (elements.length === 0) {
        setSaving(false);
        return;
      }

      const blob = await exportToBlob({
        elements,
        appState: {
          ...api.getAppState(),
          exportWithDarkMode: false,
          exportBackground: true,
        },
        files: api.getFiles(),
        mimeType: "image/png",
        quality: 0.92,
      });

      const state = getCurrentState();
      if (state) {
        onSave(state, blob);
      }
    } finally {
      setSaving(false);
    }
  }, [onSave, getCurrentState]);

  return (
    <div className="flex flex-col gap-2">
      <div
        className="relative border border-border rounded-lg overflow-hidden bg-white"
        style={{ minHeight: "400px", height: "500px" }}
      >
        <Excalidraw
          excalidrawAPI={(api: any) => {
            excalidrawAPIRef.current = api;
          }}
          initialData={getInitialData()}
          onChange={handleChange}
          viewModeEnabled={readOnly}
          theme="light"
          UIOptions={{
            canvasActions: {
              saveToActiveFile: false,
              loadScene: false,
              export: false,
              saveAsImage: false,
            },
          }}
        />
      </div>
      {!readOnly && (
        <div className="flex justify-end">
          <Button
            onClick={handleSaveDrawing}
            disabled={saving}
            variant="default"
            size="sm"
          >
            <Save className="h-4 w-4 mr-1.5" />
            {saving ? "Saving..." : "Save Drawing"}
          </Button>
        </div>
      )}
    </div>
  );
};

export default DiagramCanvas;
