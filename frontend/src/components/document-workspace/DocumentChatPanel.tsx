import { useEffect, useRef, useState } from "react";
import type { DocumentDraftSnapshot, DocumentKey } from "@/lib/api";

type DocumentChatPanelProps = {
  draft: DocumentDraftSnapshot;
  isSubmitting: boolean;
  error: string | null;
  switchSuggestion: DocumentKey | null;
  onSwitch: (target: DocumentKey) => void;
  onSubmit: (message: string) => Promise<void>;
};

export function DocumentChatPanel({ draft, isSubmitting, error, switchSuggestion, onSwitch, onSubmit }: DocumentChatPanelProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const transcriptLength = draft.chat.messages.length;

  useEffect(() => {
    if (isSubmitting) {
      return;
    }
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.focus();
    }
  }, [transcriptLength, isSubmitting]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim()) {
      return;
    }

    const currentMessage = message;
    setMessage("");
    await onSubmit(currentMessage);
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.focus();
    }
  }

  return (
    <section className="chat-panel card">
      <div className="chat-panel-header">
        <h2 className="section-title">AI chat</h2>
        <p>Answer grouped questions and keep the form draft in sync automatically.</p>
      </div>

      <div className="chat-transcript" aria-label="Document chat transcript">
        {draft.chat.messages.length === 0 ? (
          <p className="chat-empty">
            Describe the parties and business purpose, or tell the chat which document you need.
          </p>
        ) : (
          draft.chat.messages.map((entry, index) => (
            <article key={`${entry.role}-${index}`} className={entry.role === "assistant" ? "chat-message chat-message-assistant" : "chat-message chat-message-user"}>
              <strong>{entry.role === "assistant" ? "Assistant" : "You"}</strong>
              <p>{entry.content}</p>
            </article>
          ))
        )}
      </div>

      {switchSuggestion ? (
        <div className="chat-switch-suggestion card">
          <p>
            I can switch to a {switchSuggestion.replace(/-/g, " ")} draft instead.
          </p>
          <button className="primary-button" type="button" onClick={() => onSwitch(switchSuggestion)}>
            Switch draft
          </button>
        </div>
      ) : null}

      <div className="chat-question-groups">
        {draft.chat.questionGroups.map((group) => (
          <section key={group.title} className="question-group card">
            <h3>{group.title}</h3>
            <ul>
              {group.questions.map((question) => (
                <li key={question.key}>{question.prompt}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <form className="chat-form" onSubmit={handleSubmit}>
        <label className="field" htmlFor="chat-message">
          <span>Your answer</span>
          <textarea
            id="chat-message"
            name="chat-message"
            rows={4}
            value={message}
            ref={textareaRef}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Describe the parties, term preferences, or ask to switch documents."
          />
        </label>
        <div className="actions">
          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Sending..." : "Send answer"}
          </button>
          {error ? <span className="error-text">{error}</span> : null}
        </div>
      </form>
    </section>
  );
}
