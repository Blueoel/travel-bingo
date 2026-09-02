"use client";

import { useState } from "react";

type AuthMode = "login" | "register";

const API_BASE = "/api/backend";

export function AuthScreen({
  onAuthenticated,
}: {
  onAuthenticated: (user: {
    id: string;
    nickname: string;
    email: string | null;
    role?: "USER" | "ADMIN";
  }) => Promise<void>;
}) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<"error" | "success">("error");

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setPassword("");
    setPasswordConfirm("");
    setMessage(null);
    setMessageKind("error");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setMessageKind("error");
    if (mode === "register" && password !== passwordConfirm) {
      setMessage("비밀번호가 서로 일치하지 않아요.");
      return;
    }
    if (mode === "register" && !agreed) {
      setMessage("이용약관과 개인정보 수집·이용에 동의해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(
        `${API_BASE}/auth/${mode === "login" ? "login" : "register"}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...(mode === "register" ? { name } : {}),
            email,
            password,
          }),
        },
      );
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(
          result?.message ??
            (mode === "login"
              ? "이메일 주소 또는 비밀번호를 확인해주세요."
              : "회원가입 정보를 다시 확인해주세요."),
        );
      }
      const result = (await response.json()) as {
        user: {
          id: string;
          nickname: string;
          email: string | null;
          role?: "USER" | "ADMIN";
        };
      };
      if (mode === "register") {
        await fetch(`${API_BASE}/auth/logout`, {
          method: "POST",
          credentials: "include",
        });
        setMode("login");
        setName("");
        setPassword("");
        setPasswordConfirm("");
        setAgreed(false);
        setMessageKind("success");
        setMessage("회원가입이 완료됐어요. 새 계정으로 로그인해주세요.");
        return;
      }
      await onAuthenticated(result.user);
    } catch (error) {
      setMessageKind("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "서버와 연결하지 못했어요. 잠시 후 다시 시도해주세요.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-shell">
      <button
        className={`auth-back ${mode === "login" ? "is-hidden" : ""}`}
        type="button"
        onClick={() => switchMode("login")}
        aria-label="로그인으로 돌아가기"
      >
        ←
      </button>

      <div className={`auth-brand-showcase ${mode}`}>
        <img src="/brand/logo-symbol.svg" alt="Travel Bingo" />
      </div>

      <section className="auth-copy">
        <h1>
          {mode === "login" ? (
            <>
              산책에서 여행까지<span>🌿</span>
            </>
          ) : (
            "Travel Bingo 시작하기"
          )}
        </h1>
        {mode === "login" && <p>오늘도 작은 발견을 시작해보세요.</p>}
        {mode === "register" && <i className="title-scribble" />}
      </section>

      <form className="auth-form" onSubmit={submit}>
        {mode === "register" && (
          <label>
            <span className="field-icon">♙</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="이름"
              autoComplete="name"
              maxLength={40}
              required
            />
          </label>
        )}
        <label>
          <span className="field-icon">✉</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="이메일 주소"
            autoComplete="email"
            required
          />
        </label>
        <label>
          <span className="field-icon">♙</span>
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="비밀번호"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            minLength={8}
            required
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
          >
            {showPassword ? "◉" : "◎"}
          </button>
        </label>
        {mode === "register" && (
          <label>
            <span className="field-icon">♙</span>
            <input
              type={showPassword ? "text" : "password"}
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              placeholder="비밀번호 확인"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
        )}

        {mode === "login" ? (
          <button
            type="button"
            className="forgot-password"
            onClick={() =>
              setMessage(
                "비밀번호 찾기는 이메일 발송 기능과 함께 연결할 예정이에요.",
              )
            }
          >
            비밀번호 찾기
          </button>
        ) : (
          <label className="terms-check">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
            />
            <span>
              <u>이용약관</u> 및 <u>개인정보 수집·이용</u>에 동의합니다.
            </span>
          </label>
        )}

        {message && (
          <p className={`auth-message ${messageKind}`} role="alert">
            {message}
          </p>
        )}

        <button className="auth-submit" disabled={submitting}>
          {submitting
            ? "잠시만 기다려주세요…"
            : mode === "login"
              ? "로그인"
              : "회원가입"}
        </button>
      </form>

      {mode === "login" && (
        <>
          <div className="auth-divider">
            <span>또는</span>
          </div>
          <div className="social-actions">
            <button
              type="button"
              onClick={() => setMessage("Apple 로그인은 곧 연결할 예정이에요.")}
            >
              <b>●</b> Apple로 계속하기
            </button>
            <button
              type="button"
              onClick={() =>
                setMessage("Google 로그인은 곧 연결할 예정이에요.")
              }
            >
              <b className="google-mark">G</b> Google로 계속하기
            </button>
          </div>
        </>
      )}

      <p className="auth-switch">
        {mode === "login" ? "계정이 없으신가요?" : "이미 계정이 있으신가요?"}
        <button
          type="button"
          onClick={() => switchMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "회원가입" : "로그인"}
        </button>
      </p>

      <div className="doodle-ground" aria-hidden="true">
        <span className="hill" />
        <span className="path" />
        <i>✿</i>
        <b>⌁</b>
      </div>
    </main>
  );
}
