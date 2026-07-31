"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";

import { AuthScreen } from "./auth-screen";

type MissionKind =
  | "CHECK_IN"
  | "QUIZ"
  | "PLACE_VISIT"
  | "PHOTO"
  | "COMPOSITE"
  | "WALK_DISTANCE"
  | "WALK_STEPS";
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
  targetValue?: number | null;
  targetUnit?: string | null;
  interactionType?: "TEXT" | "TIMER";
  timerSeconds?: number | null;
  textMaxLength?: number | null;
  radiusM?: number | null;
  place?: {
    title: string;
    latitude: string;
    longitude: string;
  } | null;
};
type DailySession = {
  id: string;
  templateId?: string;
  type?: "DAILY" | "REGION" | "EVENT";
  title?: string;
  regionName?: string;
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
      targetUnit?: string | null;
      interactionType?: "TEXT" | "TIMER";
      timerSeconds?: number | null;
      textMaxLength?: number | null;
      radiusM?: number | null;
      place?: {
        title: string;
        latitude: string;
        longitude: string;
      } | null;
    };
  }>;
};
type SessionCell = DailySession["cells"][number];
type VerificationResult = {
  verificationStatus?: "APPROVED" | "REJECTED";
  reasonCode?: string;
  completedLineKeys: string[];
};

function toMission(cell: SessionCell): Mission {
  return {
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
    verificationLabel: verificationLabel(
      cell.mission.kind,
      cell.mission.targetValue,
      cell.mission.targetUnit,
      cell.mission.interactionType,
    ),
    targetValue: Number(cell.mission.targetValue) || null,
    targetUnit: cell.mission.targetUnit,
    interactionType: cell.mission.interactionType,
    timerSeconds: cell.mission.timerSeconds ?? null,
    textMaxLength: cell.mission.textMaxLength ?? null,
    radiusM: cell.mission.radiusM ?? null,
    place: cell.mission.place ?? null,
  };
}
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
type AccountUser = {
  id: string;
  nickname: string;
  email: string | null;
  role: "USER" | "ADMIN";
};
type RegionRecommendation = {
  id: string;
  name: string;
  distanceKm: number | null;
  attraction: {
    title: string;
    address: string | null;
    imageUrl: string | null;
    latitude: number;
    longitude: number;
    source: "KTO" | "DATABASE";
  } | null;
};
type BingoCatalogItem = {
  id: string;
  templateId: string;
  sessionId: string | null;
  type: "DAILY" | "REGION" | "EVENT";
  title: string;
  regionName: string | null;
  state: "IN_PROGRESS" | "COMPLETED" | "AVAILABLE";
  completedCellCount: number;
  totalCellCount: number;
  totalPoints: number;
  startsAt: string | null;
  endsAt: string | null;
};

const API_BASE = "/api/backend";
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
  WALK_DISTANCE: "↝",
  WALK_STEPS: "♟",
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
    PHOTO_AI_REJECTED:
      "미션 조건을 확인하기 어려워요. 대상을 더 선명하게 다시 촬영해주세요.",
    PHOTO_NEEDS_REVIEW: "AI가 확신하기 어려워 관리자 검수가 필요해요.",
    UNSAFE_IMAGE:
      "이 사진은 인증에 사용할 수 없어요. 다른 사진을 선택해주세요.",
    AI_NOT_CONFIGURED: "사진 AI 인증이 아직 설정되지 않았어요.",
    GPS_DISTANCE_NOT_REACHED: "목표 거리까지 조금 더 걸어주세요.",
    GPS_DURATION_NOT_REACHED: "목표 시간까지 산책을 이어가 주세요.",
    GPS_STAY_MOVED_TOO_FAR:
      "체류 범위를 벗어났어요. 한 장소에서 다시 시작해주세요.",
    TEXT_REQUIRED: "오늘의 기록을 한 문장으로 남겨주세요.",
    TEXT_TOO_LONG: "기록은 100자 이내로 작성해주세요.",
    TIMER_NOT_REACHED: "목표 시간이 끝난 뒤 인증할 수 있어요.",
  };
  return messages[code ?? ""] ?? "미션을 인증하지 못했어요. 다시 시도해주세요.";
}

function verificationLabel(
  kind: MissionKind,
  targetValue?: string | null,
  targetUnit?: string | null,
  interactionType?: "TEXT" | "TIMER",
): string | undefined {
  const target = Number(targetValue);
  if (interactionType === "TEXT") return "텍스트 기록";
  if (interactionType === "TIMER") {
    return `타이머 ${Math.max(1, Math.round(target / 60))}분`;
  }
  if (kind === "PHOTO") {
    return target > 1 ? `사진 ${target}장` : "사진 1장";
  }
  if (kind === "WALK_DISTANCE" && targetUnit === "KILOMETER") {
    return `GPS 거리 ${target}km`;
  }
  if (kind === "COMPOSITE" && targetUnit === "SECOND") {
    return `GPS ${Math.round(target / 60)}분 기록`;
  }
  if (kind === "PLACE_VISIT") return "현재 위치 GPS";
  return undefined;
}

function distanceBetween(
  first: { latitude: number; longitude: number },
  second: { latitude: number; longitude: number },
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(second.latitude - first.latitude);
  const longitudeDelta = radians(second.longitude - first.longitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(first.latitude)) *
      Math.cos(radians(second.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function trackingTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
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

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Image could not be read."));
    reader.onerror = () =>
      reject(reader.error ?? new Error("Image could not be read."));
    reader.readAsDataURL(file);
  });
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
  const [authStatus, setAuthStatus] = useState<
    "checking" | "authenticated" | "unauthenticated"
  >("checking");
  const [account, setAccount] = useState<AccountUser | null>(null);
  const [items, setItems] = useState<Mission[]>(demoMissions);
  const completeCount = items.filter((item) => item.done).length;
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentBingo, setCurrentBingo] = useState<{
    type: "DAILY" | "REGION" | "EVENT";
    title: string;
    regionName: string | null;
  }>({
    type: "DAILY",
    title: "오늘의 산책 빙고",
    regionName: null,
  });
  const [points, setPoints] = useState(0);
  const [lineKeys, setLineKeys] = useState<string[]>([]);
  const [selected, setSelected] = useState<Mission | null>(null);
  const [answer, setAnswer] = useState("");
  const [textRecord, setTextRecord] = useState("");
  const [timerStartedAt, setTimerStartedAt] = useState<string | null>(null);
  const [timerNow, setTimerNow] = useState(Date.now());
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
  const [activeTab, setActiveTab] = useState<
    "home" | "exploration" | "catalog" | "bingo" | "ranking" | "my"
  >("home");
  const [explorationMapSvg, setExplorationMapSvg] = useState("");
  const [explorationMapLoading, setExplorationMapLoading] = useState(false);
  const [explorationMapAttempt, setExplorationMapAttempt] = useState(0);
  const [selectedMapRegion, setSelectedMapRegion] = useState({
    code: "31220",
    name: "안성시",
    province: "경기도",
  });
  const [mapTransform, setMapTransform] = useState({
    scale: 0.92,
    x: 18,
    y: 0,
  });
  const mapPointer = useRef<{
    id: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const [bingoCatalog, setBingoCatalog] = useState<BingoCatalogItem[]>([]);
  const [bingoCatalogLoading, setBingoCatalogLoading] = useState(false);
  const [rankingPeriod, setRankingPeriod] = useState<RankingPeriod>("WEEKLY");
  const [rankingScope, setRankingScope] = useState<RankingScope>("ALL");
  const [ranking, setRanking] = useState<RankingResult>({
    entries: demoRanking,
    me: { userId: "me", nickname: "선", points: 420, rank: 18 },
    endsAt: null,
  });
  const [rankingLoading, setRankingLoading] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const [regionRecommendations, setRegionRecommendations] = useState<
    RegionRecommendation[]
  >([]);
  const [regionRecommendationsLoading, setRegionRecommendationsLoading] =
    useState(false);
  const [photoStage, setPhotoStage] = useState<
    "DETAIL" | "REVIEWING" | "COMPLETE"
  >("DETAIL");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [gpsCheck, setGpsCheck] = useState<{
    status: "idle" | "checking" | "ready" | "error";
    accuracyM: number | null;
    message: string;
  }>({
    status: "idle",
    accuracyM: null,
    message: "현장에서 GPS 수신 상태를 미리 확인할 수 있어요.",
  });
  const [tracking, setTracking] = useState<{
    active: boolean;
    elapsedSeconds: number;
    distanceM: number;
    latest: {
      latitude: number;
      longitude: number;
      accuracyM: number;
      measuredAt: string;
    } | null;
  }>({
    active: false,
    elapsedSeconds: 0,
    distanceM: 0,
    latest: null,
  });
  const [trackingMissionId, setTrackingMissionId] = useState<string | null>(
    null,
  );
  const [trackingSessionId, setTrackingSessionId] = useState<string | null>(
    null,
  );
  const [trackingHydrated, setTrackingHydrated] = useState(false);
  const cameraInput = useRef<HTMLInputElement>(null);
  const albumInput = useRef<HTMLInputElement>(null);
  const trackingWatchId = useRef<number | null>(null);
  const trackingStartedAt = useRef<number | null>(null);
  const lastTrackingPosition = useRef<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const applySession = (session: DailySession) => {
    setSessionId(session.id);
    if (session.type && session.title) {
      setCurrentBingo({
        type: session.type,
        title: session.title,
        regionName: session.regionName ?? null,
      });
    }
    setPoints(session.totalPoints);
    setLineKeys(session.completedLineKeys);
    setItems(
      session.cells
        .sort((a, b) => a.position - b.position)
        .map(toMission),
    );
  };

  const loadDaily = async (preserveAuthenticated = false) => {
    try {
      const authResponse = await apiFetch("/auth/me");
      if (authResponse.status === 401) {
        if (preserveAuthenticated) {
          setAuthStatus("authenticated");
          setDemoMode(true);
        } else {
          setAuthStatus("unauthenticated");
        }
        setLoading(false);
        return;
      }
      if (!authResponse.ok) throw new Error("Authentication unavailable");
      const auth = (await authResponse.json()) as {
        user: AccountUser;
      };
      setNickname(auth.user.nickname);
      setAccount(auth.user);
      setAuthStatus("authenticated");

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
      setCurrentBingo({
        type: "DAILY",
        title: "오늘의 산책 빙고",
        regionName: null,
      });
      applySession((await response.json()) as DailySession);
      setDemoMode(false);
    } catch {
      setAuthStatus((current) =>
        current === "checking" ? "unauthenticated" : "authenticated",
      );
      setDemoMode(true);
      const basePoints = demoMissions
        .filter((item) => item.done)
        .reduce((sum, item) => sum + item.points, 0);
      try {
        const progressResponse = await fetch("/api/photo-progress");
        if (!progressResponse.ok) throw new Error("Photo progress unavailable");
        const progress = (await progressResponse.json()) as {
          missionIds: string[];
          totalPoints: number;
        };
        const completedPhotoIds = new Set(progress.missionIds);
        setItems(
          demoMissions.map((item) =>
            completedPhotoIds.has(item.id) ? { ...item, done: true } : item,
          ),
        );
        setPoints(basePoints + progress.totalPoints);
      } catch {
        setItems(demoMissions);
        setPoints(basePoints);
      }
    } finally {
      setLoading(false);
    }
  };

  const enterHomeAfterLogin = async (
    user: Omit<AccountUser, "role"> & { role?: AccountUser["role"] },
  ) => {
    setActiveTab("home");
    setSelected(null);
    setMessage(null);
    setAccount({
      ...user,
      role: user.role ?? "USER",
    });
    setNickname(user.nickname);
    setLoading(true);
    setAuthStatus("authenticated");
    await loadDaily(true);
  };

  const openCatalogBingo = async (bingo: BingoCatalogItem) => {
    setBingoCatalogLoading(true);
    setMessage(null);
    try {
      const response = bingo.sessionId
        ? await apiFetch(`/bingos/sessions/${bingo.sessionId}`)
        : await apiFetch(`/bingos/${bingo.templateId}/sessions`, {
            method: "POST",
            headers: {
              "idempotency-key": `web-bingo-${crypto.randomUUID()}`,
            },
          });
      if (!response.ok) throw new Error("Bingo session unavailable");
      applySession((await response.json()) as DailySession);
      setSelected(null);
      setActiveTab("bingo");
    } catch {
      setMessage("빙고판을 열지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setBingoCatalogLoading(false);
    }
  };

  const reloadCurrentBingo = async () => {
    if (currentBingo.type === "DAILY" || !sessionId) {
      await loadDaily();
      return;
    }
    const response = await apiFetch(`/bingos/sessions/${sessionId}`);
    if (!response.ok) throw new Error("Bingo session unavailable");
    applySession((await response.json()) as DailySession);
  };

  useEffect(() => {
    void loadDaily(false);
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

  useEffect(() => {
    if (activeTab !== "catalog") return;
    setBingoCatalogLoading(true);
    void apiFetch("/bingos")
      .then(async (response) => {
        if (!response.ok) throw new Error("Bingo catalog unavailable");
        const payload = (await response.json()) as {
          items: BingoCatalogItem[];
        };
        setBingoCatalog(payload.items);
      })
      .catch(() => {
        setBingoCatalog([
          {
            id: "demo-daily",
            templateId: "demo-daily",
            sessionId,
            type: "DAILY",
            title: "오늘의 산책 빙고",
            regionName: null,
            state: "IN_PROGRESS",
            completedCellCount: completeCount,
            totalCellCount: 25,
            totalPoints: points,
            startsAt: null,
            endsAt: null,
          },
        ]);
      })
      .finally(() => setBingoCatalogLoading(false));
  }, [activeTab, completeCount, points, sessionId]);

  useEffect(() => {
    if (activeTab !== "exploration" || explorationMapSvg) return;
    setExplorationMapLoading(true);
    void fetch("/maps/korea-sigungu.svg")
      .then(async (response) => {
        if (!response.ok) throw new Error("Map unavailable");
        setExplorationMapSvg(await response.text());
      })
      .catch(() => {
        setMessage("전국 지도를 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
      })
      .finally(() => setExplorationMapLoading(false));
  }, [activeTab, explorationMapSvg, explorationMapAttempt]);

  useEffect(() => {
    if (activeTab !== "exploration" || !explorationMapSvg) return;
    const paths = document.querySelectorAll<SVGPathElement>(
      ".exploration-map path[data-code]",
    );
    paths.forEach((path) => {
      path.classList.toggle(
        "is-selected",
        path.dataset.code === selectedMapRegion.code,
      );
      path.setAttribute("tabindex", "0");
      path.setAttribute("role", "button");
      path.setAttribute(
        "aria-label",
        `${path.dataset.province ?? ""} ${path.dataset.name ?? "지역"}`,
      );
    });
  }, [activeTab, explorationMapSvg, selectedMapRegion.code]);

  const updateMapScale = (
    nextScale: number,
    focusX = 180,
    focusY = 280,
  ) => {
    setMapTransform((current) => {
      const scale = Math.min(3.5, Math.max(0.72, nextScale));
      const ratio = scale / current.scale;
      return {
        scale,
        x: focusX - (focusX - current.x) * ratio,
        y: focusY - (focusY - current.y) * ratio,
      };
    });
  };

  const handleMapWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    updateMapScale(
      mapTransform.scale * (event.deltaY > 0 ? 0.9 : 1.1),
      event.clientX - bounds.left,
      event.clientY - bounds.top,
    );
  };

  const handleMapPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    mapPointer.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: mapTransform.x,
      originY: mapTransform.y,
      moved: false,
    };
  };

  const handleMapPointerMove = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const pointer = mapPointer.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    const deltaX = event.clientX - pointer.startX;
    const deltaY = event.clientY - pointer.startY;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 6) pointer.moved = true;
    setMapTransform((current) => ({
      ...current,
      x: pointer.originX + deltaX,
      y: pointer.originY + deltaY,
    }));
  };

  const handleMapPointerUp = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const pointer = mapPointer.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    if (!pointer.moved) {
      const path = (event.target as Element).closest<SVGPathElement>(
        "path[data-code]",
      );
      if (path?.dataset.code && path.dataset.name) {
        setSelectedMapRegion({
          code: path.dataset.code,
          name: path.dataset.name,
          province: path.dataset.province ?? "",
        });
      }
    }
    mapPointer.current = null;
  };

  const loadRegionRecommendations = async (coordinates?: {
    latitude: number;
    longitude: number;
  }) => {
    setRegionRecommendationsLoading(true);
    try {
      const query = new URLSearchParams({ limit: "3" });
      if (coordinates) {
        query.set("latitude", String(coordinates.latitude));
        query.set("longitude", String(coordinates.longitude));
      }
      const response = await apiFetch(`/recommendations/regions?${query}`);
      if (!response.ok) throw new Error("Region recommendations unavailable");
      setRegionRecommendations(
        (await response.json()) as RegionRecommendation[],
      );
    } catch {
      setRegionRecommendations([]);
    } finally {
      setRegionRecommendationsLoading(false);
    }
  };

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    void loadRegionRecommendations();
  }, [authStatus]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("travel-bingo-active-gps");
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        missionId?: string;
        sessionId?: string | null;
        startedAt?: number;
        distanceM?: number;
        latest?: typeof tracking.latest;
        lastPosition?: { latitude: number; longitude: number } | null;
        active?: boolean;
      };
      if (!saved.missionId || !saved.startedAt) return;
      trackingStartedAt.current = saved.startedAt;
      lastTrackingPosition.current = saved.lastPosition ?? null;
      setTrackingMissionId(saved.missionId);
      setTrackingSessionId(saved.sessionId ?? null);
      setTracking({
        active: saved.active !== false,
        elapsedSeconds: Math.max(
          0,
          Math.floor((Date.now() - saved.startedAt) / 1_000),
        ),
        distanceM: Math.max(0, Number(saved.distanceM) || 0),
        latest: saved.latest ?? null,
      });
      if (saved.active !== false) beginTrackingWatch();
    } catch {
      window.localStorage.removeItem("travel-bingo-active-gps");
    } finally {
      setTrackingHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!trackingHydrated) return;
    if (!trackingMissionId || !trackingStartedAt.current) {
      window.localStorage.removeItem("travel-bingo-active-gps");
      return;
    }
    window.localStorage.setItem(
      "travel-bingo-active-gps",
      JSON.stringify({
        missionId: trackingMissionId,
        sessionId: trackingSessionId,
        startedAt: trackingStartedAt.current,
        distanceM: tracking.distanceM,
        latest: tracking.latest,
        lastPosition: lastTrackingPosition.current,
        active: tracking.active,
      }),
    );
  }, [
    tracking,
    trackingHydrated,
    trackingMissionId,
    trackingSessionId,
  ]);

  useEffect(() => {
    const resumeWatch = () => {
      if (
        document.visibilityState === "visible" &&
        tracking.active &&
        trackingWatchId.current === null
      ) {
        beginTrackingWatch();
      }
    };
    document.addEventListener("visibilitychange", resumeWatch);
    return () => document.removeEventListener("visibilitychange", resumeWatch);
  }, [tracking.active]);

  useEffect(() => {
    if (!tracking.active) return;
    const timer = window.setInterval(() => {
      const startedAt = trackingStartedAt.current;
      if (!startedAt) return;
      setTracking((current) => ({
        ...current,
        elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000),
      }));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [tracking.active]);

  useEffect(() => {
    if (!selected || selected.interactionType !== "TIMER") {
      setTimerStartedAt(null);
      return;
    }
    const storageKey = `travel-bingo-timer:${sessionId ?? "demo"}:${selected.id}`;
    setTimerStartedAt(window.localStorage.getItem(storageKey));
    setTimerNow(Date.now());
  }, [selected, sessionId]);

  useEffect(() => {
    if (!timerStartedAt) return;
    const timer = window.setInterval(() => setTimerNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [timerStartedAt]);

  useEffect(
    () => () => {
      if (trackingWatchId.current !== null) {
        navigator.geolocation.clearWatch(trackingWatchId.current);
      }
    },
    [],
  );

  const installApp = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const logout = () => {
    setMessage(null);
    resetTracking();
    setAccount(null);
    setSessionId(null);
    setSelected(null);
    setActiveTab("home");
    setAuthStatus("unauthenticated");

    void apiFetch("/auth/logout", { method: "POST" }).catch(() => {
      // The local session is already cleared. A failed server request will be
      // reconciled by /auth/me on the next page load.
    });
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

  const checkGpsStatus = async () => {
    if (!navigator.geolocation) {
      setGpsCheck({
        status: "error",
        accuracyM: null,
        message: "이 기기에서는 위치 기능을 사용할 수 없어요.",
      });
      return;
    }
    setGpsCheck({
      status: "checking",
      accuracyM: null,
      message: "현재 위치와 GPS 정확도를 확인하고 있어요…",
    });
    try {
      const position = await getGps();
      const accuracyM = Math.round(position.coords.accuracy);
      setGpsCheck({
        status: "ready",
        accuracyM,
        message:
          accuracyM <= 50
            ? "GPS 상태가 좋아요. 지금 위치에서 인증을 시도할 수 있어요."
            : "GPS 오차가 커요. 야외의 탁 트인 곳에서 다시 확인해주세요.",
      });
    } catch {
      setGpsCheck({
        status: "error",
        accuracyM: null,
        message: "휴대전화 설정에서 위치 권한을 허용한 뒤 다시 확인해주세요.",
      });
    }
  };

  const recommendNearbyRegions = async () => {
    if (!navigator.geolocation) {
      setMessage("이 기기에서는 현재 위치를 사용할 수 없어요.");
      return;
    }
    setRegionRecommendationsLoading(true);
    try {
      const position = await getGps();
      await loadRegionRecommendations({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      setMessage("현재 위치와 가까운 활성 지역 순으로 추천했어요.");
    } catch {
      setRegionRecommendationsLoading(false);
      setMessage("위치 권한을 허용하면 가까운 지역을 추천할 수 있어요.");
    }
  };

  const stopTracking = () => {
    if (trackingWatchId.current !== null) {
      navigator.geolocation.clearWatch(trackingWatchId.current);
      trackingWatchId.current = null;
    }
    setTracking((current) => ({ ...current, active: false }));
  };

  const resetTracking = () => {
    stopTracking();
    trackingStartedAt.current = null;
    lastTrackingPosition.current = null;
    setTracking({
      active: false,
      elapsedSeconds: 0,
      distanceM: 0,
      latest: null,
    });
    setTrackingMissionId(null);
    setTrackingSessionId(null);
    window.localStorage.removeItem("travel-bingo-active-gps");
  };

  const closeMission = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    setPhotoStage("DETAIL");
    setTextRecord("");
    setSelected(null);
  };

  const startMissionTimer = () => {
    if (!selected || selected.interactionType !== "TIMER") return;
    const startedAt = new Date().toISOString();
    window.localStorage.setItem(
      `travel-bingo-timer:${sessionId ?? "demo"}:${selected.id}`,
      startedAt,
    );
    setTimerStartedAt(startedAt);
    setTimerNow(Date.now());
    setMessage(null);
  };

  const submitRecordMission = async () => {
    if (!selected || selected.done || !selected.interactionType) return;
    const trimmedText = textRecord.trim();
    const timerTarget = selected.timerSeconds ?? selected.targetValue ?? 0;
    const timerElapsed = timerStartedAt
      ? Math.floor((timerNow - new Date(timerStartedAt).getTime()) / 1_000)
      : 0;
    if (selected.interactionType === "TEXT" && !trimmedText) {
      setMessage("오늘의 기록을 한 문장으로 남겨주세요.");
      return;
    }
    if (
      selected.interactionType === "TIMER" &&
      (!timerStartedAt || timerElapsed < timerTarget)
    ) {
      setMessage("목표 시간이 끝난 뒤 인증할 수 있어요.");
      return;
    }
    if (demoMode || !sessionId) {
      const nextItems = items.map((item) =>
        item.id === selected.id ? { ...item, done: true } : item,
      );
      const nextLineKeys = completedClientLineKeys(nextItems);
      celebrate(nextLineKeys.filter((key) => !lineKeys.includes(key)).length);
      setItems(nextItems);
      setLineKeys(nextLineKeys);
      setPoints((current) => current + selected.points);
      if (selected.interactionType === "TIMER") {
        window.localStorage.removeItem(
          `travel-bingo-timer:${sessionId ?? "demo"}:${selected.id}`,
        );
      }
      setSelected(null);
      setTextRecord("");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const body =
        selected.interactionType === "TEXT"
          ? { type: "TEXT", text: trimmedText }
          : {
              type: "TIMER",
              startedAt: timerStartedAt,
              completedAt: new Date().toISOString(),
            };
      const response = await apiFetch(
        `/daily-sessions/${sessionId}/cells/${selected.id}/verify`,
        {
          method: "POST",
          headers: {
            "idempotency-key": `web-${selected.interactionType.toLowerCase()}-${crypto.randomUUID()}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );
      const result = (await response.json()) as VerificationResult;
      if (!response.ok || result.verificationStatus === "REJECTED") {
        setMessage(friendlyError(result.reasonCode));
        return;
      }
      celebrate(
        result.completedLineKeys.filter((key) => !lineKeys.includes(key))
          .length,
      );
      if (selected.interactionType === "TIMER") {
        window.localStorage.removeItem(
          `travel-bingo-timer:${sessionId}:${selected.id}`,
        );
      }
      setSelected(null);
      setTextRecord("");
      await reloadCurrentBingo();
    } catch {
      setMessage("기록을 저장하지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  const beginTrackingWatch = () => {
    if (!navigator.geolocation || trackingWatchId.current !== null) return;
    trackingWatchId.current = navigator.geolocation.watchPosition(
      ({ coords, timestamp }) => {
        const currentPosition = {
          latitude: coords.latitude,
          longitude: coords.longitude,
        };
        setTracking((current) => {
          let nextDistance = current.distanceM;
          if (coords.accuracy <= 50 && lastTrackingPosition.current) {
            const segment = distanceBetween(
              lastTrackingPosition.current,
              currentPosition,
            );
            if (segment >= 2 && segment <= 200) nextDistance += segment;
          }
          if (coords.accuracy <= 50) {
            lastTrackingPosition.current = currentPosition;
          }
          return {
            ...current,
            distanceM: nextDistance,
            latest: {
              ...currentPosition,
              accuracyM: coords.accuracy,
              measuredAt: new Date(timestamp).toISOString(),
            },
          };
        });
      },
      () => {
        stopTracking();
        setMessage("위치 권한을 허용한 뒤 다시 시작해주세요.");
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  };

  const startTracking = () => {
    if (!selected || !navigator.geolocation) {
      setMessage("이 기기에서는 GPS 기록을 사용할 수 없어요.");
      return;
    }
    if (
      tracking.active &&
      trackingMissionId &&
      trackingMissionId !== selected.id
    ) {
      setMessage(
        "다른 미션의 GPS 기록이 진행 중이에요. 진행 중인 미션을 먼저 완료해주세요.",
      );
      return;
    }
    setMessage(null);
    trackingStartedAt.current = Date.now();
    lastTrackingPosition.current = null;
    setTrackingMissionId(selected.id);
    setTrackingSessionId(sessionId);
    setTracking({
      active: true,
      elapsedSeconds: 0,
      distanceM: 0,
      latest: null,
    });
    beginTrackingWatch();
  };

  const submitTracking = async () => {
    if (!selected || !tracking.latest) {
      setMessage("GPS 위치가 확인될 때까지 잠시 기다려주세요.");
      return;
    }
    const target = selected.targetValue ?? 0;
    const reached =
      selected.kind === "WALK_DISTANCE"
        ? tracking.distanceM >= target * 1_000
        : tracking.elapsedSeconds >= target;
    if (!reached) {
      setMessage(
        selected.kind === "WALK_DISTANCE"
          ? "목표 거리까지 조금 더 걸어주세요."
          : "목표 시간까지 기록을 이어가 주세요.",
      );
      return;
    }
    if (demoMode || !sessionId) {
      stopTracking();
      const nextItems = items.map((item) =>
        item.id === selected.id ? { ...item, done: true } : item,
      );
      const nextLineKeys = completedClientLineKeys(nextItems);
      celebrate(nextLineKeys.filter((key) => !lineKeys.includes(key)).length);
      setItems(nextItems);
      setLineKeys(nextLineKeys);
      setPoints((current) => current + selected.points);
      setSelected(null);
      resetTracking();
      return;
    }
    setSubmitting(true);
    try {
      const response = await apiFetch(
        `/daily-sessions/${sessionId}/cells/${selected.id}/verify`,
        {
          method: "POST",
          headers: {
            "idempotency-key": `web-activity-${crypto.randomUUID()}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            type: "ACTIVITY",
            distanceM: tracking.distanceM,
            durationSeconds: tracking.elapsedSeconds,
            ...tracking.latest,
          }),
        },
      );
      const result = (await response.json()) as VerificationResult;
      if (!response.ok || result.verificationStatus === "REJECTED") {
        setMessage(friendlyError(result.reasonCode));
        return;
      }
      stopTracking();
      celebrate(
        result.completedLineKeys.filter((key) => !lineKeys.includes(key))
          .length,
      );
      setSelected(null);
      resetTracking();
      await reloadCurrentBingo();
    } catch {
      setMessage("GPS 기록을 서버에 전송하지 못했어요. 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  const verifyPhoto = async (file?: File) => {
    if (!selected || !file) return;
    setMessage(null);
    const preview = URL.createObjectURL(file);
    setPhotoPreview(preview);
    setPhotoStage("REVIEWING");
    if (demoMode || !sessionId) {
      try {
        const imageDataUrl = await readAsDataUrl(file);
        const response = await fetch("/api/photo-verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            imageDataUrl,
            missionId: selected.id,
            title: selected.title,
            description: selected.description,
            verificationLabel: selected.verificationLabel,
          }),
        });
        const verdict = (await response.json()) as {
          decision?: "APPROVED" | "REJECTED" | "NEEDS_REVIEW";
          retryGuide?: string;
          code?: string;
          message?: string;
          awardGranted?: boolean;
          awardedPoints?: number;
          alreadyCompleted?: boolean;
        };
        if (!response.ok || verdict.decision !== "APPROVED") {
          setPhotoStage("DETAIL");
          setMessage(
            verdict.retryGuide ||
              verdict.message ||
              friendlyError(
                verdict.decision === "NEEDS_REVIEW"
                  ? "PHOTO_NEEDS_REVIEW"
                  : (verdict.code ?? "PHOTO_AI_REJECTED"),
              ),
          );
          return;
        }
        approvePhotoMission(undefined, verdict.awardGranted !== false);
      } catch {
        setPhotoStage("DETAIL");
        setMessage(
          "사진 인증 서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요.",
        );
      }
      return;
    }
    try {
      const imageDataUrl = await readAsDataUrl(file);
      const response = await apiFetch(
        `/daily-sessions/${sessionId}/cells/${selected.id}/verify`,
        {
          method: "POST",
          headers: {
            "idempotency-key": `web-photo-${crypto.randomUUID()}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ type: "PHOTO", imageDataUrl }),
        },
      );
      const result = (await response.json()) as VerificationResult & {
        totalPoints?: number;
        code?: string;
        message?: string;
      };
      if (!response.ok || result.verificationStatus === "REJECTED") {
        setPhotoStage("DETAIL");
        setMessage(friendlyError(result.reasonCode ?? result.code));
        return;
      }
      approvePhotoMission(result);
    } catch {
      setPhotoStage("DETAIL");
      setMessage(
        "사진 인증 서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요.",
      );
    }
  };

  const approvePhotoMission = (
    result?: VerificationResult & { totalPoints?: number },
    awardPoints = true,
  ) => {
    if (!selected) return;
    const nextItems = items.map((item) =>
      item.id === selected.id ? { ...item, done: true } : item,
    );
    const nextLineKeys =
      result?.completedLineKeys ?? completedClientLineKeys(nextItems);
    celebrate(nextLineKeys.filter((key) => !lineKeys.includes(key)).length);
    setItems(nextItems);
    setLineKeys(nextLineKeys);
    setPoints(
      (current) =>
        result?.totalPoints ??
        (awardPoints ? current + selected.points : current),
    );
    setSelected({ ...selected, done: true });
    setPhotoStage("COMPLETE");
  };

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
      await reloadCurrentBingo();
    } catch (error) {
      setMessage(
        typeof error === "object" && error !== null && "code" in error
          ? "위치 권한을 허용한 뒤 다시 시도해주세요."
          : "서버와 연결하지 못했어요. 잠시 후 다시 시도해주세요.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const reopenTrackingMission = async () => {
    if (!trackingMissionId) return;
    let mission = items.find((item) => item.id === trackingMissionId);
    if (
      !mission &&
      trackingSessionId &&
      trackingSessionId !== sessionId &&
      !demoMode
    ) {
      try {
        const response = await apiFetch(
          `/bingos/sessions/${trackingSessionId}`,
        );
        if (!response.ok) throw new Error("Tracking session unavailable");
        const restoredSession = (await response.json()) as DailySession;
        const restoredItems = restoredSession.cells
          .sort((a, b) => a.position - b.position)
          .map(toMission);
        mission = restoredItems.find((item) => item.id === trackingMissionId);
        applySession(restoredSession);
      } catch {
        setMessage("진행 중인 GPS 미션을 다시 열지 못했어요.");
        return;
      }
    }
    if (!mission) {
      setMessage("진행 중인 GPS 미션을 찾지 못했어요.");
      return;
    }
    setSelected(mission);
    setActiveTab("bingo");
  };

  const trackingMission =
    selected?.kind === "WALK_DISTANCE" || selected?.kind === "COMPOSITE";
  const trackingTarget = selected?.targetValue ?? 0;
  const trackingBelongsToSelected =
    Boolean(selected) && trackingMissionId === selected?.id;
  const trackingCurrent =
    !trackingBelongsToSelected
      ? 0
      : selected?.kind === "WALK_DISTANCE"
        ? tracking.distanceM / 1_000
        : tracking.elapsedSeconds;
  const trackingReady =
    trackingMission && trackingTarget > 0 && trackingCurrent >= trackingTarget;
  const trackingProgress =
    trackingTarget > 0
      ? Math.min(100, Math.round((trackingCurrent / trackingTarget) * 100))
      : 0;
  const recordMission = selected?.interactionType === "TEXT";
  const timerMission = selected?.interactionType === "TIMER";
  const timerTarget = selected?.timerSeconds ?? selected?.targetValue ?? 0;
  const timerElapsed = timerStartedAt
    ? Math.max(
        0,
        Math.floor((timerNow - new Date(timerStartedAt).getTime()) / 1_000),
      )
    : 0;
  const timerRemaining = Math.max(0, timerTarget - timerElapsed);
  const timerReady = timerMission && timerTarget > 0 && timerRemaining === 0;

  if (authStatus === "checking") {
    return (
      <main className="auth-shell auth-loading">
        <div className="auth-loading-mark">⌁</div>
        <p>오늘의 산책을 준비하고 있어요…</p>
      </main>
    );
  }

  if (authStatus === "unauthenticated") {
    return <AuthScreen onAuthenticated={enterHomeAfterLogin} />;
  }

  return (
    <main className="app-shell">
      {activeTab === "bingo" && (
        <>
      <header>
        <div>
          <p className="eyebrow">
            {currentBingo.type === "DAILY"
              ? "오늘 · Daily"
              : `${currentBingo.type === "EVENT" ? "이벤트" : "지역"} · ${currentBingo.regionName ?? "Travel Bingo"}`}
          </p>
          <h1>{currentBingo.title}</h1>
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
          <span className="pill">
            {currentBingo.type === "DAILY"
              ? "DAILY WALK"
              : currentBingo.type === "EVENT"
                ? "EVENT BINGO"
                : "REGION BINGO"}
          </span>
          <h2>
            {currentBingo.type === "DAILY" ? "천천히 걸으며" : currentBingo.title}
            <br />
            {currentBingo.type === "DAILY"
              ? "오늘을 발견해요"
              : "새로운 장소를 발견해요"}
          </h2>
          <p>
            {currentBingo.type === "DAILY"
              ? "매일 같은 미션, 나만의 새로운 배치"
              : `${currentBingo.regionName ?? "여행지"}의 이야기를 빙고로 만나보세요`}
          </p>
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
              className={`${item.done ? "done" : ""} ${item.title === "Lucky!" || item.title === "FREE" ? "free" : ""}`}
              title={item.title}
              onClick={() => {
                setSelected(item);
                setMessage(null);
                setGpsCheck({
                  status: "idle",
                  accuracyM: null,
                  message: "현장에서 GPS 수신 상태를 미리 확인할 수 있어요.",
                });
                setAnswer("");
                setPhotoStage("DETAIL");
                setPhotoPreview(null);
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
        </>
      )}
      {activeTab === "home" && (
        <section className="home-screen">
          <header className="home-topbar">
            <button type="button" aria-label="메뉴">
              ☰
            </button>
            <b>travel bingo</b>
            <button
              type="button"
              aria-label="알림"
              onClick={() => setMessage("새로운 알림이 아직 없어요.")}
            >
              ♧
            </button>
          </header>

          <div className="home-greeting">
            <div>
              <p>좋은 오후예요 :)</p>
              <h1>
                {nickname}님, 오늘은
                <br />
                어디를 걸어볼까요?
              </h1>
            </div>
            <div className="home-walker" aria-hidden="true">
              <span>☀</span>
              <b>♙</b>
              <i>⌁</i>
            </div>
          </div>

          <button
            className="daily-home-card"
            type="button"
            onClick={() => setActiveTab("bingo")}
          >
            <span>
              <small>오늘의 빙고</small>
              <strong>Daily Bingo</strong>
              <em>
                {completeCount} / 25 완료 · {lineKeys.length}줄 빙고
              </em>
            </span>
            <div className="daily-notebook" aria-hidden="true">
              <i>✓</i>
              <i>✿</i>
              <i>☆</i>
              <i>⌁</i>
            </div>
          </button>

          <div className="home-section-title">
            <h2>추천 지역</h2>
            <button type="button" onClick={recommendNearbyRegions}>
              내 주변 ⌖
            </button>
          </div>
          <div className="region-cards">
            {regionRecommendations.map((region, index) => (
              <button
                type="button"
                key={region.id}
                onClick={() =>
                  setMessage(`${region.name} 지역 빙고는 곧 공개할 예정이에요.`)
                }
              >
                <span
                  className={region.attraction?.imageUrl ? "region-image" : ""}
                  style={
                    region.attraction?.imageUrl
                      ? {
                          backgroundImage: `url("${region.attraction.imageUrl}")`,
                        }
                      : undefined
                  }
                >
                  {region.attraction?.imageUrl
                    ? ""
                    : ["🏯", "🌊", "🏡"][index % 3]}
                </span>
                <b>{region.name}</b>
                <small>
                  {region.distanceKm !== null
                    ? `${region.distanceKm}km · `
                    : ""}
                  {region.attraction?.title ?? "추천 관광지 준비 중"}
                </small>
              </button>
            ))}
            {regionRecommendationsLoading && (
              <p className="region-state">활성 지역의 관광지를 찾고 있어요…</p>
            )}
            {!regionRecommendationsLoading &&
              regionRecommendations.length === 0 && (
                <p className="region-state">
                  현재 추천 가능한 활성 지역이 없어요.
                </p>
              )}
          </div>

          <div className="home-section-title">
            <h2>진행 중 빙고</h2>
            <button type="button" onClick={() => setActiveTab("catalog")}>
              더보기 ›
            </button>
          </div>
          <button
            className="ongoing-bingo-card"
            type="button"
            onClick={() => setActiveTab("bingo")}
          >
            <div className="ongoing-art" aria-hidden="true">
              🌳
            </div>
            <span>
              <small>DAILY WALK</small>
              <strong>오늘의 산책 빙고</strong>
              <em>{completeCount} / 25</em>
              <i>
                <b
                  style={{
                    width: `${Math.round((completeCount / 25) * 100)}%`,
                  }}
                />
              </i>
            </span>
            <b>›</b>
          </button>

          <div className="home-event">
            <span>✿</span>
            <div>
              <small>오늘의 산책 한마디</small>
              <b>작은 발견 하나가 여행의 시작이에요.</b>
            </div>
          </div>
        </section>
      )}
      {activeTab === "exploration" && (
        <section className="exploration-screen">
          <header className="exploration-header">
            <div>
              <small>MY TRAVEL MAP</small>
              <h1>나의 탐험 지도</h1>
              <p>빙고로 발견한 지역에 추억을 채워보세요.</p>
            </div>
            <span aria-hidden="true">⌖</span>
          </header>

          <div className="exploration-summary">
            <div>
              <b>1</b>
              <span>도전 중인 지역</span>
            </div>
            <div>
              <b>0</b>
              <span>사진을 채운 지역</span>
            </div>
            <div>
              <b>0</b>
              <span>획득한 테두리</span>
            </div>
          </div>

          <div className="map-paper">
            <div className="map-paper-tape" aria-hidden="true" />
            <div
              className="exploration-map-viewport"
              onWheel={handleMapWheel}
              onPointerDown={handleMapPointerDown}
              onPointerMove={handleMapPointerMove}
              onPointerUp={handleMapPointerUp}
              onPointerCancel={() => {
                mapPointer.current = null;
              }}
              aria-label="대한민국 도시 탐험 지도"
            >
              {explorationMapLoading && (
                <div className="exploration-map-state">
                  전국 지도를 펼치고 있어요…
                </div>
              )}
              {!explorationMapLoading && !explorationMapSvg && (
                <button
                  type="button"
                  className="exploration-map-state retry"
                  onClick={() => setExplorationMapAttempt((value) => value + 1)}
                >
                  지도를 다시 불러오기
                </button>
              )}
              {explorationMapSvg && (
                <div
                  className="exploration-map"
                  style={{
                    transform: `translate3d(${mapTransform.x}px, ${mapTransform.y}px, 0) scale(${mapTransform.scale})`,
                  }}
                >
                  <div
                    className="exploration-map-svg"
                    dangerouslySetInnerHTML={{ __html: explorationMapSvg }}
                  />
                  <div className="anseong-map-marker" aria-hidden="true">
                    <i />
                    <span>도전 중 · 안성</span>
                  </div>
                </div>
              )}
            </div>
            <div className="exploration-map-controls">
              <button
                type="button"
                aria-label="지도 확대"
                onClick={() => updateMapScale(mapTransform.scale * 1.25)}
              >
                +
              </button>
              <button
                type="button"
                aria-label="지도 축소"
                onClick={() => updateMapScale(mapTransform.scale * 0.8)}
              >
                −
              </button>
              <button
                type="button"
                aria-label="지도 위치 초기화"
                onClick={() =>
                  setMapTransform({ scale: 0.92, x: 18, y: 0 })
                }
              >
                ◎
              </button>
            </div>
            <p className="map-gesture-tip">버튼으로 확대하고 끌어서 둘러보세요</p>
          </div>

          <article className="selected-region-card">
            <div className="region-stamp" aria-hidden="true">
              {selectedMapRegion.name.slice(0, 1)}
            </div>
            <div>
              <small>{selectedMapRegion.province || "대한민국"}</small>
              <h2>{selectedMapRegion.name}</h2>
              <p>
                {selectedMapRegion.code === "31220"
                  ? "안성 여행 빙고에 도전 중이에요."
                  : "아직 이 지역의 여행 기록이 없어요."}
              </p>
            </div>
            <span
              className={
                selectedMapRegion.code === "31220"
                  ? "region-status active"
                  : "region-status"
              }
            >
              {selectedMapRegion.code === "31220" ? "도전 중" : "미발견"}
            </span>
          </article>

          {selectedMapRegion.code === "31220" ? (
            <div className="region-progress-note">
              <span aria-hidden="true">✎</span>
              <div>
                <b>사진 해금까지 3 Bingo</b>
                <p>
                  안성 지역 빙고에서 세 줄을 완성하면 지도에 대표 사진을
                  남길 수 있어요.
                </p>
              </div>
              <strong>{Math.min(3, lineKeys.length)} / 3</strong>
            </div>
          ) : (
            <div className="region-progress-note muted">
              <span aria-hidden="true">☆</span>
              <div>
                <b>새로운 여행을 기다리고 있어요</b>
                <p>지역 빙고가 열리면 이곳에서 진행 상황을 확인할 수 있어요.</p>
              </div>
            </div>
          )}
        </section>
      )}
      {activeTab === "catalog" && (
        <section className="catalog-screen">
          <header className="catalog-header">
            <button
              type="button"
              aria-label="홈으로 돌아가기"
              onClick={() => setActiveTab("home")}
            >
              ←
            </button>
            <div>
              <small>MY BINGO NOTE</small>
              <h1>나의 빙고</h1>
            </div>
          </header>
          <p className="catalog-intro">
            진행 중인 빙고를 이어가거나 새로운 여행을 시작해보세요.
          </p>
          {bingoCatalogLoading ? (
            <p className="catalog-state">빙고 노트를 펼치고 있어요…</p>
          ) : bingoCatalog.length === 0 ? (
            <p className="catalog-state">
              지금 참여할 수 있는 빙고가 아직 없어요.
            </p>
          ) : (
            <div className="catalog-list">
              {bingoCatalog.map((bingo) => {
                const percent =
                  bingo.totalCellCount > 0
                    ? Math.round(
                        (bingo.completedCellCount / bingo.totalCellCount) * 100,
                      )
                    : 0;
                const typeLabel =
                  bingo.type === "DAILY"
                    ? "DAILY"
                    : bingo.type === "EVENT"
                      ? "EVENT"
                      : "REGION";
                const stateLabel =
                  bingo.state === "IN_PROGRESS"
                    ? "이어하기"
                    : bingo.state === "COMPLETED"
                      ? "완료"
                      : "시작하기";
                return (
                  <button
                    className={`catalog-card ${bingo.type.toLowerCase()}`}
                    type="button"
                    key={bingo.id}
                    onClick={() => void openCatalogBingo(bingo)}
                  >
                    <span className="catalog-card-icon" aria-hidden="true">
                      {bingo.type === "DAILY"
                        ? "☀"
                        : bingo.type === "EVENT"
                          ? "✿"
                          : "⌖"}
                    </span>
                    <span className="catalog-card-body">
                      <small>
                        {typeLabel}
                        {bingo.regionName ? ` · ${bingo.regionName}` : ""}
                      </small>
                      <strong>{bingo.title}</strong>
                      <em>
                        {bingo.state === "AVAILABLE"
                          ? `${bingo.totalCellCount}개 미션`
                          : `${bingo.completedCellCount} / ${bingo.totalCellCount} · ${bingo.totalPoints}P`}
                      </em>
                      <i>
                        <b style={{ width: `${percent}%` }} />
                      </i>
                    </span>
                    <span className="catalog-card-action">{stateLabel} ›</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}
      {activeTab === "ranking" && (
        <section className="ranking-screen">
          <header className="ranking-header">
            <h1>랭킹</h1>
          </header>
          <div className="ranking-tabs" aria-label="랭킹 기간">
            {(
              [
                ["DAILY", "일간"],
                ["WEEKLY", "주간"],
                ["MONTHLY", "월간"],
                ["TOTAL", "누적"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                className={rankingPeriod === value ? "active" : ""}
                onClick={() => setRankingPeriod(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="ranking-tabs scope-tabs" aria-label="랭킹 범위">
            {(
              [
                ["ALL", "전체"],
                ["COMMON", "공통"],
                ["REGION", "지역"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                className={rankingScope === value ? "active" : ""}
                onClick={() => setRankingScope(value)}
              >
                {label}
              </button>
            ))}
            <button disabled title="친구 기능 준비 중">
              친구
            </button>
          </div>
          <p className="ranking-timer">
            {ranking.endsAt
              ? `이번 랭킹 종료까지 ${remainingTime(ranking.endsAt, clock)}`
              : "랭킹 집계 데이터를 준비하고 있어요"}
          </p>
          {ranking.me && (
            <div className="my-rank-card">
              <strong>{ranking.me.rank}</strong>
              <span className="rank-avatar">
                {ranking.me.nickname.slice(0, 1)}
              </span>
              <b>{ranking.me.nickname}</b>
              <span>{ranking.me.points.toLocaleString()} P</span>
            </div>
          )}
          <div className={`ranking-list ${rankingLoading ? "loading" : ""}`}>
            {ranking.entries.map((entry) => (
              <div
                className={`ranking-row ${entry.userId === ranking.me?.userId ? "is-me" : ""}`}
                key={entry.userId}
              >
                <strong className={`rank rank-${entry.rank}`}>
                  {entry.rank <= 3
                    ? ["", "🥇", "🥈", "🥉"][entry.rank]
                    : entry.rank}
                </strong>
                <span className="rank-avatar">
                  {entry.nickname.slice(0, 1)}
                </span>
                <b>
                  {entry.nickname}
                  {entry.userId === ranking.me?.userId && <small> (나)</small>}
                </b>
                <span>{entry.points.toLocaleString()} P</span>
              </div>
            ))}
            {!rankingLoading && ranking.entries.length === 0 && (
              <p className="ranking-empty">
                아직 랭킹에 등록된 참여자가 없어요.
              </p>
            )}
          </div>
        </section>
      )}
      {activeTab === "my" && (
        <section className="my-screen">
          <header className="my-header">
            <h1>마이</h1>
          </header>
          <div className="my-profile-card">
            <span className="my-avatar">
              {(account?.nickname ?? nickname).slice(0, 1)}
            </span>
            <div>
              <h2>{account?.nickname ?? nickname}</h2>
              <p>{account?.email ?? "체험 계정"}</p>
            </div>
            <span className="level-badge">산책자</span>
          </div>
          <div className="my-stats">
            <div>
              <b>{points.toLocaleString()}</b>
              <span>누적 Point</span>
            </div>
            <div>
              <b>{completeCount}</b>
              <span>완료 미션</span>
            </div>
            <div>
              <b>{lineKeys.length}</b>
              <span>완성 빙고</span>
            </div>
          </div>
          <div className="my-menu">
            <button type="button">
              <span>▤</span>
              여행 기록
              <b>›</b>
            </button>
            <button type="button">
              <span>♧</span>
              획득 배지
              <b>›</b>
            </button>
            <button type="button">
              <span>⚙</span>
              설정
              <b>›</b>
            </button>
          </div>
          {account?.role === "ADMIN" && (
            <p className="admin-account-note">
              관리자 계정입니다 · 관리자 화면은 별도 콘솔을 이용해주세요.
            </p>
          )}
          <button className="logout-button" type="button" onClick={logout}>
            로그아웃
          </button>
          <div className="my-doodle" aria-hidden="true">
            <span>⌁</span>
            <i>✿</i>
            <b>♧</b>
          </div>
        </section>
      )}
      {trackingMissionId && tracking.active && (
        <button
          type="button"
          className="active-gps-banner"
          onClick={() => void reopenTrackingMission()}
        >
          <span aria-hidden="true">●</span>
          <b>GPS 기록 중</b>
          <em>{trackingTime(tracking.elapsedSeconds)}</em>
          <strong>미션으로 돌아가기 ›</strong>
        </button>
      )}
      <nav>
        <button
          className={activeTab === "home" ? "active" : ""}
          onClick={() => setActiveTab("home")}
        >
          <span>⌂</span>홈
        </button>
        <button
          className={activeTab === "exploration" ? "active" : ""}
          onClick={() => {
            setMessage(null);
            setActiveTab("exploration");
          }}
        >
          <span>♧</span>탐험
        </button>
        <button
          className={
            activeTab === "catalog" || activeTab === "bingo" ? "active" : ""
          }
          onClick={() => setActiveTab("catalog")}
        >
          <span>▦</span>빙고
        </button>
        <button
          className={activeTab === "ranking" ? "active" : ""}
          onClick={() => setActiveTab("ranking")}
        >
          <span>☆</span>랭킹
        </button>
        <button
          className={activeTab === "my" ? "active" : ""}
          onClick={() => setActiveTab("my")}
        >
          <span>○</span>마이
        </button>
      </nav>
      {message && !selected && (
        <button
          type="button"
          className="app-toast"
          onClick={() => setMessage(null)}
          aria-label="안내 메시지 닫기"
        >
          {message}
        </button>
      )}
      {selected && (
        <div className="modal-backdrop" onClick={closeMission}>
          <section
            className={`mission-sheet ${selected.kind === "PHOTO" ? "photo-sheet" : ""} ${selected.interactionType ? "journal-sheet" : ""}`}
            onClick={(event) => event.stopPropagation()}
          >
            <button className="close" onClick={closeMission}>
              ×
            </button>
            {selected.kind === "PHOTO" && photoStage === "COMPLETE" ? (
              <div className="mission-complete">
                <p className="sheet-kicker">미션 완료</p>
                <div className="completion-medal" aria-hidden="true">
                  ✓
                </div>
                <h2>{selected.title}</h2>
                <strong>+ {selected.points} Point</strong>
                <div className="completion-progress">
                  <span>현재 진행도</span>
                  <b>{completeCount} / 25</b>
                  <div className="track">
                    <i style={{ width: `${(completeCount / 25) * 100}%` }} />
                  </div>
                </div>
                <button className="secondary" onClick={closeMission}>
                  빙고판으로 돌아가기
                </button>
              </div>
            ) : (
              <>
                <p className="sheet-kicker">
                  미션 상세 {selected.kind === "PHOTO" ? "(사진 인증)" : ""}
                </p>
                {photoPreview ? (
                  <div className="photo-preview">
                    <img src={photoPreview} alt="선택한 인증 사진 미리보기" />
                    {photoStage === "REVIEWING" && (
                      <div className="ai-review" role="status">
                        <i />
                        <b>AI가 사진을 확인하고 있어요</b>
                        <span>
                          미션 조건과 사진의 안전성을 살펴보는 중이에요.
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <span className={`large-icon ${selected.kind.toLowerCase()}`}>
                    {selected.done ? "✓" : icon[selected.kind]}
                  </span>
                )}
                <h2>{selected.title}</h2>
                <p className="description">{selected.description}</p>
                <div className="detail-list">
                  <p>
                    <span>▣</span>
                    <b>인증 방법</b>
                    <em>
                      {selected.verificationLabel ??
                        selected.kind.replace("_", " ")}
                    </em>
                  </p>
                  <p>
                    <span>◉</span>
                    <b>획득 점수</b>
                    <em>{selected.points} Point</em>
                  </p>
                  {selected.kind === "PLACE_VISIT" && selected.place && (
                    <>
                      <p>
                        <span>위치</span>
                        <b>{selected.place.title}</b>
                        <em>인증 반경 {selected.radiusM ?? 100}m</em>
                      </p>
                      <p className="gps-guidance">
                        GPS를 켜고 장소 가까이에서 인증해주세요. 위치 권한이
                        꺼져 있거나 오차가 크면 인증할 수 없습니다.
                      </p>
                      <div
                        className={`gps-preflight ${gpsCheck.status}`}
                        aria-live="polite"
                      >
                        <div>
                          <b>GPS 사전 점검</b>
                          {gpsCheck.accuracyM !== null && (
                            <strong>오차 약 {gpsCheck.accuracyM}m</strong>
                          )}
                        </div>
                        <p>{gpsCheck.message}</p>
                        <button
                          type="button"
                          onClick={() => void checkGpsStatus()}
                          disabled={gpsCheck.status === "checking"}
                        >
                          {gpsCheck.status === "checking"
                            ? "확인 중…"
                            : "현재 위치 점검"}
                        </button>
                      </div>
                    </>
                  )}
                  {selected.kind === "PHOTO" && (
                    <p className="privacy-warning">
                      <strong>
                        대상이 잘 보이도록 촬영하고,
                        <br />
                        주변 사람의 얼굴이나 차량번호가 나오지 않도록
                        촬영해주세요.
                      </strong>
                    </p>
                  )}
                </div>
                {selected.kind === "QUIZ" && !selected.done && (
                  <input
                    className="answer-input"
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
                    placeholder="정답을 입력해주세요"
                  />
                )}
                {recordMission && !selected.done && (
                  <div className="journal-paper">
                    <label htmlFor="mission-record">오늘의 이야기</label>
                    <textarea
                      id="mission-record"
                      value={textRecord}
                      maxLength={selected.textMaxLength ?? 100}
                      onChange={(event) => setTextRecord(event.target.value)}
                      placeholder="지금 이 순간의 감정을 자유롭게 적어보세요."
                    />
                    <small>
                      {textRecord.length} / {selected.textMaxLength ?? 100}자
                    </small>
                  </div>
                )}
                {timerMission && !selected.done && (
                  <div
                    className={`mission-timer ${timerReady ? "is-complete" : ""}`}
                    aria-live="polite"
                  >
                    <span>{timerStartedAt ? "진행 중" : "시작 전"}</span>
                    <div
                      className="timer-ring"
                      style={
                        {
                          "--timer-progress": `${timerTarget > 0 ? Math.min(100, (timerElapsed / timerTarget) * 100) : 0}%`,
                        } as React.CSSProperties
                      }
                    >
                      <strong>{trackingTime(timerRemaining)}</strong>
                    </div>
                    <p>
                      {timerReady
                        ? "훌륭해요! 목표 시간을 모두 채웠어요."
                        : timerStartedAt
                          ? "화면을 벗어나도 타이머는 계속 이어져요."
                          : "시작하기를 누르고 여유로운 시간을 가져보세요."}
                    </p>
                  </div>
                )}
                {message && <p className="error-message">{message}</p>}
                {selected.kind === "PHOTO" ? (
                  <div className="photo-actions">
                    <input
                      ref={cameraInput}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      hidden
                      onChange={(event) => verifyPhoto(event.target.files?.[0])}
                    />
                    <input
                      ref={albumInput}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(event) => verifyPhoto(event.target.files?.[0])}
                    />
                    <button
                      className="primary"
                      onClick={() => cameraInput.current?.click()}
                      disabled={photoStage === "REVIEWING" || selected.done}
                    >
                      사진 촬영하기
                    </button>
                    <button
                      className="secondary"
                      onClick={() => albumInput.current?.click()}
                      disabled={photoStage === "REVIEWING" || selected.done}
                    >
                      앨범에서 선택
                    </button>
                  </div>
                ) : (
                  <>
                    {trackingMission && (
                      <div className="gps-tracker" aria-live="polite">
                        <div>
                          <span>
                            {selected.kind === "WALK_DISTANCE"
                              ? "이동 거리"
                              : "기록 시간"}
                          </span>
                          <b>
                            {selected.kind === "WALK_DISTANCE"
                              ? `${trackingCurrent.toFixed(2)} / ${trackingTarget} km`
                              : `${trackingTime(trackingCurrent)} / ${trackingTime(trackingTarget)}`}
                          </b>
                        </div>
                        <div className="track">
                          <i style={{ width: `${trackingProgress}%` }} />
                        </div>
                        <small>
                          {trackingBelongsToSelected && tracking.active
                            ? tracking.latest
                              ? `GPS 정확도 약 ${Math.round(tracking.latest.accuracyM)}m`
                              : "GPS 신호를 찾고 있어요…"
                            : trackingReady
                              ? "목표를 달성했어요. 인증을 완료해주세요."
                              : "화면을 켜둔 상태에서 GPS 기록을 진행해주세요."}
                        </small>
                      </div>
                    )}
                    {!recordMission && !timerMission && (
                      <div className="reward">
                        <span>획득 보상</span>
                        <b>+ {selected.points} Point</b>
                      </div>
                    )}
                    {recordMission ? (
                      <button
                        className="primary journal-submit"
                        onClick={submitRecordMission}
                        disabled={
                          selected.done ||
                          submitting ||
                          textRecord.trim().length === 0
                        }
                      >
                        {submitting ? "기록하고 있어요…" : "✓ 인증하기"}
                      </button>
                    ) : timerMission ? (
                      timerStartedAt ? (
                        <button
                          className="primary journal-submit"
                          onClick={submitRecordMission}
                          disabled={selected.done || submitting || !timerReady}
                        >
                          {submitting
                            ? "인증하고 있어요…"
                            : timerReady
                              ? "✓ 인증하기"
                              : "타이머 진행 중"}
                        </button>
                      ) : (
                        <button
                          className="primary timer-start"
                          onClick={startMissionTimer}
                          disabled={selected.done || submitting}
                        >
                          ▶ 시작하기
                        </button>
                      )
                    ) : trackingMission ? (
                      <div className="tracking-actions">
                        {trackingBelongsToSelected && tracking.active ? (
                          <button
                            className="secondary"
                            onClick={stopTracking}
                            disabled={submitting}
                          >
                            기록 일시정지
                          </button>
                        ) : (
                          <button
                            className="secondary"
                            onClick={startTracking}
                            disabled={
                              selected.done ||
                              submitting ||
                              (tracking.active && !trackingBelongsToSelected)
                            }
                          >
                            {tracking.elapsedSeconds > 0
                              ? "처음부터 다시 기록"
                              : "GPS 기록 시작하기"}
                          </button>
                        )}
                        <button
                          className="primary"
                          onClick={submitTracking}
                          disabled={
                            selected.done || submitting || !trackingReady
                          }
                        >
                          {submitting
                            ? "인증하고 있어요…"
                            : trackingReady
                              ? "미션 인증 완료하기"
                              : "목표 달성 후 인증 가능"}
                        </button>
                      </div>
                    ) : (
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
                              : selected.kind === "QUIZ"
                                ? "정답 제출하기"
                                : "미션 완료하기"}
                      </button>
                    )}
                  </>
                )}
              </>
            )}
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
