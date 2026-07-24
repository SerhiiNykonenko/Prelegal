const DEFAULT_API_BASE_URL = "http://localhost:8000";

export type LoginPayload = {
  email: string;
  password: string;
};

export type LoginResponse = {
  user: {
    id: number;
    email: string;
  };
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
  role: "assistant" | "user";
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
  status: "draft" | "review";
  inputMode: "chat" | "form";
  draft: DocumentDraft;
  chat: DocumentDraftChatState;
};

export type DocumentDraftResponse = {
  draft: DocumentDraftSnapshot;
};

export type SaveDocumentDraftPayload = {
  status: "draft" | "review";
  inputMode: "chat" | "form";
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

function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

function getSessionEmail(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const stored = window.sessionStorage.getItem("prelegal-session");
  if (!stored) {
    return "";
  }

  try {
    const parsed = JSON.parse(stored) as { email?: string };
    return typeof parsed.email === "string" ? parsed.email : "";
  } catch {
    return "";
  }
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const sessionEmail = getSessionEmail();
  const headers = new Headers(init.headers ?? {});
  if (sessionEmail) {
    headers.set("x-session-email", sessionEmail);
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(typeof error.error === "string" ? error.error : typeof error.detail === "string" ? error.detail : "Request failed");
  }

  return response;
}

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const response = await fetch(`${getApiBaseUrl()}/api/session-login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Login failed" }));
    throw new Error(typeof error.error === "string" ? error.error : "Login failed");
  }

  return response.json() as Promise<LoginResponse>;
}

export async function getDocumentDraft(documentKey: DocumentKey): Promise<DocumentDraftResponse> {
  const response = await apiFetch(`/api/document-drafts/${documentKey}`);
  return response.json() as Promise<DocumentDraftResponse>;
}

export async function saveDocumentDraft(documentKey: DocumentKey, payload: SaveDocumentDraftPayload): Promise<DocumentDraftResponse> {
  const response = await apiFetch(`/api/document-drafts/${documentKey}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return response.json() as Promise<DocumentDraftResponse>;
}

export async function sendDocumentChatTurn(documentKey: DocumentKey, payload: { message: string; draft: DocumentDraft; chat: DocumentDraftChatState; }): Promise<ChatTurnResponse> {
  const response = await apiFetch(`/api/document-drafts/${documentKey}/chat-turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return response.json() as Promise<ChatTurnResponse>;
}

export async function reviewDocumentDraft(documentKey: DocumentKey, payload: SaveDocumentDraftPayload): Promise<ReviewDraftResponse> {
  const response = await apiFetch(`/api/document-drafts/${documentKey}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return response.json() as Promise<ReviewDraftResponse>;
}
