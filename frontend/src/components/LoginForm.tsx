"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/api";
import { saveSession } from "@/lib/auth";

type Mode = "sign-in" | "sign-up";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const requiresConfirm = mode === "sign-up";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    if (!trimmedEmail || !trimmedPassword) {
      setError("Email and password are required.");
      return;
    }
    if (requiresConfirm && trimmedPassword !== confirmPassword.trim()) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = requiresConfirm
        ? await signUp({ email: trimmedEmail, password: trimmedPassword })
        : await signIn({ email: trimmedEmail, password: trimmedPassword });
      saveSession(response.user);
      router.push("/app");
      router.refresh();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const heading = mode === "sign-up" ? "Create your account" : "Sign in";
  const subtitle =
    mode === "sign-up"
      ? "Create an account to save and revisit your Prelegal drafts."
      : "Sign in to continue working on your Prelegal drafts.";
  const buttonLabel = requiresConfirm
    ? isSubmitting
      ? "Creating account..."
      : "Create account"
    : isSubmitting
      ? "Signing in..."
      : "Sign in";
  const otherModeLabel = mode === "sign-up" ? "Sign in instead" : "Create an account";
  const toggleMode = () => {
    setMode((current) => (current === "sign-up" ? "sign-in" : "sign-up"));
    setError("");
  };

  return (
    <form className="card login-card" onSubmit={handleSubmit}>
      <div className="login-copy">
        <p className="eyebrow">Prelegal</p>
        <h1>{heading}</h1>
        <p>{subtitle}</p>
      </div>

      <label className="field-group" htmlFor="login-email">
        <span>Email</span>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>

      <label className="field-group" htmlFor="login-password">
        <span>Password</span>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete={requiresConfirm ? "new-password" : "current-password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>

      {requiresConfirm ? (
        <label className="field-group" htmlFor="login-confirm-password">
          <span>Confirm password</span>
          <input
            id="login-confirm-password"
            name="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </label>
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}

      <button className="primary-button" type="submit" disabled={isSubmitting}>
        {buttonLabel}
      </button>

      <button className="secondary-button" type="button" onClick={toggleMode} disabled={isSubmitting}>
        {otherModeLabel}
      </button>
    </form>
  );
}
