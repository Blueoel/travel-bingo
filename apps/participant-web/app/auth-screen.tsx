"use client";

import { useState } from "react";
import { userMessage } from "./user-message";

type AuthMode = "login" | "register" | "forgot" | "reset";

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
  const [mode, setMode] = useState<AuthMode>(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("resetToken")
      ? "reset"
      : "login",
  );
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
    if ((mode === "register" || mode === "reset") && password !== passwordConfirm) {
      setMessage("비밀번호가 서로 일치하지 않아요.");
      return;
    }
    if (mode === "register" && !agreed) {
      setMessage("이용약관과 개인정보 수집·이용에 동의해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "forgot") {
        const response = await fetch(`${API_BASE}/auth/password-reset/request`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const result = (await response.json().catch(() => null)) as { message?: string } | null;
        if (!response.ok) throw new Error(result?.message ?? "재설정 메일을 보내지 못했어요.");
        setMessageKind("success");
        setMessage(result?.message ?? "가입된 이메일이라면 비밀번호 재설정 안내를 보내드렸어요.");
        return;
      }
      if (mode === "reset") {
        const token = new URLSearchParams(window.location.search).get("resetToken");
        const response = await fetch(`${API_BASE}/auth/password-reset/confirm`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token, newPassword: password }),
        });
        const result = (await response.json().catch(() => null)) as { message?: string } | null;
        if (!response.ok) throw new Error(result?.message ?? "비밀번호를 재설정하지 못했어요.");
        window.history.replaceState({}, "", window.location.pathname);
        setPassword("");
        setPasswordConfirm("");
        setMode("login");
        setMessageKind("success");
        setMessage("비밀번호를 변경했어요. 새 비밀번호로 로그인해주세요.");
        return;
      }
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
      setMessage(userMessage(error, "서버와 연결하지 못했어요. 잠시 후 다시 시도해주세요."));
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
        <img
          src={mode === "login" ? "/brand/logo-text.svg" : "/brand/logo-notext.svg"}
          alt="Travel Bingo"
        />
      </div>

      {mode === "login" && (
        <section className="auth-copy">
          <p>오늘도 작은 발견을 시작해보세요.</p>
        </section>
      )}
      {mode === "register" && (
        <section className="auth-copy auth-register-title">
          <h1><span>Travel Bingo</span> 시작하기</h1>
        </section>
      )}
      {mode === "forgot" && (
        <section className="auth-copy auth-register-title">
          <h1>비밀번호 찾기</h1>
          <p>가입한 이메일로 재설정 링크를 보내드려요.</p>
        </section>
      )}
      {mode === "reset" && (
        <section className="auth-copy auth-register-title">
          <h1>새 비밀번호 설정</h1>
          <p>8자 이상의 새 비밀번호를 입력해주세요.</p>
        </section>
      )}

      <form className="auth-form" onSubmit={submit}>
        {mode === "register" && (
          <label>
            <span className="field-icon"><img src="/icons/navigation/my.svg?v=124" alt="" /></span>
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
        {(mode === "login" || mode === "register" || mode === "forgot") && <label>
          <span className="field-icon"><img src="/icons/ui/mail.svg?v=124" alt="" /></span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="이메일 주소"
            autoComplete="email"
            required
          />
        </label>}
        {(mode === "login" || mode === "register" || mode === "reset") && <label>
          <span className="field-icon"><img src="/icons/ui/key.svg?v=124" alt="" /></span>
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
        </label>}
        {(mode === "register" || mode === "reset") && (
          <label>
            <span className="field-icon"><img src="/icons/ui/key.svg?v=124" alt="" /></span>
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
            onClick={() => switchMode("forgot")}
          >
            비밀번호 찾기
          </button>
        ) : mode === "register" ? (
          <label className="terms-check">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
            />
            <span>
              <a href="/terms" target="_blank" rel="noreferrer">이용약관</a> 및 <a href="/privacy" target="_blank" rel="noreferrer">개인정보처리방침</a>에 동의합니다.
            </span>
          </label>
        ) : null}

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
              : mode === "register"
                ? "회원가입"
                : mode === "forgot"
                  ? "재설정 메일 보내기"
                  : "비밀번호 변경"}
        </button>
      </form>

      <p className="auth-switch">
        {mode === "login" ? "계정이 없으신가요?" : mode === "register" ? "이미 계정이 있으신가요?" : "로그인 화면으로 돌아갈까요?"}
        <button
          type="button"
          onClick={() => switchMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "회원가입" : "로그인"}
        </button>
      </p>

      <section className="auth-permission-guide" aria-label="앱 권한 사용 안내">
        <strong>권한 사용 안내</strong>
        <p><b>카메라</b> QR 코드 확인과 현장 사진 촬영에 사용해요.</p>
        <p><b>사진</b> 미션 인증 사진 선택과 프로필 사진 설정에 사용해요.</p>
        <p><b>위치</b> 주변 지역 추천과 장소·거리 미션 인증에 사용해요.</p>
        <small>각 권한은 해당 기능을 사용할 때만 요청하며, 거부하면 관련 기능이 제한될 수 있어요.</small>
      </section>

    </main>
  );
}
