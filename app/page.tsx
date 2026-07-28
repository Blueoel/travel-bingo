"use client";

import { useEffect, useState } from "react";

type MissionKind = "CHECK_IN" | "QUIZ" | "PLACE_VISIT" | "PHOTO" | "COMPOSITE";
type Mission = {
  id: string;
  title: string;
  description: string;
  kind: MissionKind;
  points: number;
  done: boolean;
  difficulty?: "쉬움" | "보통" | "어려움" | "특별";
  estimatedTime?: string;
  verificationLabel?: string;
};
type DailySession = {
  id: string;
  totalPoints: number;
  completedLineKeys: string[];
  cells: Array<{
    id: string;
    position: number;
    status: string;
    mission: {
      title: string;
      description: string;
      kind: MissionKind;
      points: number;
      difficulty?: number;
      estimatedMinutesMin?: number | null;
      estimatedMinutesMax?: number | null;
      targetValue?: string | null;
    };
  }>;
};
type VerificationResult = {
  verificationStatus?: "APPROVED" | "REJECTED";
  reasonCode?: string;
  completedLineKeys: string[];
};
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
type RankingPeriod = "DAILY" | "WEEKLY" | "MONTHLY" | "TOTAL";
type RankingScope = "ALL" | "COMMON" | "REGION";
type RankingEntry = {
  userId: string;
  nickname: string;
  points: number;
  rank: number;
};
type RankingResult = {
  entries: RankingEntry[];
  me: RankingEntry | null;
  endsAt: string | null;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";
const apiFetch = (path: string, init?: RequestInit) =>
  fetch(`${API_BASE}${path}`, { ...init, credentials: "include" });
const demoRanking: RankingEntry[] = [
  { userId: "demo-1", nickname: "산책왕", points: 1980, rank: 1 },
  { userId: "demo-2", nickname: "걷는감자", points: 1850, rank: 2 },
  { userId: "demo-3", nickname: "안성토끼", points: 1620, rank: 3 },
  { userId: "demo-4", nickname: "하늘걷기", points: 1430, rank: 4 },
  { userId: "demo-5", nickname: "바람따라", points: 1280, rank: 5 },
];

const BINGO_LINES = [
  [0, 1, 2, 3, 4],
  [5, 6, 7, 8, 9],
  [10, 11, 12, 13, 14],
  [15, 16, 17, 18, 19],
  [20, 21, 22, 23, 24],
  [0, 5, 10, 15, 20],
  [1, 6, 11, 16, 21],
  [2, 7, 12, 17, 22],
  [3, 8, 13, 18, 23],
  [4, 9, 14, 19, 24],
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20],
] as const;

const completedClientLineKeys = (missions: Mission[]) =>
  BINGO_LINES.flatMap((positions, index) =>
    positions.every((position) => missions[position]?.done)
      ? [`client-line-${index}`]
      : [],
  );
const icon: Record<MissionKind, string> = {
  CHECK_IN: "✓",
  QUIZ: "?",
  PLACE_VISIT: "⌖",
  PHOTO: "▣",
  COMPOSITE: "◷",
};
const contributedDemoMissions: Mission[] = [
  {
    id: "demo-shadow",
    title: "그림자를 따라",
    description: "오늘 가장 재미있는 그림자를 찾아 사진을 남겨보세요.",
    kind: "PHOTO",
    points: 20,
    difficulty: "보통",
    estimatedTime: "10분",
    verificationLabel: "사진 1장",
    done: false,
  },
  {
    id: "demo-comma",
    title: "쉼표",
    description: "마음에 드는 장소를 발견했다면 10분 동안 머물러 보세요.",
    kind: "COMPOSITE",
    points: 10,
    difficulty: "쉬움",
    estimatedTime: "10분",
    verificationLabel: "GPS 체류",
    done: false,
  },
  {
    id: "demo-same-color",
    title: "같은 색 세 장면",
    description:
      "산책 중 같은 색을 가진 서로 다른 대상 세 가지를 발견해보세요. 같은 물건을 반복 촬영하면 인정되지 않아요.",
    kind: "PHOTO",
    points: 20,
    difficulty: "보통",
    estimatedTime: "10~20분",
    verificationLabel: "사진 3장",
    done: false,
  },
  {
    id: "demo-traffic-light",
    title: "신호등 찾기",
    description: "신호등이 있는 교차로를 찾아 사진으로 남겨보세요.",
    kind: "PHOTO",
    points: 10,
    difficulty: "쉬움",
    estimatedTime: "3분",
    verificationLabel: "사진 1장",
    done: false,
  },
];
const demoTitles = [
  "가볍게 스트레칭",
  "안성맞춤랜드 방문",
  "하늘 사진 남기기",
  "안성 역사 퀴즈",
  "주변 소리 듣기",
  "평소와 다른 길",
  "안성팜랜드 방문",
  "초록 풍경 찾기",
  "안성 인물 퀴즈",
  "벤치에서 쉬기",
  "안전 횡단보도",
  "칠장사 방문하기",
  "FREE",
  "경기도 퀴즈",
  "쓰레기 하나 줍기",
  "동네 간판 관찰",
  "3·1운동기념관",
  "물 한 잔 마시기",
  "사찰 퀴즈",
  "산책 음악 듣기",
  "오늘 기분 기록",
  "바우덕이 풍물단",
  "농축산 퀴즈",
  "종아리 스트레칭",
  "내일의 길 정하기",
];
const demoMissions: Mission[] = [
  ...contributedDemoMissions,
  ...demoTitles.slice(4).map((title, index) => {
    const kind: MissionKind =
      title.includes("방문") ||
      title.includes("기념관") ||
      title.includes("풍물단")
        ? "PLACE_VISIT"
        : title.includes("퀴즈")
          ? "QUIZ"
          : "CHECK_IN";
    return {
      id: `demo-${index + contributedDemoMissions.length}`,
      title,
      description: "오늘의 산책 미션을 즐겁게 수행해보세요.",
      kind,
      points:
        kind === "PLACE_VISIT"
          ? 30
          : kind === "QUIZ"
            ? 20
            : title === "FREE"
              ? 0
              : 10,
      done: [0, 8].includes(index),
    };
  }),
];

function friendlyError(code?: string): string {
  const messages: Record<string, string> = {
    QUIZ_INCORRECT: "아쉽지만 정답이 아니에요. 다시 생각해볼까요?",
    LOCATION_TOO_OLD: "위치 정보가 오래됐어요. 현재 위치를 다시 확인해주세요.",
    LOCATION_TOO_INACCURATE: "GPS 정확도가 낮아요. 잠시 후 다시 시도해주세요.",
    OUTSIDE_ALLOWED_RADIUS:
      "아직 목적지와 거리가 있어요. 조금 더 가까이 이동해주세요.",
    INVALID_COORDINATES: "현재 위치를 확인할 수 없어요.",
  };
  return messages[code ?? ""] ?? "미션을 인증하지 못했어요. 다시 시도해주세요.";
}

function difficultyLabel(value?: number): Mission["difficulty"] {
  return value === 1
    ? "쉬움"
    : value === 2
      ? "보통"
      : value === 3
        ? "어려움"
        : value === 4
          ? "특별"
          : undefined;
}

function estimatedTimeLabel(
  minimum?: number | null,
  maximum?: number | null,
): string | undefined {
  if (!minimum && !maximum) return undefined;
  if (!minimum) return `${maximum}분`;
  if (!maximum || minimum === maximum) return `${minimum}분`;
  return `${minimum}~${maximum}분`;
}

function remainingTime(endsAt: string, now: number): string {
  const remaining = Math.max(0, new Date(endsAt).getTime() - now);
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  return `${days ? `${days}일 ` : ""}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function Home() {
  const [items, setItems] = useState<Mission[]>(demoMissions);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [points, setPoints] = useState(0);
  const [lineKeys, setLineKeys] = useState<string[]>([]);
  const [selected, setSelected] = useState<Mission | null>(null);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [bingoFlash, setBingoFlash] = useState<{
    id: number;
    count: number;
  } | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(
    null,
  );
  const [online, setOnline] = useState(true);
  const [nickname, setNickname] = useState("여행자");
  const [activeTab, setActiveTab] = useState<"bingo" | "ranking">("bingo");
  const [rankingPeriod, setRankingPeriod] =
    useState<RankingPeriod>("WEEKLY");
  const [rankingScope, setRankingScope] = useState<RankingScope>("ALL");
  const [ranking, setRanking] = useState<RankingResult>({
    entries: demoRanking,
    me: { userId: "me", nickname: "선", points: 420, rank: 18 },
    endsAt: null,
  });
  const [rankingLoading, setRankingLoading] = useState(false);
  const [clock, setClock] = useState(Date.now());

  const applySession = (session: DailySession) => {
    setSessionId(session.id);
    setPoints(session.totalPoints);
    setLineKeys(session.completedLineKeys);
    setItems(
      session.cells
        .sort((a, b) => a.position - b.position)
        .map((cell) => ({
          id: cell.id,
          title: cell.mission.title,
          description: cell.mission.description,
          kind: cell.mission.kind,
          points: cell.mission.points,
          done: cell.status === "VERIFIED",
          difficulty: difficultyLabel(cell.mission.difficulty),
          estimatedTime: estimatedTimeLabel(
            cell.mission.estimatedMinutesMin,
            cell.mission.estimatedMinutesMax,
          ),
          verificationLabel:
            cell.mission.kind === "PHOTO"
              ? Number(cell.mission.targetValue ?? 1) > 1
                ? `사진 ${cell.mission.targetValue}장`
                : "사진 1장"
              : cell.mission.kind === "COMPOSITE"
                ? "GPS 체류"
                : undefined,
        })),
    );
  };

  const loadDaily = async () => {
    try {
      let authResponse = await apiFetch("/auth/me");
      if (authResponse.status === 401) {
        authResponse = await apiFetch("/auth/guest", { method: "POST" });
      }
      if (!authResponse.ok) throw new Error("Authentication unavailable");
      const auth = (await authResponse.json()) as {
        user: { nickname: string };
      };
      setNickname(auth.user.nickname);

      let response = await apiFetch("/daily-sessions/today");
      if (response.status === 404) {
        response = await apiFetch("/daily-sessions", {
          method: "POST",
          headers: {
            "idempotency-key": `web-create-${crypto.randomUUID()}`,
          },
        });
      }
      if (!response.ok) throw new Error("Daily API unavailable");
      applySession((await response.json()) as DailySession);
      setDemoMode(false);
    } catch {
      setDemoMode(true);
      setItems(demoMissions);
      setPoints(
        demoMissions
          .filter((item) => item.done)
          .reduce((sum, item) => sum + item.points, 0),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDaily();
    setOnline(navigator.onLine);
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }
    const handleInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("beforeinstallprompt", handleInstall);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstall);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (activeTab !== "ranking") return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    setRankingLoading(true);
    void apiFetch(`/rankings?period=${rankingPeriod}&scope=${rankingScope}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Ranking API unavailable");
        setRanking((await response.json()) as RankingResult);
      })
      .catch(() => {
        setRanking({
          entries: demoRanking,
          me: { userId: "me", nickname, points: 420, rank: 18 },
          endsAt: null,
        });
      })
      .finally(() => setRankingLoading(false));
    return () => window.clearInterval(timer);
  }, [activeTab, rankingPeriod, rankingScope, nickname]);

  const installApp = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const celebrate = (count: number) => {
    if (count < 1) return;
    setBingoFlash({ id: Date.now(), count });
    window.setTimeout(() => setBingoFlash(null), 1800);
  };

  const getGps = () =>
    new Promise<GeolocationPosition>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 12_000,
        maximumAge: 0,
      }),
    );

  const complete = async () => {
    if (!selected || selected.done) return;
    setMessage(null);
    if (demoMode || !sessionId) {
      const nextItems = items.map((item) =>
        item.id === selected.id ? { ...item, done: true } : item,
      );
      const nextLineKeys = completedClientLineKeys(nextItems);
      celebrate(nextLineKeys.filter((key) => !lineKeys.includes(key)).length);
      setItems(nextItems);
      setLineKeys(nextLineKeys);
      setPoints((current) => current + selected.points);
      setSelected(null);
      return;
    }
    setSubmitting(true);
    try {
      const headers = {
        "idempotency-key": `web-verify-${crypto.randomUUID()}`,
        "content-type": "application/json",
      };
      let response: Response;
      if (selected.kind === "CHECK_IN") {
        response = await apiFetch(
          `/daily-sessions/${sessionId}/cells/${selected.id}/complete`,
          {
            method: "POST",
            headers,
          },
        );
      } else {
        const body =
          selected.kind === "QUIZ"
            ? { type: "QUIZ", answer }
            : await getGps().then(({ coords, timestamp }) => ({
                type: "GPS",
                latitude: coords.latitude,
                longitude: coords.longitude,
                accuracyM: coords.accuracy,
                measuredAt: new Date(timestamp).toISOString(),
              }));
        response = await apiFetch(
          `/daily-sessions/${sessionId}/cells/${selected.id}/verify`,
          {
            method: "POST",
            headers,
            body: JSON.stringify(body),
          },
        );
      }
      if (!response.ok) throw new Error("Verification request failed");
      const result = (await response.json()) as VerificationResult;
      if (result.verificationStatus === "REJECTED") {
        setMessage(friendlyError(result.reasonCode));
        return;
      }
      celebrate(
        result.completedLineKeys.filter((key) => !lineKeys.includes(key))
          .length,
      );
      setSelected(null);
      setAnswer("");
      await loadDaily();
    } catch (error) {
      setMessage(
        error instanceof GeolocationPositionError
          ? "위치 권한을 허용한 뒤 다시 시도해주세요."
          : "서버와 연결하지 못했어요. 잠시 후 다시 시도해주세요.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const completeCount = items.filter((item) => item.done).length;

  return (
    <main className="app-shell">
      <header>
        <div>
          <p className="eyebrow">오늘 · 안성</p>
          <h1>오늘의 산책 빙고</h1>
        </div>
        <button className="profile" aria-label="내 프로필">
          {nickname.slice(0, 1)}
        </button>
      </header>
      {!online && (
        <div className="offline-banner">
          오프라인 상태예요 · 저장된 빙고판을 보여드릴게요
        </div>
      )}
      {installPrompt && (
        <button className="install-banner" onClick={installApp}>
          <span>▣</span>
          <b>Travel Bingo를 홈 화면에 설치하기</b>
          <i>설치</i>
        </button>
      )}
      {demoMode && (
        <div className="mode-banner">
          체험 모드 · 로컬 API를 실행하면 실제 데이터로 전환돼요
        </div>
      )}
      <section className="hero">
        <div className="hero-copy">
          <span className="pill">DAILY WALK</span>
          <h2>
            천천히 걸으며
            <br />
            오늘을 발견해요
          </h2>
          <p>매일 같은 미션, 나만의 새로운 배치</p>
        </div>
        <div className="score">
          <strong>{points}</strong>
          <span>POINT</span>
        </div>
      </section>
      <section className="progress-card">
        <div className="progress-heading">
          <div>
            <b>{completeCount}</b>
            <span> / 25 완료</span>
          </div>
          <strong>{Math.round((completeCount / 25) * 100)}%</strong>
        </div>
        <div className="track">
          <i style={{ width: `${(completeCount / 25) * 100}%` }} />
        </div>
        <p>
          {lineKeys.length}줄 빙고 · <b>조금만 더!</b>
        </p>
      </section>
      {loading ? (
        <div className="board-loading">오늘의 빙고를 준비하고 있어요…</div>
      ) : (
        <section className="board" aria-label="오늘의 5x5 빙고판">
          {items.map((item) => (
            <button
              key={item.id}
              className={`${item.done ? "done" : ""} ${item.title === "FREE" ? "free" : ""}`}
              onClick={() => {
                setSelected(item);
                setMessage(null);
                setAnswer("");
              }}
            >
              <span className={`mission-icon ${item.kind.toLowerCase()}`}>
                {item.done ? "✓" : icon[item.kind]}
              </span>
              <b>{item.title}</b>
              <small>{item.points ? `+${item.points}P` : "BONUS"}</small>
            </button>
          ))}
        </section>
      )}
      <aside className="tip">
        <span>✦</span>
        <p>
          <b>오늘의 산책 팁</b>
          <br />
          해가 지기 전 20분 산책은 기분 전환에 좋아요.
        </p>
      </aside>
      {activeTab === "ranking" && (
        <section className="ranking-screen">
          <header className="ranking-header"><h1>랭킹</h1></header>
          <div className="ranking-tabs" aria-label="랭킹 기간">
            {([["DAILY","일간"],["WEEKLY","주간"],["MONTHLY","월간"],["TOTAL","누적"]] as const).map(([value,label]) => (
              <button key={value} className={rankingPeriod === value ? "active" : ""} onClick={() => setRankingPeriod(value)}>{label}</button>
            ))}
          </div>
          <div className="ranking-tabs scope-tabs" aria-label="랭킹 범위">
            {([["ALL","전체"],["COMMON","공통"],["REGION","지역"]] as const).map(([value,label]) => (
              <button key={value} className={rankingScope === value ? "active" : ""} onClick={() => setRankingScope(value)}>{label}</button>
            ))}
            <button disabled title="친구 기능 준비 중">친구</button>
          </div>
          <p className="ranking-timer">{ranking.endsAt ? `이번 랭킹 종료까지 ${remainingTime(ranking.endsAt, clock)}` : "랭킹 집계 데이터를 준비하고 있어요"}</p>
          {ranking.me && (
            <div className="my-rank-card">
              <strong>{ranking.me.rank}</strong>
              <span className="rank-avatar">{ranking.me.nickname.slice(0,1)}</span>
              <b>{ranking.me.nickname}</b>
              <span>{ranking.me.points.toLocaleString()} P</span>
            </div>
          )}
          <div className={`ranking-list ${rankingLoading ? "loading" : ""}`}>
            {ranking.entries.map((entry) => (
              <div className={`ranking-row ${entry.userId === ranking.me?.userId ? "is-me" : ""}`} key={entry.userId}>
                <strong className={`rank rank-${entry.rank}`}>{entry.rank <= 3 ? ["","🥇","🥈","🥉"][entry.rank] : entry.rank}</strong>
                <span className="rank-avatar">{entry.nickname.slice(0,1)}</span>
                <b>{entry.nickname}{entry.userId === ranking.me?.userId && <small> (나)</small>}</b><span>{entry.points.toLocaleString()} P</span>
              </div>
            ))}
            {!rankingLoading && ranking.entries.length === 0 && <p className="ranking-empty">아직 랭킹에 등록된 참여자가 없어요.</p>}
          </div>
        </section>
      )}
      <nav>
        <button>
          <span>⌂</span>홈
        </button>
        <button>
          <span>♧</span>탐험
        </button>
        <button
          className={activeTab === "bingo" ? "active" : ""}
          onClick={() => setActiveTab("bingo")}
        >
          <span>▦</span>빙고
        </button>
        <button
          className={activeTab === "ranking" ? "active" : ""}
          onClick={() => setActiveTab("ranking")}
        >
          <span>☆</span>랭킹
        </button>
        <button>
          <span>○</span>마이
        </button>
      </nav>
      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <section
            className="mission-sheet"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="close" onClick={() => setSelected(null)}>
              ×
            </button>
            <span className={`large-icon ${selected.kind.toLowerCase()}`}>
              {selected.done ? "✓" : icon[selected.kind]}
            </span>
            <p className="eyebrow">{selected.kind.replace("_", " ")}</p>
            <h2>{selected.title}</h2>
            <p className="description">{selected.description}</p>
            {(selected.difficulty ||
              selected.estimatedTime ||
              selected.verificationLabel) && (
              <div className="mission-meta" aria-label="미션 정보">
                {selected.difficulty && <span>{selected.difficulty}</span>}
                {selected.estimatedTime && (
                  <span>약 {selected.estimatedTime}</span>
                )}
                {selected.verificationLabel && (
                  <span>{selected.verificationLabel}</span>
                )}
              </div>
            )}
            {selected.kind === "QUIZ" && !selected.done && (
              <input
                className="answer-input"
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder="정답을 입력해주세요"
              />
            )}
            {message && <p className="error-message">{message}</p>}
            <div className="reward">
              <span>획득 보상</span>
              <b>+ {selected.points} Point</b>
            </div>
            <button
              className="primary"
              onClick={complete}
              disabled={
                selected.done ||
                submitting ||
                (selected.kind === "QUIZ" && !answer.trim())
              }
            >
              {selected.done
                ? "완료한 미션이에요"
                : submitting
                  ? "인증하고 있어요…"
                  : selected.kind === "PLACE_VISIT"
                    ? "현재 위치 인증하기"
                    : selected.kind === "PHOTO"
                      ? "사진 인증 준비하기"
                      : selected.kind === "COMPOSITE"
                        ? "GPS 체류 시작하기"
                        : selected.kind === "QUIZ"
                          ? "정답 제출하기"
                          : "미션 완료하기"}
            </button>
          </section>
        </div>
      )}
      {bingoFlash && (
        <div
          key={bingoFlash.id}
          className="bingo-celebration"
          role="status"
          aria-live="assertive"
        >
          <div className="bingo-burst" aria-hidden="true">
            {Array.from({ length: 18 }, (_, index) => (
              <i
                key={index}
                style={{ "--piece": index } as React.CSSProperties}
              />
            ))}
          </div>
          <div className="bingo-pop">
            <span>한 줄 완성!</span>
            <strong>BINGO!</strong>
            {bingoFlash.count > 1 && <b>+{bingoFlash.count} LINES</b>}
            <small>+100 Point</small>
          </div>
        </div>
      )}
    </main>
  );
}
