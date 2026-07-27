const DEFAULT_API_BASE_URL = "http://localhost:8000";

export type AuthPayload = {
  email: string;
  password: string;
};

export type AuthUser = {
  id: number;
  email: string;
};

export type AuthResponse = {
  user: AuthUser;
};

export type SessionResponse = {
  user: AuthUser;
};

export type RecentDocumentDraftSummary = {
  documentKey: DocumentKey;
  status: string;
  updatedAt: string;
  documentTitle: string;
};

export type RecentDocumentDraftsResponse = {
  drafts: RecentDocumentDraftSummary[];
};

export type DocumentKey =
  | "mutual-nda"
  | "cloud-service-agreement"
  | "service-level-agreement"
  | "professional-services-agreement"
  | "data-processing-agreement"
  | "design-partner-agreement"
  | "ai-addendum"
  | "pilot-agreement"
  | "software-license-agreement"
  | "partnership-agreement"
  | "business-associate-agreement";

export type DraftStatus = "draft" | "review";
export type InputMode = "chat" | "form";
export type ChatMessageRole = "assistant" | "user";

export type MutualNdaParty = {
  printName: string;
  title: string;
  company: string;
  noticeAddress: string;
  signatureDate: string;
};

export type MutualNdaDraft = {
  purpose: string;
  effectiveDate: string;
  mndaTermType: "fixed" | "until-terminated";
  mndaTermYears: number;
  confidentialityTermType: "fixed" | "perpetual";
  confidentialityTermYears: number;
  governingLaw: string;
  jurisdiction: string;
  modifications: string;
  partyOne: MutualNdaParty;
  partyTwo: MutualNdaParty;
};

export type GenericDocumentParty = {
  role: string;
  name: string;
  title: string;
  company: string;
  email: string;
  address: string;
};

export type GenericDocumentDraft = {
  documentTitle: string;
  effectiveDate: string;
  businessPurpose: string;
  governingLaw: string;
  keyTerms: string;
  specialTerms: string;
  parties: GenericDocumentParty[];
};

export type DocumentDraft = MutualNdaDraft | GenericDocumentDraft;

export type ChatMessage = {
  role: ChatMessageRole;
  content: string;
};

export type ChatQuestion = {
  key: string;
  prompt: string;
};

export type ChatQuestionGroup = {
  title: string;
  questions: ChatQuestion[];
};

export type DocumentDraftChatState = {
  messages: ChatMessage[];
  questionGroups: ChatQuestionGroup[];
};

export type DocumentDraftSnapshot = {
  documentKey: DocumentKey;
  status: DraftStatus;
  inputMode: InputMode;
  draft: DocumentDraft;
  chat: DocumentDraftChatState;
};

export type DocumentDraftResponse = {
  draft: DocumentDraftSnapshot;
};

export type SaveDocumentDraftPayload = {
  status: DraftStatus;
  inputMode: InputMode;
  draft: DocumentDraft;
  chat: DocumentDraftChatState;
};

export type ChatTurnPayload = {
  message: string;
  draft: DocumentDraft;
  chat: DocumentDraftChatState;
};

export type ChatTurnResponse = {
  draft: DocumentDraftSnapshot;
  assistantMessage: string;
  readyForReview: boolean;
  switchTo?: DocumentKey | null;
};

export type ReviewDraftResponse = {
  fieldErrors: Record<string, string>;
  readyForDownload: boolean;
};

export type DocumentDraftError = {
  fieldErrors?: Record<string, string>;
  error?: string;
  detail?: string;
};

function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({ error: "Request failed" }))) as DocumentDraftError;
    if (error.fieldErrors) {
      throw new Error(typeof error.error === "string" ? error.error : "Invalid draft", {
        cause: error.fieldErrors,
      });
    }
    throw new Error(
      typeof error.error === "string"
        ? error.error
        : typeof error.detail === "string"
          ? error.detail
          : "Request failed",
    );
  }

  return response;
}

async function authRequest(path: string, payload: AuthPayload): Promise<AuthResponse> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({ error: "Request failed" }))) as { error?: string; detail?: string };
    throw new Error(
      typeof error.detail === "string"
        ? error.detail
        : typeof error.error === "string"
          ? error.error
          : "Request failed",
    );
  }

  return (await response.json()) as AuthResponse;
}

export async function signUp(payload: AuthPayload): Promise<AuthResponse> {
  return authRequest("/api/auth/sign-up", payload);
}

export async function signIn(payload: AuthPayload): Promise<AuthResponse> {
  return authRequest("/api/auth/sign-in", payload);
}

export async function signOut(): Promise<void> {
  await fetch(`${getApiBaseUrl()}/api/auth/sign-out`, {
    method: "POST",
    credentials: "include",
  });
}

export async function getSession(): Promise<SessionResponse | null> {
  const response = await fetch(`${getApiBaseUrl()}/api/auth/session`, {
    credentials: "include",
  });
  if (response.status === 401) {
    return null;
  }
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as SessionResponse;
}

export async function getRecentDocumentDrafts(): Promise<RecentDocumentDraftsResponse> {
  const response = await apiFetch("/api/document-drafts");
  return (await response.json()) as RecentDocumentDraftsResponse;
}

export async function getDocumentDraft(documentKey: DocumentKey): Promise<DocumentDraftResponse> {
  const response = await apiFetch(`/api/document-drafts/${documentKey}`);
  return (await response.json()) as DocumentDraftResponse;
}

export async function saveDocumentDraft(documentKey: DocumentKey, payload: SaveDocumentDraftPayload): Promise<DocumentDraftResponse> {
  const response = await apiFetch(`/api/document-drafts/${documentKey}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return (await response.json()) as DocumentDraftResponse;
}

export async function sendDocumentChatTurn(documentKey: DocumentKey, payload: ChatTurnPayload): Promise<ChatTurnResponse> {
  const response = await apiFetch(`/api/document-drafts/${documentKey}/chat-turn`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return (await response.json()) as ChatTurnResponse;
}

export async function reviewDocumentDraft(documentKey: DocumentKey, payload: SaveDocumentDraftPayload): Promise<ReviewDraftResponse> {
  const response = await apiFetch(`/api/document-drafts/${documentKey}/review`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return (await response.json()) as ReviewDraftResponse;
}
