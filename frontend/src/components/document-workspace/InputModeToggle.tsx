type InputModeToggleProps = {
  value: "chat" | "form";
  onChange: (value: "chat" | "form") => void;
};

export function InputModeToggle({ value, onChange }: InputModeToggleProps) {
  return (
    <div className="input-mode-toggle" role="tablist" aria-label="Draft input mode">
      <button
        className={value === "form" ? "toggle-button is-active" : "toggle-button"}
        type="button"
        role="tab"
        aria-selected={value === "form"}
        onClick={() => onChange("form")}
      >
        Form
      </button>
      <button
        className={value === "chat" ? "toggle-button is-active" : "toggle-button"}
        type="button"
        role="tab"
        aria-selected={value === "chat"}
        onClick={() => onChange("chat")}
      >
        Chat
      </button>
    </div>
  );
}
