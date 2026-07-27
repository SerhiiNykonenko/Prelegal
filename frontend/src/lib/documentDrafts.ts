import {
  getDocumentDraft,
  reviewDocumentDraft,
  saveDocumentDraft,
  sendDocumentChatTurn,
  type ChatTurnResponse,
  type DocumentDraftSnapshot,
  type DocumentKey,
  type ReviewDraftResponse,
  type SaveDocumentDraftPayload,
} from "@/lib/api";

export async function loadDocumentDraft(documentKey: DocumentKey): Promise<DocumentDraftSnapshot> {
  const response = await getDocumentDraft(documentKey);
  return response.draft;
}

export async function persistDocumentDraft(documentKey: DocumentKey, payload: SaveDocumentDraftPayload): Promise<DocumentDraftSnapshot> {
  const response = await saveDocumentDraft(documentKey, payload);
  return response.draft;
}

export async function submitDocumentChatTurn(
  documentKey: DocumentKey,
  payload: {
    message: string;
    draft: SaveDocumentDraftPayload["draft"];
    chat: SaveDocumentDraftPayload["chat"];
  },
): Promise<ChatTurnResponse> {
  return sendDocumentChatTurn(documentKey, payload);
}

export async function reviewCurrentDocumentDraft(
  documentKey: DocumentKey,
  payload: SaveDocumentDraftPayload,
): Promise<ReviewDraftResponse> {
  return reviewDocumentDraft(documentKey, payload);
}
