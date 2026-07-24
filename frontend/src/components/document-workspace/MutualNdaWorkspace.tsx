"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DocumentChatPanel } from "@/components/document-workspace/DocumentChatPanel";
import { InputModeToggle } from "@/components/document-workspace/InputModeToggle";
import { MutualNdaReviewPanel } from "@/components/document-workspace/MutualNdaReviewPanel";
import { MutualNdaEditor } from "@/components/MutualNdaForm";
import type { DocumentDraftSnapshot, SaveDocumentDraftPayload } from "@/lib/api";
import { documentRegistry } from "@/lib/documentRegistry";
import { loadMutualNdaDraft, persistMutualNdaDraft, submitMutualNdaChatTurn } from "@/lib/documentDrafts";
import { flattenZodErrors, type MutualNdaFieldErrors, type MutualNdaFormData } from "@/lib/mutualNdaSchema";

const EMPTY_CHAT = { messages: [], questionGroups: [] };

type WorkspaceStep = "collect" | "review";
type DownloadStatus = "idle" | "generating" | "error" | "success";

function createLocalDraft(): DocumentDraftSnapshot {
  const today = new Date().toISOString().slice(0, 10);
  return {
    documentKey: "mutual-nda",
    status: "draft",
    inputMode: "form",
    draft: documentRegistry["mutual-nda"].createDefaultValues(today),
    chat: EMPTY_CHAT,
  };
}

function toSavePayload(snapshot: DocumentDraftSnapshot): SaveDocumentDraftPayload {
  return {
    status: snapshot.status,
    inputMode: snapshot.inputMode,
    draft: snapshot.draft,
    chat: snapshot.chat,
  };
}

function snapshotSignature(snapshot: DocumentDraftSnapshot): string {
  return JSON.stringify({
    status: snapshot.status,
    inputMode: snapshot.inputMode,
    draft: snapshot.draft,
    chat: snapshot.chat,
  });
}

export function MutualNdaWorkspace() {
  const [snapshot, setSnapshot] = useState<DocumentDraftSnapshot>(() => createLocalDraft());
  const [step, setStep] = useState<WorkspaceStep>("collect");
  const [errors, setErrors] = useState<MutualNdaFieldErrors>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"loading" | "saving" | "saved" | "error">("loading");
  const [isChatSubmitting, setIsChatSubmitting] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>("idle");
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);
  const registry = documentRegistry["mutual-nda"];
  const isLoadedRef = useRef(false);
  const lastSavedSignatureRef = useRef<string | null>(null);
  const saveStateRef = useRef(saveState);
  saveStateRef.current = saveState;

  useEffect(() => {
    let cancelled = false;

    async function loadDraft() {
      try {
        const draft = await loadMutualNdaDraft();
        if (!cancelled) {
          const today = new Date().toISOString().slice(0, 10);
          const hydratedDraft = draft.draft.effectiveDate ? draft : {
            ...draft,
            draft: {
              ...draft.draft,
              effectiveDate: today,
              partyOne: { ...draft.draft.partyOne, signatureDate: today },
              partyTwo: { ...draft.draft.partyTwo, signatureDate: today },
            },
          };
          setSnapshot(hydratedDraft);
          lastSavedSignatureRef.current = snapshotSignature(hydratedDraft);
          setSaveState("saved");
          isLoadedRef.current = true;
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Unable to load draft");
          setSaveState("error");
          isLoadedRef.current = true;
        }
      }
    }

    loadDraft();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isLoadedRef.current) {
      return;
    }

    const signature = snapshotSignature(snapshot);
    if (signature === lastSavedSignatureRef.current) {
      return;
    }

    const timeout = window.setTimeout(async () => {
      if (signature !== lastSavedSignatureRef.current) {
        setSaveState("saving");
        setSaveError(null);
      }
      try {
        await persistMutualNdaDraft(toSavePayload(snapshot));
        lastSavedSignatureRef.current = signature;
        if (saveStateRef.current !== "error") {
          setSaveState("saved");
        }
      } catch (error) {
        setSaveState("error");
        setSaveError(error instanceof Error ? error.message : "Unable to save draft");
      }
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [snapshot]);

  const saveLabel = useMemo(() => {
    if (saveState === "loading") return "Loading draft...";
    if (saveState === "saving") return "Saving draft...";
    if (saveState === "error") return "Draft save failed";
    if (!isLoadedRef.current) return "Loading draft...";
    return "Draft saved";
  }, [saveState]);

  function updateDraft(draft: MutualNdaFormData) {
    setSnapshot((current) => ({
      ...current,
      status: "draft",
      draft,
    }));
    setErrors({});
    if (step === "review") {
      setStep("collect");
    }
  }

  function updateInputMode(inputMode: "chat" | "form") {
    setSnapshot((current) => ({ ...current, inputMode }));
  }

  async function handleChatSubmit(message: string) {
    setIsChatSubmitting(true);
    setChatError(null);
    try {
      const response = await submitMutualNdaChatTurn({
        message,
        draft: snapshot.draft,
        chat: snapshot.chat,
      });
      setSnapshot(response.draft);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Unable to send chat message");
    } finally {
      setIsChatSubmitting(false);
    }
  }

  function beginReview() {
    const result = registry.schema.safeParse(snapshot.draft);
    if (!result.success) {
      setErrors(flattenZodErrors(result.error));
      setSnapshot((current) => ({ ...current, status: "review" }));
      setStep("review");
      return;
    }

    setErrors({});
    setSnapshot((current) => ({ ...current, status: "review", draft: result.data }));
    setStep("review");
  }

  async function downloadPdf() {
    setDownloadMessage(null);
    const result = registry.schema.safeParse(snapshot.draft);

    if (!result.success) {
      setErrors(flattenZodErrors(result.error));
      setDownloadStatus("error");
      setDownloadMessage("Please fix the highlighted fields before downloading.");
      return;
    }

    setErrors({});
    setDownloadStatus("generating");

    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.data),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        if (payload?.fieldErrors) {
          setErrors(payload.fieldErrors);
        }
        throw new Error(payload?.error ?? "Unable to generate PDF");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "mutual-nda.pdf";
      link.click();
      URL.revokeObjectURL(url);
      setDownloadStatus("success");
      setDownloadMessage("PDF generated successfully.");
    } catch (error) {
      setDownloadStatus("error");
      setDownloadMessage(error instanceof Error ? error.message : "Unable to generate PDF");
    }
  }

  return (
    <section className="document-workspace">
      <header className="card workspace-control-card">
        <div>
          <p className="eyebrow">AI-assisted drafting</p>
          <h2>Draft with chat or form fields</h2>
          <p>Both modes edit one persisted Mutual NDA draft. Review is required before download.</p>
        </div>
        <div className="workspace-controls">
          <InputModeToggle value={snapshot.inputMode} onChange={updateInputMode} />
          <span className={saveState === "error" ? "save-status error-text" : "save-status"}>{saveLabel}</span>
        </div>
      </header>

      {loadError ? <p className="error-text">{loadError}</p> : null}
      {saveError ? <p className="error-text">{saveError}</p> : null}

      {step === "review" ? (
        <MutualNdaReviewPanel
          values={snapshot.draft}
          errors={errors}
          status={downloadStatus}
          message={downloadMessage}
          onChange={updateDraft}
          onBackToDraft={() => setStep("collect")}
          onDownload={downloadPdf}
        />
      ) : snapshot.inputMode === "chat" ? (
        <div className="draft-mode-grid">
          <DocumentChatPanel draft={snapshot} isSubmitting={isChatSubmitting} error={chatError} onSubmit={handleChatSubmit} />
          <aside className="card draft-side-panel">
            <h2 className="section-title">Current draft</h2>
            <p>{snapshot.draft.partyOne.company || "Party 1"} and {snapshot.draft.partyTwo.company || "Party 2"}</p>
            <p>{snapshot.draft.purpose}</p>
            <button className="primary-button" type="button" onClick={beginReview}>Review draft</button>
          </aside>
        </div>
      ) : (
        <MutualNdaEditor
          values={snapshot.draft}
          errors={errors}
          onChange={updateDraft}
          actionSlot={(
            <div className="actions">
              <button className="primary-button" type="button" onClick={beginReview}>Review draft</button>
            </div>
          )}
        />
      )}
    </section>
  );
}
