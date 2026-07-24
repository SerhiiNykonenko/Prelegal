"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DocumentChatPanel } from "@/components/document-workspace/DocumentChatPanel";
import { GenericDocumentEditor } from "@/components/document-workspace/GenericDocumentEditor";
import { GenericDocumentReviewPanel } from "@/components/document-workspace/GenericDocumentReviewPanel";
import { MutualNdaReviewPanel } from "@/components/document-workspace/MutualNdaReviewPanel";
import { MutualNdaEditor } from "@/components/MutualNdaForm";
import type { DocumentDraft, DocumentDraftSnapshot, DocumentKey, GenericDocumentDraft, MutualNdaDraft, SaveDocumentDraftPayload } from "@/lib/api";
import { documentRegistry, flattenGenericZodErrors, type GenericDocumentFieldErrors } from "@/lib/documentRegistry";
import { loadDocumentDraft, persistDocumentDraft, submitDocumentChatTurn } from "@/lib/documentDrafts";
import { flattenZodErrors, type MutualNdaFieldErrors, type MutualNdaFormData } from "@/lib/mutualNdaSchema";

const EMPTY_CHAT = { messages: [], questionGroups: [] };

type WorkspaceStep = "collect" | "review";
type DownloadStatus = "idle" | "generating" | "error" | "success";
type FieldErrors = MutualNdaFieldErrors | GenericDocumentFieldErrors;

function isMutualNdaDraft(draft: DocumentDraft): draft is MutualNdaDraft {
  return "partyOne" in draft;
}

function isGenericDraft(draft: DocumentDraft): draft is GenericDocumentDraft {
  return "parties" in draft;
}

function createLocalDraft(documentKey: DocumentKey): DocumentDraftSnapshot {
  const today = new Date().toISOString().slice(0, 10);
  return {
    documentKey,
    status: "draft",
    inputMode: "form",
    draft: documentRegistry[documentKey].createDefaultValues(today),
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

function snapshotSignature(snapshot: DocumentDraftSnapshot) {
  return JSON.stringify({
    documentKey: snapshot.documentKey,
    status: snapshot.status,
    inputMode: snapshot.inputMode,
    draft: snapshot.draft,
    chat: snapshot.chat,
  });
}

function coerceErrors(error: unknown): FieldErrors {
  const zodError = error as Parameters<typeof flattenZodErrors>[0];
  return flattenZodErrors(zodError);
}

function buildSummary(snapshot: DocumentDraftSnapshot) {
  if (isMutualNdaDraft(snapshot.draft)) {
    return {
      title: `${snapshot.draft.partyOne.company || "Party 1"} and ${snapshot.draft.partyTwo.company || "Party 2"}`,
      description: snapshot.draft.purpose,
    };
  }

  return {
    title: snapshot.draft.parties.map((party) => party.company || party.name || party.role).join(" and "),
    description: snapshot.draft.businessPurpose || snapshot.draft.keyTerms,
  };
}

export function MutualNdaWorkspace({ documentKey = "mutual-nda" }: { documentKey?: DocumentKey }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<DocumentDraftSnapshot>(() => createLocalDraft(documentKey));
  const [step, setStep] = useState<WorkspaceStep>("collect");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"loading" | "saving" | "saved" | "error">("loading");
  const [isChatSubmitting, setIsChatSubmitting] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>("idle");
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);
  const [switchTarget, setSwitchTarget] = useState<DocumentKey | null>(null);
  const registry = documentRegistry[documentKey];
  const isLoadedRef = useRef(false);
  const lastSavedSignatureRef = useRef<string | null>(null);
  const saveStateRef = useRef(saveState);
  saveStateRef.current = saveState;

  useEffect(() => {
    let isCurrent = true;
    isLoadedRef.current = false;
    setSaveState("loading");
    setLoadError(null);
    setErrors({});
    setStep("collect");
    setSnapshot(createLocalDraft(documentKey));

    loadDocumentDraft(documentKey)
      .then((draft) => {
        if (!isCurrent) return;
        const hydrated = draft && draft.draft ? draft : createLocalDraft(documentKey);
        setSnapshot(hydrated);
        lastSavedSignatureRef.current = snapshotSignature(hydrated);
        setSaveState("saved");
      })
      .catch((error) => {
        if (isCurrent) {
          setLoadError(error instanceof Error ? error.message : "Unable to load draft");
          setSaveState("error");
        }
      })
      .finally(() => {
        if (isCurrent) {
          isLoadedRef.current = true;
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [documentKey]);

  useEffect(() => {
    if (!isLoadedRef.current) return;
    if (saveState === "loading") return;

    const currentSignature = snapshotSignature(snapshot);
    if (currentSignature === lastSavedSignatureRef.current) return;

    const timeout = window.setTimeout(async () => {
      setSaveState("saving");
      try {
        await persistDocumentDraft(snapshot.documentKey, toSavePayload(snapshot));
        lastSavedSignatureRef.current = currentSignature;
        setSaveError(null);
        setSaveState("saved");
      } catch (error) {
        setSaveState("error");
        setSaveError(error instanceof Error ? error.message : "Unable to save draft");
      }
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [snapshot, saveState]);

  const saveLabel = useMemo(() => {
    if (saveState === "loading") return "Loading draft...";
    if (saveState === "saving") return "Saving draft...";
    if (saveState === "error") return "Draft save failed";
    return "Draft saved";
  }, [saveState]);

  function updateDraft(draft: DocumentDraft) {
    setSnapshot((current) => ({ ...current, draft, status: "draft", inputMode: "form" }));
    setDownloadStatus("idle");
    setDownloadMessage(null);
    setErrors({});
  }

  async function handleChatSubmit(message: string) {
    setIsChatSubmitting(true);
    setChatError(null);

    try {
      const response = await submitDocumentChatTurn(snapshot.documentKey, {
        message,
        draft: snapshot.draft,
        chat: snapshot.chat,
      });
      setSnapshot(response.draft);
      lastSavedSignatureRef.current = snapshotSignature(response.draft);
      if (response.switchTo) {
        setSwitchTarget(response.switchTo);
      }
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Unable to send chat message");
    } finally {
      setIsChatSubmitting(false);
    }
  }

  function handleSwitchDocument(target: DocumentKey) {
    setSwitchTarget(null);
    router.push(`/app/agreements/${target}`);
  }

  function validateDraft() {
    const result = registry.schema.safeParse(snapshot.draft);
    if (!result.success) {
      if (snapshot.documentKey === "mutual-nda") {
        setErrors(coerceErrors(result.error));
      } else {
        setErrors(flattenGenericZodErrors(result.error));
      }
      setSnapshot((current) => ({ ...current, status: "review" }));
      return false;
    }

    setSnapshot((current) => ({ ...current, draft: result.data, status: "review" }));
    setErrors({});
    return true;
  }

  function beginReview() {
    validateDraft();
    setStep("review");
  }

  function backToDraft() {
    setStep("collect");
    setDownloadStatus("idle");
    setDownloadMessage(null);
  }

  async function downloadPdf() {
    setDownloadStatus("generating");
    setDownloadMessage(null);

    const result = registry.schema.safeParse(snapshot.draft);
    if (!result.success) {
      if (snapshot.documentKey === "mutual-nda") {
        setErrors(coerceErrors(result.error));
      } else {
        setErrors(flattenGenericZodErrors(result.error));
      }
      setDownloadStatus("error");
      setDownloadMessage("Review the highlighted fields before downloading.");
      return;
    }

    setErrors({});

    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentKey: snapshot.documentKey, draft: result.data }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        if (payload?.fieldErrors) {
          setErrors(payload.fieldErrors);
        }
        throw new Error(payload?.error ?? "Unable to generate PDF");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${snapshot.documentKey}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setDownloadStatus("success");
      setDownloadMessage("PDF generated successfully.");
    } catch (error) {
      setDownloadStatus("error");
      setDownloadMessage(error instanceof Error ? error.message : "Unable to generate PDF");
    }
  }

  const summary = buildSummary(snapshot);

  if (step === "review") {
    if (snapshot.documentKey === "mutual-nda" && isMutualNdaDraft(snapshot.draft)) {
      return (
        <MutualNdaReviewPanel
          values={snapshot.draft as MutualNdaFormData}
          errors={errors as MutualNdaFieldErrors}
          status={downloadStatus}
          message={downloadMessage}
          onChange={updateDraft}
          onDownload={downloadPdf}
          onBackToDraft={backToDraft}
        />
      );
    }

    if (isGenericDraft(snapshot.draft)) {
      return (
        <GenericDocumentReviewPanel
          values={snapshot.draft}
          errors={errors as GenericDocumentFieldErrors}
          status={downloadStatus}
          message={downloadMessage}
          onChange={updateDraft}
          onDownload={downloadPdf}
          onBackToDraft={backToDraft}
        />
      );
    }
  }

  return (
    <section className="workspace-card card">
      <div className="workspace-card-header">
        <div>
          <p className="eyebrow">Draft workspace</p>
          <h2>{registry.title}</h2>
          <p>Use the chat and form together. You can ask the chat to switch to another supported document.</p>
        </div>
        <span className={saveState === "error" ? "save-status error-text" : "save-status"}>{saveLabel}</span>
      </div>

      {loadError ? <p className="error-text">{loadError}</p> : null}
      {saveError ? <p className="error-text">{saveError}</p> : null}

      <div className="draft-mode-grid draft-mode-grid-parallel">
        <DocumentChatPanel
          draft={snapshot}
          isSubmitting={isChatSubmitting}
          error={chatError}
          switchSuggestion={switchTarget}
          onSwitch={handleSwitchDocument}
          onSubmit={handleChatSubmit}
        />
        <div className="document-form-column">
          {snapshot.documentKey === "mutual-nda" && isMutualNdaDraft(snapshot.draft) ? (
            <MutualNdaEditor
              values={snapshot.draft as MutualNdaFormData}
              errors={errors as MutualNdaFieldErrors}
              onChange={updateDraft}
              actionSlot={<button className="primary-button" type="button" onClick={beginReview}>Review draft</button>}
            />
          ) : isGenericDraft(snapshot.draft) ? (
            <GenericDocumentEditor
              values={snapshot.draft}
              errors={errors as GenericDocumentFieldErrors}
              onChange={updateDraft}
              actionSlot={<button className="primary-button" type="button" onClick={beginReview}>Review draft</button>}
            />
          ) : null}
          <aside className="card draft-side-panel">
            <h2 className="section-title">Current draft</h2>
            <p>{summary.title}</p>
            <p>{summary.description || "Answer the follow-up questions to complete this draft."}</p>
          </aside>
        </div>
      </div>
    </section>
  );
}
