import { useState } from "react";
import type { DocumentDraftSnapshot } from "@/lib/api";

type DocumentChatPanelProps = {
  draft: DocumentDraftSnapshot;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (message: string) => Promise<void>;
};

export function DocumentChatPanel({ draft, isSubmitting, error, onSubmit }: DocumentChatPanelProps) {
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim()) {
      return;
    }

    const currentMessage = message;
    setMessage("");
    await onSubmit(currentMessage);
  }

  return (
    <section className="chat-panel card">
      <div className="chat-panel-header">
        <h2 className="section-title">AI chat</h2>
        <p>Answer grouped questions and keep the form draft in sync automatically.</p>
      </div>

      <div className="chat-transcript" aria-label="Mutual NDA chat transcript">
        {draft.chat.messages.length === 0 ? (
          <p className="chat-empty">Start by describing the NDA parties, purpose, and preferred terms.</p>
        ) : (
          draft.chat.messages.map((entry, index) => (
            <article key={`${entry.role}-${index}`} className={entry.role === "assistant" ? "chat-message chat-message-assistant" : "chat-message chat-message-user"}>
              <strong>{entry.role === "assistant" ? "Assistant" : "You"}</strong>
              <p>{entry.content}</p>
            </article>
          ))
        )}
      </div>

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
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Describe the agreement parties, term preferences, or answer the grouped questions above."
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
