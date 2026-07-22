import {
  getDocumentDraft,
  reviewDocumentDraft,
  saveDocumentDraft,
  sendDocumentChatTurn,
  type ChatTurnResponse,
  type DocumentDraftSnapshot,
  type ReviewDraftResponse,
  type SaveDocumentDraftPayload,
} from "@/lib/api";

export async function loadMutualNdaDraft(): Promise<DocumentDraftSnapshot> {
  const response = await getDocumentDraft("mutual-nda");
  return response.draft;
}

export async function persistMutualNdaDraft(payload: SaveDocumentDraftPayload): Promise<DocumentDraftSnapshot> {
  const response = await saveDocumentDraft("mutual-nda", payload);
  return response.draft;
}

export async function submitMutualNdaChatTurn(payload: {
  message: string;
  draft: SaveDocumentDraftPayload["draft"];
  chat: SaveDocumentDraftPayload["chat"];
}): Promise<ChatTurnResponse> {
  return sendDocumentChatTurn("mutual-nda", payload);
}

export async function reviewMutualNdaDraft(payload: SaveDocumentDraftPayload): Promise<ReviewDraftResponse> {
  return reviewDocumentDraft("mutual-nda", payload);
}
