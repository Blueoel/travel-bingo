"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import type { IScannerControls } from "@zxing/browser";

import { AuthScreen } from "./auth-screen";

type MissionKind =
  | "CHECK_IN"
  | "QUIZ"
  | "PLACE_VISIT"
  | "QR_SCAN"
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
  reviewPending?: boolean;
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
  regionCode?: string;
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
  verificationStatus?: "APPROVED" | "REJECTED" | "NEEDS_REVIEW";
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
    reviewPending: cell.status === "SUBMITTED",
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
type RankingScope = "ALL" | "COMMON" | "REGION" | "FRIEND";
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
  regionCode?: string | null;
  available?: boolean;
  unavailableReason?: string | null;
};
type AccountUser = {
  id: string;
  nickname: string;
  email: string | null;
  role: "USER" | "ADMIN";
};
type Announcement = {
  id: string;
  title: string;
  content: string;
  isImportant: boolean;
  createdAt: string;
  isRead: boolean;
};
type FriendUser = { id: string; nickname: string; email: string | null };
type Friendship = { id: string; status: "PENDING" | "ACCEPTED" | "REJECTED"; direction: "SENT" | "RECEIVED"; isUnread?: boolean; updatedAt?: string; user: FriendUser };
type FriendProfile = {
  id: string;
  nickname: string;
  joinedAt: string;
  totalPoints: number;
  completedMissions: number;
  completedBingos: number;
  recentActivity: Array<{ title: string; completedAt: string | null }>;
};
type BlockedUser = { id: string; createdAt: string; blocked: { id: string; nickname: string } };
type BadgeSummary = {
  totals: { points: number; completedMissions: number; completedBingos: number; completedRegions: number };
  badges: Badge[];
  newlyEarned?: Badge[];
};
type Badge = { id: string; title: string; description: string; icon: string; imageUrl?: string | null; current: number; target: number; earned: boolean; earnedAt?: string | null; progress: number };
type BadgeNotification = Pick<Badge, "id" | "title" | "description" | "icon" | "imageUrl"> & { earnedAt: string; isRead: boolean };
type PhotoReviewNotification = {
  id: string;
  missionTitle: string;
  decision: "APPROVED" | "REJECTED";
  reason: string | null;
  decidedAt: string;
  isRead: boolean;
};
type RankingRewardNotice = {
  id: string;
  period: "DAILY" | "WEEKLY" | "MONTHLY";
  rank: number;
  score: number;
  points: number;
  awardedAt: string;
  isRead: boolean;
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
  regionCode: string | null;
  state: "IN_PROGRESS" | "COMPLETED" | "AVAILABLE";
  completedCellCount: number;
  totalCellCount: number;
  totalPoints: number;
  startsAt: string | null;
  endsAt: string | null;
};
type RegionDirectoryItem = {
  code: string;
  name: string;
  province: string;
  regionType: "CITY" | "COUNTY" | "METROPOLITAN";
};
type ExplorationMemory = {
  regionCode: string;
  lineCount: number;
  unlocked: boolean;
  photoUrl: string | null;
  selectedAt: string | null;
};
type ExplorationRecord = ExplorationMemory & {
  regionName: string;
  provinceName: string;
  missionTitles: string[];
};
type MemoryPhoto = {
  id: string;
  missionId: string;
  missionTitle: string;
  imageUrl: string;
  submittedAt: string;
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
  QR_SCAN: "▦",
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
    QR_INVALID: "이 미션의 QR 코드가 아니거나 유효하지 않은 코드예요.",
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
  if (kind === "QR_SCAN") return "현장 QR 스캔";
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
  const [qrToken, setQrToken] = useState("");
  const [qrScanning, setQrScanning] = useState(false);
  const [timerStartedAt, setTimerStartedAt] = useState<string | null>(null);
  const [timerNow, setTimerNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementsOpen, setAnnouncementsOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [friendQuery, setFriendQuery] = useState("");
  const [friendResults, setFriendResults] = useState<FriendUser[]>([]);
  const [friendProfile, setFriendProfile] = useState<FriendProfile | null>(null);
  const [friendProfileLoading, setFriendProfileLoading] = useState(false);
  const [reportTarget, setReportTarget] = useState<FriendProfile | null>(null);
  const [reportReason, setReportReason] = useState("부적절한 닉네임");
  const [reportDetail, setReportDetail] = useState("");
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [badgeSummary, setBadgeSummary] = useState<BadgeSummary | null>(null);
  const [badgeNotifications, setBadgeNotifications] = useState<BadgeNotification[]>([]);
  const [photoReviewNotifications, setPhotoReviewNotifications] = useState<
    PhotoReviewNotification[]
  >([]);
  const [rankingRewards, setRankingRewards] = useState<RankingRewardNotice[]>([]);
  const [badgeQueue, setBadgeQueue] = useState<Badge[]>([]);
  const [badgeCelebration, setBadgeCelebration] = useState<Badge | null>(null);
  const [profileNickname, setProfileNickname] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [withdrawPassword, setWithdrawPassword] = useState("");
  const [settingsStatus, setSettingsStatus] = useState<string | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
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
    | "home"
    | "regions"
    | "exploration"
    | "catalog"
    | "bingo"
    | "ranking"
    | "my"
  >("home");
  const [myView, setMyView] = useState<"main" | "travel-note" | "badges" | "rewards" | "settings">("main");
  const [explorationMapSvg, setExplorationMapSvg] = useState("");
  const [explorationMapLoading, setExplorationMapLoading] = useState(false);
  const [explorationMapAttempt, setExplorationMapAttempt] = useState(0);
  const [explorationMemory, setExplorationMemory] =
    useState<ExplorationMemory>({
      regionCode: "31220",
      lineCount: 0,
      unlocked: false,
      photoUrl: null,
      selectedAt: null,
    });
  const [explorationRecords, setExplorationRecords] = useState<
    ExplorationRecord[]
  >([]);
  const [explorationMemoryLoading, setExplorationMemoryLoading] =
    useState(false);
  const [explorationMemorySaving, setExplorationMemorySaving] =
    useState(false);
  const [memoryPhotos, setMemoryPhotos] = useState<MemoryPhoto[]>([]);
  const [memoryPhotosLoading, setMemoryPhotosLoading] = useState(false);
  const [memoryPhotoPickerOpen, setMemoryPhotoPickerOpen] = useState(false);
  const [memoryDetailOpen, setMemoryDetailOpen] = useState(false);
  const [anseongMissionTitles, setAnseongMissionTitles] = useState<string[]>([]);
  const [selectedMapRegion, setSelectedMapRegion] = useState({
    code: "31220",
    name: "안성시",
    province: "경기도",
  });
  const [mapTransform, setMapTransform] = useState({
    scale: 1.06,
    x: -8,
    y: -18,
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
  const [regionDirectory, setRegionDirectory] = useState<RegionDirectoryItem[]>([]);
  const [regionDirectoryLoading, setRegionDirectoryLoading] = useState(false);
  const [regionSearch, setRegionSearch] = useState("");
  const [rankingPeriod, setRankingPeriod] = useState<RankingPeriod>("WEEKLY");
  const [rankingScope, setRankingScope] = useState<RankingScope>("ALL");
  const [rankingRegionCode, setRankingRegionCode] = useState("");
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
  const [pendingRegionChallenge, setPendingRegionChallenge] = useState<{
    region: RegionRecommendation;
    bingo: BingoCatalogItem;
  } | null>(null);
  const [photoStage, setPhotoStage] = useState<
    "DETAIL" | "REVIEWING" | "COMPLETE"
  >("DETAIL");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoReviewState, setPhotoReviewState] = useState<
    "NONE" | "AVAILABLE" | "REQUESTING" | "PENDING"
  >("NONE");
  const [photoVerificationId, setPhotoVerificationId] = useState<string | null>(
    null,
  );
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
  const representativePhotoInput = useRef<HTMLInputElement>(null);
  const qrVideo = useRef<HTMLVideoElement>(null);
  const qrScannerControls = useRef<IScannerControls | null>(null);
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

  const loadAnnouncements = async () => {
    try {
      const response = await apiFetch("/announcements");
      if (!response.ok) return;
      const loaded = (await response.json()) as Announcement[];
      setAnnouncements(loaded);
      const unreadImportant = loaded.find((item) => item.isImportant && !item.isRead);
      if (unreadImportant) setSelectedAnnouncement(unreadImportant);
    } catch {
      // 공지 조회 실패는 빙고 이용을 막지 않습니다.
    }
  };

  useEffect(() => {
    if (authStatus === "authenticated") void loadAnnouncements();
  }, [authStatus]);

  const openAnnouncement = (item: Announcement) => {
    setSelectedAnnouncement(item);
    if (!item.isRead) {
      setAnnouncements((current) => current.map((value) => value.id === item.id ? { ...value, isRead: true } : value));
      void apiFetch(`/announcements/${item.id}/read`, { method: "POST" });
    }
  };

  const closeAnnouncement = () => {
    if (selectedAnnouncement && !selectedAnnouncement.isRead) {
      setAnnouncements((current) => current.map((value) => value.id === selectedAnnouncement.id ? { ...value, isRead: true } : value));
      void apiFetch(`/announcements/${selectedAnnouncement.id}/read`, { method: "POST" });
    }
    setSelectedAnnouncement(null);
  };
  const loadFriends = async () => {
    const response = await apiFetch("/friends");
    if (response.ok) setFriends(await response.json());
  };
  useEffect(() => {
    if (authStatus === "authenticated") void loadFriends();
  }, [authStatus]);
  const searchFriends = async (query: string) => {
    setFriendQuery(query);
    if (query.trim().length < 2) return setFriendResults([]);
    const response = await apiFetch(`/friends/search?q=${encodeURIComponent(query.trim())}`);
    if (response.ok) setFriendResults(await response.json());
  };
  const requestFriend = async (userId: string) => {
    await apiFetch("/friends", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId }) });
    setFriendResults([]); setFriendQuery(""); await loadFriends();
  };
  const decideFriend = async (id: string, accept: boolean) => {
    await apiFetch(`/friends/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ accept }) });
    await loadFriends();
  };
  const removeFriend = async (item: Friendship) => {
    const action = item.status === "ACCEPTED" ? "친구를 삭제할까요?" : "보낸 요청을 취소할까요?";
    if (!window.confirm(action)) return;
    const response = await apiFetch(`/friends/${item.id}`, { method: "DELETE" });
    if (response.ok) await loadFriends();
  };
  const openFriendProfile = async (user: FriendUser) => {
    setFriendsOpen(false);
    setFriendProfileLoading(true);
    try {
      const response = await apiFetch(`/friends/${user.id}/profile`);
      if (response.ok) setFriendProfile(await response.json());
    } finally {
      setFriendProfileLoading(false);
    }
  };
  const openFriendRanking = () => {
    setFriendsOpen(false);
    setFriendProfile(null);
    setRankingScope("FRIEND");
    setActiveTab("ranking");
  };
  const openAcceptedFriendNotification = async (item: Friendship) => {
    setAnnouncementsOpen(false);
    if (item.isUnread) {
      await apiFetch(`/friends/${item.id}/read`, { method: "PATCH" });
      await loadFriends();
    }
    await openFriendProfile(item.user);
  };
  const blockFriend = async (profile: FriendProfile) => {
    if (!window.confirm(`${profile.nickname}님을 차단할까요? 서로 친구 목록과 랭킹에서 제외됩니다.`)) return;
    const response = await apiFetch(`/friends/${profile.id}/block`, { method: "POST" });
    if (response.ok) {
      setFriendProfile(null);
      await loadFriends();
    }
  };
  const submitFriendReport = async () => {
    if (!reportTarget) return;
    const response = await apiFetch(`/friends/${reportTarget.id}/report`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: reportReason, detail: reportDetail }) });
    if (response.ok) {
      setReportTarget(null);
      setReportDetail("");
      window.alert("신고가 접수되었습니다. 관리자가 확인할게요.");
    }
  };
  const openSettings = async () => {
    setMyView("settings");
    setProfileNickname(account?.nickname ?? nickname);
    setCurrentPassword("");
    setNewPassword("");
    setNewPasswordConfirm("");
    setWithdrawPassword("");
    setSettingsStatus(null);
    const response = await apiFetch("/friends/blocks");
    if (response.ok) setBlockedUsers(await response.json());
  };
  const loadAccountSummary = async () => {
    const response = await apiFetch("/friends/badges");
    if (response.ok) setBadgeSummary(await response.json());
  };
  const loadBadgeNotifications = async () => {
    const response = await apiFetch("/friends/badge-notifications");
    if (response.ok) setBadgeNotifications(await response.json());
  };
  const loadRankingRewards = async () => {
    const response = await apiFetch("/rankings/rewards");
    if (response.ok) setRankingRewards(await response.json());
  };
  const loadPhotoReviewNotifications = async () => {
    const response = await apiFetch(
      "/daily-sessions/photo-review-notifications",
    );
    if (!response.ok) return [];
    const loaded = (await response.json()) as PhotoReviewNotification[];
    setPhotoReviewNotifications(loaded);
    return loaded;
  };
  const syncEarnedBadges = async () => {
    try {
      const response = await apiFetch("/friends/badges/sync", { method: "POST" });
      if (!response.ok) return;
      const summary = (await response.json()) as BadgeSummary;
      setBadgeSummary(summary);
      if (summary.newlyEarned?.length) {
        setBadgeQueue((current) => [...current, ...summary.newlyEarned!]);
        await loadBadgeNotifications();
      }
    } catch {
      // 배지 동기화 실패가 완료된 미션의 결과를 되돌리지는 않습니다.
    }
  };
  const openBadges = async () => {
    setMyView("badges");
    await loadAccountSummary();
  };
  const openBadgeNotification = async (item: BadgeNotification) => {
    setAnnouncementsOpen(false);
    if (!item.isRead) {
      await apiFetch(`/friends/badge-notifications/${item.id}/read`, { method: "PATCH" });
      setBadgeNotifications((current) => current.map((value) => value.id === item.id ? { ...value, isRead: true } : value));
    }
    setActiveTab("my");
    await openBadges();
  };
  const openRankingReward = async (item: RankingRewardNotice) => {
    setAnnouncementsOpen(false);
    if (!item.isRead) {
      await apiFetch(`/rankings/rewards/${item.id}/read`, { method: "PATCH" });
      setRankingRewards((current) => current.map((value) => value.id === item.id ? { ...value, isRead: true } : value));
    }
    setActiveTab("my");
    setMyView("rewards");
  };
  const openPhotoReviewNotification = async (
    item: PhotoReviewNotification,
  ) => {
    setAnnouncementsOpen(false);
    if (!item.isRead) {
      await apiFetch(
        `/daily-sessions/photo-review-notifications/${item.id}/read`,
        { method: "PATCH" },
      );
      setPhotoReviewNotifications((current) =>
        current.map((value) =>
          value.id === item.id ? { ...value, isRead: true } : value,
        ),
      );
    }
    await reloadCurrentBingo();
    if (item.decision === "APPROVED") await syncEarnedBadges();
    setMessage(
      item.decision === "APPROVED"
        ? `${item.missionTitle} 사진 인증이 승인됐어요. 포인트와 빙고 진행도에 반영했습니다.`
        : `${item.missionTitle} 사진 인증이 반려됐어요. ${item.reason ?? "사진을 다시 확인해주세요."}`,
    );
    setActiveTab("bingo");
  };
  const viewCelebratedBadge = async () => {
    const badge = badgeCelebration;
    setBadgeCelebration(null);
    if (badge) {
      await apiFetch(`/friends/badge-notifications/${badge.id}/read`, { method: "PATCH" });
      setBadgeNotifications((current) => current.map((item) => item.id === badge.id ? { ...item, isRead: true } : item));
    }
    setActiveTab("my");
    await openBadges();
  };
  useEffect(() => {
    if (authStatus !== "authenticated") return;
    void loadAccountSummary();
    void loadBadgeNotifications();
    void loadRankingRewards();
    void loadPhotoReviewNotifications();
  }, [authStatus]);
  useEffect(() => {
    if (bingoFlash || badgeCelebration || !badgeQueue.length) return;
    setBadgeCelebration(badgeQueue[0]);
    setBadgeQueue((current) => current.slice(1));
  }, [bingoFlash, badgeCelebration, badgeQueue]);
  const unblockUser = async (block: BlockedUser) => {
    if (!window.confirm(`${block.blocked.nickname}님의 차단을 해제할까요?`)) return;
    const response = await apiFetch(`/friends/blocks/${block.id}`, { method: "DELETE" });
    if (response.ok) setBlockedUsers((current) => current.filter((item) => item.id !== block.id));
  };
  const saveNickname = async () => {
    setSettingsSaving(true);
    setSettingsStatus(null);
    try {
      const response = await apiFetch("/auth/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ nickname: profileNickname }) });
      const payload = await response.json() as { user?: AccountUser; message?: string };
      if (!response.ok || !payload.user) throw new Error(payload.message ?? "닉네임을 변경하지 못했어요.");
      setAccount(payload.user);
      setNickname(payload.user.nickname);
      setProfileNickname(payload.user.nickname);
      setSettingsStatus("닉네임을 변경했어요.");
    } catch (error) {
      setSettingsStatus(error instanceof Error ? error.message : "닉네임을 변경하지 못했어요.");
    } finally { setSettingsSaving(false); }
  };
  const savePassword = async () => {
    if (newPassword !== newPasswordConfirm) {
      setSettingsStatus("새 비밀번호가 서로 일치하지 않아요.");
      return;
    }
    setSettingsSaving(true);
    setSettingsStatus(null);
    try {
      const response = await apiFetch("/auth/password", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword }) });
      const payload = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "비밀번호를 변경하지 못했어요.");
      window.alert("비밀번호를 변경했어요. 새 비밀번호로 다시 로그인해주세요.");
      clearAuthenticatedState();
    } catch (error) {
      setSettingsStatus(error instanceof Error ? error.message : "비밀번호를 변경하지 못했어요.");
    } finally { setSettingsSaving(false); }
  };
  const withdrawAccount = async () => {
    if (!withdrawPassword) return setSettingsStatus("탈퇴하려면 현재 비밀번호를 입력해주세요.");
    if (!window.confirm("회원 탈퇴 후에는 계정과 로그인 정보를 복구할 수 없습니다. 정말 탈퇴할까요?")) return;
    setSettingsSaving(true);
    setSettingsStatus(null);
    try {
      const response = await apiFetch("/auth/account", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ currentPassword: withdrawPassword }) });
      const payload = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "회원 탈퇴를 처리하지 못했어요.");
      clearAuthenticatedState();
    } catch (error) {
      setSettingsStatus(error instanceof Error ? error.message : "회원 탈퇴를 처리하지 못했어요.");
    } finally { setSettingsSaving(false); }
  };

  useEffect(() => {
    if (activeTab === "my" && authStatus === "authenticated") void loadAccountSummary();
  }, [activeTab, authStatus]);

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
    if (authStatus !== "authenticated") return;
    const refreshReviewResults = async () => {
      const notifications = await loadPhotoReviewNotifications();
      if (notifications.some((item) => !item.isRead)) {
        await reloadCurrentBingo();
        await syncEarnedBadges();
      }
    };
    const handleFocus = () => void refreshReviewResults();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void refreshReviewResults();
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [authStatus, currentBingo.type, sessionId]);

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
    const params = new URLSearchParams({
      period: rankingPeriod,
      scope: rankingScope,
    });
    if (rankingScope === "REGION" && rankingRegionCode) {
      params.set("regionCode", rankingRegionCode);
    }
    void apiFetch(`/rankings?${params}`)
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
  }, [activeTab, rankingPeriod, rankingRegionCode, rankingScope, nickname]);

  useEffect(() => {
    if (
      authStatus !== "authenticated" ||
      (activeTab !== "catalog" &&
        activeTab !== "home" &&
        activeTab !== "regions" &&
        activeTab !== "ranking")
    )
      return;
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
            regionCode: null,
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
  }, [activeTab, authStatus, completeCount, points, sessionId]);

  const activeRankingRegions = [
    ...new Map(
      bingoCatalog
        .filter(
          (item) =>
            item.type === "REGION" &&
            item.state === "IN_PROGRESS" &&
            item.regionCode,
        )
        .map((item) => [item.regionCode!, item]),
    ).values(),
  ];

  useEffect(() => {
    if (rankingScope !== "REGION") return;
    if (
      rankingRegionCode &&
      activeRankingRegions.some((region) => region.regionCode === rankingRegionCode)
    ) {
      return;
    }
    setRankingRegionCode(activeRankingRegions[0]?.regionCode ?? "");
  }, [bingoCatalog, rankingRegionCode, rankingScope]);

  useEffect(() => {
    if (activeTab !== "regions" || regionDirectory.length > 0) return;
    setRegionDirectoryLoading(true);
    void fetch("/maps/korea-sigungu.meta.json")
      .then(async (response) => {
        if (!response.ok) throw new Error("Region directory unavailable");
        const payload = (await response.json()) as {
          regions: RegionDirectoryItem[];
        };
        setRegionDirectory(payload.regions);
      })
      .catch(() =>
        setMessage("지역 목록을 불러오지 못했어요. 잠시 후 다시 시도해주세요."),
      )
      .finally(() => setRegionDirectoryLoading(false));
  }, [activeTab, regionDirectory.length]);

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
    if (activeTab !== "exploration" && activeTab !== "my") return;
    setExplorationMemoryLoading(true);
    void Promise.all([
      fetch("/api/exploration/regions", { credentials: "include" }).then(
        async (response) => {
          if (!response.ok) return [];
          const payload = (await response.json()) as {
            items?: ExplorationMemory[];
          };
          return payload.items ?? [];
        },
      ),
      apiFetch("/bingos").then(async (response) => {
        if (!response.ok) return [];
        const payload = (await response.json()) as {
          items: BingoCatalogItem[];
        };
        const regions = payload.items.filter((item) => item.type === "REGION");
        return Promise.all(
          regions.map(async (region) => {
            const regionCode =
              region.regionName?.includes("안성")
                ? "31220"
                : region.regionCode;
            if (!regionCode) return null;
            let board: DailySession | null = null;
            if (region.sessionId) {
              const boardResponse = await apiFetch(
                `/bingos/sessions/${region.sessionId}`,
              );
              if (boardResponse.ok) board = (await boardResponse.json()) as DailySession;
            }
            return {
              regionCode,
              regionName: region.regionName ?? "여행지",
              provinceName: provinceNameFor(regionCode),
              lineCount: board?.completedLineKeys.length ?? 0,
              missionTitles:
                board?.cells.map((cell) => cell.mission.title) ?? [],
            };
          }),
        );
      }),
    ])
      .then(([memories, progressItems]) => {
        const memoryByCode = new Map(
          memories.map((memory) => [memory.regionCode, memory]),
        );
        const records = progressItems
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
          .map((progress) => {
            const memory = memoryByCode.get(progress.regionCode);
            return {
              regionCode: progress.regionCode,
              regionName: progress.regionName,
              provinceName: progress.provinceName,
              missionTitles: progress.missionTitles,
              lineCount: progress.lineCount,
              unlocked: progress.lineCount >= 3,
              photoUrl: progress.lineCount >= 3 ? (memory?.photoUrl ?? null) : null,
              selectedAt: memory?.selectedAt ?? null,
            } satisfies ExplorationRecord;
          });
        setExplorationRecords(records);
        const selected =
          records.find((record) => record.regionCode === selectedMapRegion.code) ??
          records[0];
        if (selected) {
          setExplorationMemory(selected);
          setAnseongMissionTitles(selected.missionTitles);
        }
      })
      .catch(() => undefined)
      .finally(() => setExplorationMemoryLoading(false));
  }, [activeTab]);

  useEffect(() => {
    const selected = explorationRecords.find(
      (record) => record.regionCode === selectedMapRegion.code,
    );
    if (selected) {
      setExplorationMemory(selected);
      setAnseongMissionTitles(selected.missionTitles);
      return;
    }
    setExplorationMemory({
      regionCode: selectedMapRegion.code,
      lineCount: 0,
      unlocked: false,
      photoUrl: null,
      selectedAt: null,
    });
    setAnseongMissionTitles([]);
  }, [explorationRecords, selectedMapRegion.code]);

  useEffect(() => {
    if (activeTab !== "exploration" || !explorationMemory.unlocked) return;
    setMemoryPhotosLoading(true);
    void fetch(`/api/exploration/regions/${explorationMemory.regionCode}/photos`, {
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Memory photos unavailable");
        const payload = (await response.json()) as { items: MemoryPhoto[] };
        setMemoryPhotos(
          anseongMissionTitles.length
            ? payload.items.filter((photo) =>
                anseongMissionTitles.includes(photo.missionTitle),
              )
            : payload.items,
        );
      })
      .catch(() => setMemoryPhotos([]))
      .finally(() => setMemoryPhotosLoading(false));
  }, [
    activeTab,
    explorationMemory.regionCode,
    explorationMemory.unlocked,
    anseongMissionTitles,
  ]);

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
  }, [
    activeTab,
    explorationMapSvg,
    selectedMapRegion.code,
  ]);

  const saveRepresentativePhoto = async (photo: File | MemoryPhoto) => {
    if (explorationMemory.lineCount < 3) {
      setMessage(`${selectedMapRegion.name} 지역 빙고 세 줄을 먼저 완성해주세요.`);
      return;
    }
    setExplorationMemorySaving(true);
    setMessage(null);
    try {
      const response = photo instanceof File
        ? await fetch(`/api/exploration/regions/${explorationMemory.regionCode}`, {
            method: "POST",
            credentials: "include",
            body: (() => {
              const form = new FormData();
              form.set("photo", photo);
              return form;
            })(),
          })
        : await fetch(`/api/exploration/regions/${explorationMemory.regionCode}`, {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              photoId: photo.id,
            }),
          });
      if (!response.ok) throw new Error("Representative photo save failed");
      const saved = (await response.json()) as ExplorationMemory;
      setExplorationMemory(saved);
      setExplorationRecords((records) =>
        records.map((record) =>
          record.regionCode === saved.regionCode ? { ...record, ...saved } : record,
        ),
      );
      setMemoryPhotoPickerOpen(false);
      setMessage(`${selectedMapRegion.name} 대표 사진을 탐험 지도에 채웠어요.`);
    } catch {
      setMessage("대표 사진을 저장하지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setExplorationMemorySaving(false);
    }
  };

  const explorationMapWithPhoto = addRepresentativePhotoPatterns(
    explorationMapSvg,
    explorationRecords.filter((record) => record.photoUrl),
  );
  const selectedRegionRecord = explorationRecords.find(
    (record) => record.regionCode === selectedMapRegion.code,
  );
  const travelRecordsByYear = explorationRecords
    .filter((record) => record.photoUrl && record.selectedAt)
    .reduce<Record<string, ExplorationRecord[]>>((groups, record) => {
      const year = String(new Date(record.selectedAt!).getFullYear());
      (groups[year] ??= []).push(record);
      return groups;
    }, {});
  const availableRegionRecommendations = regionRecommendations
    .flatMap((region) => {
      const bingo = bingoCatalog.find(
        (item) =>
          item.type === "REGION" &&
          !item.sessionId &&
          regionNamesMatch(region.name, item.regionName),
      );
      return bingo ? [{ region, bingo }] : [];
    })
    .slice(0, 3);
  const normalizedRegionSearch = regionSearch.trim().toLocaleLowerCase("ko");
  const regionDirectoryResults = regionDirectory
    .filter((region) => {
      const fullName =
        region.regionType === "METROPOLITAN" || region.name === region.province
          ? region.name
          : `${region.province} ${region.name}`;
      const isInProgress = bingoCatalog.some(
        (item) =>
          item.type === "REGION" &&
          item.state === "IN_PROGRESS" &&
          regionNamesMatch(fullName, item.regionName),
      );
      if (isInProgress) return false;
      if (!normalizedRegionSearch) return true;
      const searchTarget = `${fullName} ${region.name} ${region.province}`;
      return matchesRegionSearch(searchTarget, normalizedRegionSearch);
    })
    .map((region) => {
      const fullName =
        region.regionType === "METROPOLITAN" || region.name === region.province
          ? region.name
          : `${region.province} ${region.name}`;
      const bingo = bingoCatalog.find(
        (item) =>
          item.type === "REGION" &&
          item.state === "AVAILABLE" &&
          !item.sessionId &&
          regionNamesMatch(fullName, item.regionName),
      );
      return { region, fullName, bingo };
    })
    .sort((a, b) => Number(Boolean(b.bingo)) - Number(Boolean(a.bingo)));

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
      const query = new URLSearchParams({ limit: "10" });
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

  const clearAuthenticatedState = () => {
    setMessage(null);
    resetTracking();
    setAccount(null);
    setSessionId(null);
    setSelected(null);
    setActiveTab("home");
    setAuthStatus("unauthenticated");
    setProfileNickname("");
    setCurrentPassword("");
    setNewPassword("");
    setNewPasswordConfirm("");
    setWithdrawPassword("");
    setSettingsStatus(null);
  };

  const logout = async () => {
    if (logoutPending) return;
    setLogoutPending(true);
    try {
      const response = await apiFetch("/auth/logout", { method: "POST" });
      if (!response.ok && response.status !== 401) {
        throw new Error("로그아웃을 완료하지 못했어요.");
      }
      clearAuthenticatedState();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? `${error.message} 네트워크 연결을 확인하고 다시 시도해주세요.`
          : "로그아웃을 완료하지 못했어요. 잠시 후 다시 시도해주세요.",
      );
    } finally {
      setLogoutPending(false);
    }
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
    qrScannerControls.current?.stop();
    qrScannerControls.current = null;
    setQrScanning(false);
    setQrToken("");
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    setPhotoStage("DETAIL");
    setPhotoReviewState("NONE");
    setPhotoVerificationId(null);
    setTextRecord("");
    setSelected(null);
  };

  const submitQrMission = async (scannedToken = qrToken) => {
    if (!selected || selected.kind !== "QR_SCAN" || selected.done) return;
    const token = scannedToken.trim();
    if (!token) {
      setMessage("QR을 스캔하거나 인증 코드를 입력해주세요.");
      return;
    }
    qrScannerControls.current?.stop();
    qrScannerControls.current = null;
    setQrScanning(false);
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
    setMessage(null);
    try {
      const response = await apiFetch(
        `/daily-sessions/${sessionId}/cells/${selected.id}/verify`,
        {
          method: "POST",
          headers: {
            "idempotency-key": `web-qr-${crypto.randomUUID()}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ type: "QR", token }),
        },
      );
      if (!response.ok) throw new Error("QR verification request failed");
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
      setQrToken("");
      await reloadCurrentBingo();
      await syncEarnedBadges();
    } catch {
      setMessage("QR 인증 서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  const startQrScanner = async () => {
    if (!qrVideo.current) return;
    qrScannerControls.current?.stop();
    setQrScanning(true);
    setMessage(null);
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader(undefined, {
        delayBetweenScanAttempts: 250,
      });
      qrScannerControls.current = await reader.decodeFromVideoDevice(
        undefined,
        qrVideo.current,
        (result, _error, controls) => {
          if (!result) return;
          const token = result.getText();
          controls.stop();
          qrScannerControls.current = null;
          setQrScanning(false);
          setQrToken(token);
          void submitQrMission(token);
        },
      );
    } catch {
      qrScannerControls.current = null;
      setQrScanning(false);
      setMessage(
        "카메라를 열 수 없어요. 아래 인증 코드를 직접 입력해주세요.",
      );
    }
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
      await syncEarnedBadges();
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
      await syncEarnedBadges();
    } catch {
      setMessage("GPS 기록을 서버에 전송하지 못했어요. 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  const verifyPhoto = async (file?: File) => {
    if (!selected || !file) return;
    setMessage(null);
    setPhotoReviewState("NONE");
    setPhotoVerificationId(null);
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
          verificationId?: string;
        };
        if (!response.ok || verdict.decision !== "APPROVED") {
          setPhotoStage("DETAIL");
          setPhotoVerificationId(verdict.verificationId ?? null);
          setPhotoReviewState(
            verdict.decision === "NEEDS_REVIEW"
              ? "PENDING"
              : verdict.decision === "REJECTED" && verdict.verificationId
                ? "AVAILABLE"
                : "NONE",
          );
          setMessage(
            verdict.decision === "NEEDS_REVIEW"
              ? "사진이 관리자 검수 대기 목록에 접수됐어요. 결과는 검수 후 반영됩니다."
              : verdict.retryGuide ||
                  verdict.message ||
                  friendlyError(verdict.code ?? "PHOTO_AI_REJECTED"),
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
      if (
        !response.ok ||
        result.verificationStatus === "REJECTED" ||
        result.verificationStatus === "NEEDS_REVIEW"
      ) {
        setPhotoStage("DETAIL");
        const pending = result.verificationStatus === "NEEDS_REVIEW";
        setPhotoReviewState(
          pending
            ? "PENDING"
            : result.reasonCode === "PHOTO_AI_REJECTED"
              ? "AVAILABLE"
              : "NONE",
        );
        setMessage(
          pending
            ? "사진이 관리자 검수 대기 목록에 접수됐어요. 결과는 검수 후 반영됩니다."
            : friendlyError(result.reasonCode ?? result.code),
        );
        return;
      }
      approvePhotoMission(result);
      void syncEarnedBadges();
    } catch {
      setPhotoStage("DETAIL");
      setMessage(
        "사진 인증 서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요.",
      );
    }
  };

  const requestPhotoReview = async () => {
    if (!selected || photoReviewState !== "AVAILABLE") return;
    setPhotoReviewState("REQUESTING");
    setMessage(null);
    try {
      const response =
        demoMode || !sessionId
          ? await fetch("/api/photo-review-request", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ verificationId: photoVerificationId }),
            })
          : await apiFetch(
              `/daily-sessions/${sessionId}/cells/${selected.id}/photo-review-request`,
              { method: "POST" },
            );
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setPhotoReviewState("AVAILABLE");
        setMessage(result.message ?? "관리자 검수 요청을 접수하지 못했어요.");
        return;
      }
      setPhotoReviewState("PENDING");
      setItems((current) =>
        current.map((item) =>
          item.id === selected.id ? { ...item, reviewPending: true } : item,
        ),
      );
      setSelected((current) =>
        current ? { ...current, reviewPending: true } : current,
      );
      setMessage(
        "관리자 검수 요청이 접수됐어요. 승인되면 포인트와 빙고 진행도에 반영됩니다.",
      );
    } catch {
      setPhotoReviewState("AVAILABLE");
      setMessage(
        "관리자 검수 요청을 접수하지 못했어요. 잠시 후 다시 시도해주세요.",
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
      await syncEarnedBadges();
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
  const qrMission = selected?.kind === "QR_SCAN";
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
              className={`${item.done ? "done" : ""} ${item.reviewPending ? "review-pending" : ""} ${item.title === "Lucky!" || item.title === "FREE" ? "free" : ""}`}
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
                setPhotoReviewState(item.reviewPending ? "PENDING" : "NONE");
                setPhotoVerificationId(null);
                if (item.reviewPending) {
                  setMessage(
                    "관리자가 사진을 확인하고 있어요. 결과는 검수 후 반영됩니다.",
                  );
                }
              }}
            >
              <span className={`mission-icon ${item.kind.toLowerCase()}`}>
                {item.done ? "✓" : item.reviewPending ? "…" : icon[item.kind]}
              </span>
              <b>{item.title}</b>
              <small>
                {item.reviewPending
                  ? "검수 중"
                  : item.points
                    ? `+${item.points}P`
                    : "BONUS"}
              </small>
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
              className="notice-bell"
              onClick={() => setAnnouncementsOpen(true)}
            >
              ♧{(announcements.some((item) => !item.isRead) || badgeNotifications.some((item) => !item.isRead) || photoReviewNotifications.some((item) => !item.isRead) || rankingRewards.some((item) => !item.isRead) || friends.some((item) => (item.status === "PENDING" && item.direction === "RECEIVED") || item.isUnread)) && <i>{Math.min(99, announcements.filter((item) => !item.isRead).length + badgeNotifications.filter((item) => !item.isRead).length + photoReviewNotifications.filter((item) => !item.isRead).length + rankingRewards.filter((item) => !item.isRead).length + friends.filter((item) => (item.status === "PENDING" && item.direction === "RECEIVED") || item.isUnread).length)}</i>}
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

          {announcements.length > 0 && (
            <section className="home-announcements">
              <div className="home-section-title"><h2>공지사항</h2><button type="button" onClick={() => setAnnouncementsOpen(true)}>더보기 ›</button></div>
              {announcements.slice(0, 2).map((item) => (
                <button type="button" key={item.id} onClick={() => openAnnouncement(item)}>
                  <span>{item.isImportant ? "중요" : "안내"}</span>
                  <b>{item.title}</b>
                  {!item.isRead && <i>새 소식</i>}
                </button>
              ))}
            </section>
          )}

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
            <button type="button" onClick={() => setActiveTab("regions")}>
              더보기 ›
            </button>
          </div>
          <div className="region-cards">
            {availableRegionRecommendations.map(({ region, bingo }, index) => (
              <button
                type="button"
                key={region.id}
                onClick={() => setPendingRegionChallenge({ region, bingo })}
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
            {(regionRecommendationsLoading || bingoCatalogLoading) && (
              <p className="region-state">활성 지역의 관광지를 찾고 있어요…</p>
            )}
            {!regionRecommendationsLoading &&
              !bingoCatalogLoading &&
              availableRegionRecommendations.length === 0 && (
                <p className="region-state">
                  지금 새로 도전할 수 있는 추천 지역이 없어요.
                </p>
              )}
          </div>
          {pendingRegionChallenge && (
            <div
              className="region-challenge-backdrop"
              role="presentation"
              onClick={() => setPendingRegionChallenge(null)}
            >
              <section
                className="region-challenge-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="region-challenge-title"
                onClick={(event) => event.stopPropagation()}
              >
                <span className="region-challenge-stamp" aria-hidden="true">
                  {pendingRegionChallenge.region.name.slice(-2, -1)}
                </span>
                <small>NEW REGION BINGO</small>
                <h2 id="region-challenge-title">
                  {pendingRegionChallenge.region.name}에<br />
                  도전할까요?
                </h2>
                <p>
                  확인하면 나만의 지역 빙고판을 만들고 바로 첫 미션을 시작할
                  수 있어요.
                </p>
                <div>
                  <button
                    type="button"
                    onClick={() => setPendingRegionChallenge(null)}
                  >
                    다음에
                  </button>
                  <button
                    type="button"
                    className="primary"
                    disabled={bingoCatalogLoading}
                    onClick={() => {
                      const challenge = pendingRegionChallenge;
                      setPendingRegionChallenge(null);
                      if (challenge) void openCatalogBingo(challenge.bingo);
                    }}
                  >
                    {bingoCatalogLoading ? "빙고판 만드는 중…" : "도전하기"}
                  </button>
                </div>
              </section>
            </div>
          )}

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
      {activeTab === "regions" && (
        <section className="region-directory-screen">
          <header className="region-directory-header">
            <button
              type="button"
              aria-label="홈으로 돌아가기"
              onClick={() => setActiveTab("home")}
            >
              ←
            </button>
            <div>
              <small>REGION BINGO</small>
              <h1>도전할 지역 찾기</h1>
            </div>
          </header>
          <label className="region-search-box">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={regionSearch}
              onChange={(event) => setRegionSearch(event.target.value)}
              placeholder="지역명을 입력해보세요"
              autoComplete="off"
              aria-label="지역명 검색"
            />
            {regionSearch && (
              <button
                type="button"
                aria-label="검색어 지우기"
                onClick={() => setRegionSearch("")}
              >
                ×
              </button>
            )}
          </label>
          <div className="region-directory-summary">
            <b>{regionSearch ? `‘${regionSearch}’ 검색 결과` : "전체 지역"}</b>
            <span>{regionDirectoryResults.length}곳</span>
          </div>
          {regionDirectoryLoading || bingoCatalogLoading ? (
            <p className="region-directory-state">지역 목록을 펼치고 있어요…</p>
          ) : regionDirectoryResults.length === 0 ? (
            <p className="region-directory-state">
              입력한 이름과 일치하는 지역이 없어요.
            </p>
          ) : (
            <div className="region-directory-list" role="list">
              {regionDirectoryResults.map(({ region, fullName, bingo }) => (
                <button
                  type="button"
                  role="listitem"
                  key={region.code}
                  className={bingo ? "available" : "preparing"}
                  disabled={!bingo}
                  onClick={() => {
                    if (!bingo) return;
                    setPendingRegionChallenge({
                      bingo,
                      region: {
                        id: region.code,
                        name: fullName,
                        distanceKm: null,
                        attraction: null,
                      },
                    });
                  }}
                >
                  <span className="region-directory-pin" aria-hidden="true">
                    {bingo ? "⌖" : "·"}
                  </span>
                  <span>
                    <strong>{fullName}</strong>
                    <small>
                      {bingo ? "지금 지역 빙고에 도전할 수 있어요" : "지역 빙고 준비 중"}
                    </small>
                  </span>
                  <em>{bingo ? "도전하기 ›" : "준비 중"}</em>
                </button>
              ))}
            </div>
          )}
          {pendingRegionChallenge && (
            <div
              className="region-challenge-backdrop"
              role="presentation"
              onClick={() => setPendingRegionChallenge(null)}
            >
              <section
                className="region-challenge-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="directory-region-challenge-title"
                onClick={(event) => event.stopPropagation()}
              >
                <span className="region-challenge-stamp" aria-hidden="true">
                  {pendingRegionChallenge.region.name.replace(/\s/g, "").slice(-2, -1)}
                </span>
                <small>NEW REGION BINGO</small>
                <h2 id="directory-region-challenge-title">
                  {pendingRegionChallenge.region.name}에<br />
                  도전할까요?
                </h2>
                <p>
                  확인하면 나만의 지역 빙고판을 만들고 바로 첫 미션을 시작할 수
                  있어요.
                </p>
                <div>
                  <button type="button" onClick={() => setPendingRegionChallenge(null)}>
                    다음에
                  </button>
                  <button
                    type="button"
                    className="primary"
                    disabled={bingoCatalogLoading}
                    onClick={() => {
                      const challenge = pendingRegionChallenge;
                      setPendingRegionChallenge(null);
                      if (challenge) void openCatalogBingo(challenge.bingo);
                    }}
                  >
                    {bingoCatalogLoading ? "빙고판 만드는 중…" : "도전하기"}
                  </button>
                </div>
              </section>
            </div>
          )}
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
            <div className="exploration-header-side">
              <div className="exploration-summary">
                {explorationRecords.some((record) => !record.unlocked) && (
                  <div>
                    <b>
                      {explorationRecords
                        .filter((record) => !record.unlocked)
                        .slice(0, 2)
                        .map((record) => record.regionName)
                        .join(" · ")}
                    </b>
                    <span>도전 중</span>
                  </div>
                )}
                <div>
                  <b>
                    {explorationRecords.filter((record) => record.photoUrl).length}
                  </b>
                  <span>탐험 완료 지역</span>
                </div>
              </div>
            </div>
          </header>

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
              aria-label="대한민국 광역·시·군 탐험 지도"
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
                    dangerouslySetInnerHTML={{
                      __html: explorationMapWithPhoto,
                    }}
                  />
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
                  setMapTransform({ scale: 1.06, x: -8, y: -18 })
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
                {selectedRegionRecord
                  ? explorationMemory.photoUrl
                    ? `대표 사진으로 ${selectedMapRegion.name}의 추억을 채웠어요.`
                    : explorationMemory.unlocked
                      ? "3 Bingo 달성! 대표 사진을 선택할 수 있어요."
                      : `${selectedMapRegion.name} 여행 빙고에 도전 중이에요.`
                  : "아직 이 지역의 여행 기록이 없어요."}
              </p>
            </div>
            <span
              className={
                selectedRegionRecord
                  ? "region-status active"
                  : "region-status"
              }
            >
              {selectedRegionRecord
                ? explorationMemory.photoUrl
                  ? "사진 완료"
                  : explorationMemory.unlocked
                    ? "해금"
                    : "도전 중"
                : "미발견"}
            </span>
            {selectedRegionRecord &&
              explorationMemory.photoUrl && (
                <button
                  type="button"
                  className="memory-detail-button"
                  onClick={() => setMemoryDetailOpen(true)}
                >
                  추억 보기
                </button>
              )}
          </article>

          {selectedRegionRecord ? (
            <div
              className={`region-progress-note ${
                explorationMemory.unlocked ? "unlocked" : ""
              }`}
            >
              <span aria-hidden="true">
                {explorationMemory.photoUrl ? "✓" : "✎"}
              </span>
              <div className="region-memory-content">
                <b>
                  {explorationMemory.photoUrl
                    ? `${selectedMapRegion.name} 대표 사진을 채웠어요`
                    : explorationMemory.unlocked
                      ? "대표 사진 선택 가능"
                      : "사진 해금까지 3 Bingo"}
                </b>
                <p>
                  {explorationMemory.photoUrl
                    ? `지도 속 ${selectedMapRegion.name} 영역을 선택한 사진으로 표시하고 있어요.`
                    : explorationMemory.unlocked
                      ? "여행 사진을 고르거나 샘플 사진으로 지도 표시를 확인해보세요."
                      : `${selectedMapRegion.name} 지역 빙고에서 세 줄을 완성하면 지도에 대표 사진을 남길 수 있어요.`}
                </p>
                {explorationMemory.unlocked && (
                  <div className="memory-photo-actions">
                    <input
                      ref={representativePhotoInput}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(event) => {
                        const photo = event.currentTarget.files?.[0];
                        if (photo) void saveRepresentativePhoto(photo);
                        event.currentTarget.value = "";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setMemoryPhotoPickerOpen(true)}
                      disabled={explorationMemorySaving}
                    >
                      {explorationMemory.photoUrl
                        ? "인증 사진에서 바꾸기"
                        : "인증 사진에서 선택"}
                    </button>
                    <button
                      type="button"
                      className="sample"
                      onClick={() => representativePhotoInput.current?.click()}
                      disabled={explorationMemorySaving}
                    >
                      {explorationMemorySaving
                        ? "사진 저장 중…"
                        : "새 사진 선택"}
                    </button>
                  </div>
                )}
              </div>
              <strong>{Math.min(3, explorationMemory.lineCount)} / 3</strong>
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
          {memoryPhotoPickerOpen && (
            <div
              className="memory-photo-picker-backdrop"
              role="presentation"
              onClick={() => setMemoryPhotoPickerOpen(false)}
            >
              <section
                className="memory-photo-picker"
                role="dialog"
                aria-modal="true"
                aria-labelledby="memory-photo-picker-title"
                onClick={(event) => event.stopPropagation()}
              >
                <header>
                  <div>
                    <small>{selectedMapRegion.name.toUpperCase()} MEMORY</small>
                    <h2 id="memory-photo-picker-title">대표 사진 선택</h2>
                    <p>{selectedMapRegion.name} 지역 미션에서 인증한 사진을 골라주세요.</p>
                  </div>
                  <button
                    type="button"
                    aria-label="대표 사진 선택 닫기"
                    onClick={() => setMemoryPhotoPickerOpen(false)}
                  >
                    ×
                  </button>
                </header>
                {memoryPhotosLoading ? (
                  <p className="memory-photo-empty">사진을 불러오고 있어요…</p>
                ) : memoryPhotos.length ? (
                  <div className="memory-photo-grid">
                    {memoryPhotos.map((photo) => (
                      <button
                        type="button"
                        key={photo.id}
                        onClick={() => void saveRepresentativePhoto(photo)}
                        disabled={explorationMemorySaving}
                      >
                        <img src={photo.imageUrl} alt="" />
                        <span>{photo.missionTitle}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="memory-photo-empty">
                    <b>선택할 수 있는 인증 사진이 아직 없어요.</b>
                    <p>
                      {selectedMapRegion.name}의 사진 미션을 완료하면 이곳에
                      표시돼요.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setMemoryPhotoPickerOpen(false);
                        representativePhotoInput.current?.click();
                      }}
                    >
                      새 사진 선택하기
                    </button>
                  </div>
                )}
              </section>
            </div>
          )}
          {memoryDetailOpen && explorationMemory.photoUrl && (
            <div
              className="memory-detail-backdrop"
              role="presentation"
              onClick={() => setMemoryDetailOpen(false)}
            >
              <section
                className="memory-detail-sheet"
                role="dialog"
                aria-modal="true"
                aria-labelledby="memory-detail-title"
                onClick={(event) => event.stopPropagation()}
              >
                <header>
                  <div>
                    <small>{selectedMapRegion.name.toUpperCase()} MEMORY</small>
                    <h2 id="memory-detail-title">
                      {selectedMapRegion.name}에서 남긴 한 장
                    </h2>
                  </div>
                  <button
                    type="button"
                    aria-label="지역 추억 닫기"
                    onClick={() => setMemoryDetailOpen(false)}
                  >
                    ×
                  </button>
                </header>
                <figure>
                  <img
                    src={explorationMemory.photoUrl}
                    alt={`${selectedMapRegion.name} 대표 추억`}
                  />
                  <figcaption>
                    <span>
                      {selectedMapRegion.province} {selectedMapRegion.name}
                    </span>
                    <strong>3 Bingo로 완성한 탐험 기록</strong>
                    <small>
                      {explorationMemory.selectedAt
                        ? new Intl.DateTimeFormat("ko-KR", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          }).format(new Date(explorationMemory.selectedAt))
                        : "대표 사진을 선택한 날"}
                    </small>
                  </figcaption>
                </figure>
                <section className="memory-gallery" aria-label="인증 사진 모음">
                  <div className="memory-gallery-heading">
                    <div>
                      <small>MISSION PHOTOS</small>
                      <h3>여행 중 남긴 사진</h3>
                    </div>
                    <b>{memoryPhotos.length}장</b>
                  </div>
                  {memoryPhotosLoading ? (
                    <p className="memory-gallery-empty">
                      인증 사진을 모으고 있어요…
                    </p>
                  ) : memoryPhotos.length ? (
                    <div className="memory-gallery-grid">
                      {memoryPhotos.map((photo) => (
                        <button
                          type="button"
                          key={photo.id}
                          onClick={() => void saveRepresentativePhoto(photo)}
                          disabled={explorationMemorySaving}
                          title="대표 사진으로 지정"
                        >
                          <img
                            src={photo.imageUrl}
                            alt={`${photo.missionTitle} 인증 사진`}
                          />
                          <span>{photo.missionTitle}</span>
                          <small>
                            {new Intl.DateTimeFormat("ko-KR", {
                              month: "short",
                              day: "numeric",
                            }).format(new Date(photo.submittedAt))}
                          </small>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="memory-gallery-empty">
                      이 지역에서 완료한 사진 미션이 아직 없어요.
                    </p>
                  )}
                  {memoryPhotos.length > 0 && (
                    <p className="memory-gallery-tip">
                      사진을 누르면 지도 대표 사진으로 바뀌어요.
                    </p>
                  )}
                </section>
                <div className="memory-detail-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setMemoryDetailOpen(false);
                      setMemoryPhotoPickerOpen(true);
                    }}
                  >
                    대표 사진 바꾸기
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setMemoryDetailOpen(false)}
                  >
                    지도에 돌아가기
                  </button>
                </div>
              </section>
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
                ["FRIEND", "친구"],
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
          </div>
          {rankingScope === "REGION" && activeRankingRegions.length > 0 && (
            <label className="ranking-region-select">
              <span>도전 중인 지역</span>
              <select
                value={rankingRegionCode}
                onChange={(event) => setRankingRegionCode(event.target.value)}
              >
                {activeRankingRegions.map((region) => (
                  <option key={region.regionCode} value={region.regionCode!}>
                    {region.regionName ?? region.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          {rankingScope === "REGION" &&
            !bingoCatalogLoading &&
            activeRankingRegions.length === 0 && (
              <p className="ranking-scope-notice">
                현재 도전 중인 지역 빙고가 없어요.
              </p>
            )}
          {rankingScope === "FRIEND" && (
            <button className="ranking-scope-notice friend-manage-button" type="button" onClick={() => { setFriendsOpen(true); void loadFriends(); }}>
              친구 관리 · 요청 확인
            </button>
          )}
          <p className="ranking-timer">
            {ranking.endsAt
              ? `이번 랭킹 종료까지 ${remainingTime(ranking.endsAt, clock)}`
              : rankingPeriod === "TOTAL"
                ? "서비스 시작 이후 누적 포인트 순위"
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
            {!rankingLoading &&
              ranking.available !== false &&
              ranking.entries.length === 0 && (
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
            {myView !== "main" && (
              <button
                type="button"
                className="my-back-button"
                aria-label="마이 화면으로 돌아가기"
                onClick={() => setMyView("main")}
              >
                ←
              </button>
            )}
            <h1>{myView === "travel-note" ? "여행 노트" : myView === "badges" ? "획득 배지" : myView === "rewards" ? "랭킹 보상 이력" : myView === "settings" ? "설정" : "마이"}</h1>
          </header>
          {myView === "travel-note" ? (
            <div className="travel-note-view">
              <div className="travel-note-intro">
                <small>MY TRAVEL NOTE</small>
                <h2>빙고로 완성한 여행 이야기</h2>
                <p>탐험 완료 지역의 대표 사진이 한 장씩 기록돼요.</p>
              </div>
              {Object.keys(travelRecordsByYear).length ? (
                Object.entries(travelRecordsByYear)
                  .sort(([left], [right]) => Number(right) - Number(left))
                  .map(([year, records]) => (
                    <section className="travel-note-year-group" key={year}>
                      <div className="travel-note-year">
                        <span>{year}</span>
                        <i aria-hidden="true" />
                      </div>
                      <div className="travel-note-list">
                        {records
                          .sort(
                            (left, right) =>
                              new Date(right.selectedAt!).getTime() -
                              new Date(left.selectedAt!).getTime(),
                          )
                          .map((record) => (
                            <button
                              type="button"
                              className="travel-note-card"
                              key={record.regionCode}
                              onClick={() => {
                                setSelectedMapRegion({
                                  code: record.regionCode,
                                  name: record.regionName,
                                  province: record.provinceName,
                                });
                                setExplorationMemory(record);
                                setMemoryDetailOpen(true);
                                setActiveTab("exploration");
                              }}
                            >
                              <img
                                src={record.photoUrl!}
                                alt={`${record.regionName} 여행 기록`}
                              />
                              <span>
                                <small>{record.provinceName}</small>
                                <strong>{record.regionName}</strong>
                                <em>3 Bingo 탐험 완료 · 추억 보기 ›</em>
                              </span>
                            </button>
                          ))}
                      </div>
                    </section>
                  ))
              ) : (
                <div className="travel-note-empty">
                  <span aria-hidden="true">▧</span>
                  <b>첫 여행 기록을 기다리고 있어요</b>
                  <p>지역 빙고에서 3 Bingo를 완성하고 대표 사진을 골라보세요.</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("exploration")}
                  >
                    탐험 지도 보기
                  </button>
                </div>
              )}
            </div>
          ) : myView === "badges" ? (
            <div className="badge-view">
              <section className="badge-intro">
                <small>MY WALKING BADGES</small>
                <h2>걸으며 모은 작은 성취</h2>
                <p>미션과 빙고를 완성할수록 새로운 배지가 열려요.</p>
              </section>
              {badgeSummary ? (
                <>
                  <div className="badge-summary">
                    <div><b>{badgeSummary.badges.filter((badge) => badge.earned).length}</b><span>획득</span></div>
                    <div><b>{badgeSummary.badges.length}</b><span>전체 배지</span></div>
                    <div><b>{badgeSummary.totals.completedMissions}</b><span>누적 미션</span></div>
                  </div>
                  <div className="badge-grid">
                    {badgeSummary.badges.map((badge) => (
                      <article className={badge.earned ? "earned" : "locked"} key={badge.id}>
                        <span aria-hidden="true">{badge.earned ? (badge.imageUrl ? <img src={badge.imageUrl} alt="" /> : badge.icon) : "?"}</span>
                        <div>
                          <small>{badge.earned ? "획득 완료" : `${badge.current} / ${badge.target}`}</small>
                          <h3>{badge.title}</h3>
                          <p>{badge.description}</p>
                          <i><b style={{ width: `${badge.progress}%` }} /></i>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <p className="badge-loading">배지 기록을 불러오고 있어요.</p>
              )}
            </div>
          ) : myView === "rewards" ? (
            <div className="ranking-reward-view">
              <section className="ranking-reward-intro">
                <small>RANKING REWARDS</small>
                <h2>걷고 도전해서 받은 보상</h2>
                <p>전체 랭킹 상위 3위에게 지급된 포인트를 모아볼 수 있어요.</p>
              </section>
              <div className="ranking-reward-policy">
                <span><b>일간</b> 50 · 30 · 20P</span>
                <span><b>주간</b> 300 · 200 · 100P</span>
                <span><b>월간</b> 1,000 · 700 · 500P</span>
              </div>
              <div className="ranking-reward-list">
                {rankingRewards.length ? rankingRewards.map((reward) => (
                  <article key={reward.id} className={reward.isRead ? "" : "unread"}>
                    <span aria-hidden="true">{reward.rank === 1 ? "🥇" : reward.rank === 2 ? "🥈" : "🥉"}</span>
                    <div>
                      <small>{reward.period === "DAILY" ? "일간" : reward.period === "WEEKLY" ? "주간" : "월간"} 전체 랭킹</small>
                      <h3>{reward.rank}위 보상</h3>
                      <p>{new Date(reward.awardedAt).toLocaleString("ko-KR")}</p>
                    </div>
                    <strong>+{reward.points.toLocaleString()}P</strong>
                  </article>
                )) : <p className="ranking-reward-empty">아직 받은 랭킹 보상이 없어요.<br />매일 새로운 빙고에 도전해보세요.</p>}
              </div>
            </div>
          ) : myView === "settings" ? (
            <div className="settings-view">
              <section className="account-settings-card">
                <small>ACCOUNT PROFILE</small><h2>계정 정보</h2><p>프로필과 로그인 정보를 안전하게 관리해요.</p>
                <label>닉네임<input value={profileNickname} maxLength={40} onChange={(event) => setProfileNickname(event.target.value)} /></label>
                <button type="button" disabled={settingsSaving || !profileNickname.trim()} onClick={() => void saveNickname()}>닉네임 변경</button>
                {account?.email && <>
                  <label>현재 비밀번호<input type="password" value={currentPassword} maxLength={128} autoComplete="current-password" onChange={(event) => setCurrentPassword(event.target.value)} /></label>
                  <label>새 비밀번호<input type="password" value={newPassword} minLength={8} maxLength={128} autoComplete="new-password" placeholder="8자 이상" onChange={(event) => setNewPassword(event.target.value)} /></label>
                  <label>새 비밀번호 확인<input type="password" value={newPasswordConfirm} minLength={8} maxLength={128} autoComplete="new-password" placeholder="한 번 더 입력해주세요" onChange={(event) => setNewPasswordConfirm(event.target.value)} /></label>
                  <button type="button" disabled={settingsSaving || !currentPassword || newPassword.length < 8 || newPasswordConfirm.length < 8} onClick={() => void savePassword()}>비밀번호 변경</button>
                </>}
                {settingsStatus && <p className="settings-status" role="status">{settingsStatus}</p>}
              </section>
              <section className="safety-settings-card"><small>PRIVACY & SAFETY</small><h2>차단한 사용자</h2><p>차단한 사용자는 친구 검색과 랭킹에서 서로 표시되지 않아요.</p></section>
              <div className="blocked-user-list">
                {blockedUsers.length ? blockedUsers.map((block) => <div key={block.id}><span>{block.blocked.nickname.slice(0, 1)}</span><div><b>{block.blocked.nickname}</b><small>{new Date(block.createdAt).toLocaleDateString("ko-KR")} 차단</small></div><button type="button" onClick={() => void unblockUser(block)}>차단 해제</button></div>) : <p className="friend-empty">차단한 사용자가 없어요.</p>}
              </div>
              <p className="settings-note">차단을 해제해도 이전 친구 관계는 자동으로 복구되지 않습니다.</p>
              {account?.email && <section className="withdraw-card"><small>ACCOUNT WITHDRAWAL</small><h2>회원 탈퇴</h2><p>탈퇴하면 모든 기기에서 로그아웃되고 개인정보가 익명화됩니다.</p><label>탈퇴 확인 비밀번호<input type="password" value={withdrawPassword} maxLength={128} autoComplete="current-password" placeholder="현재 비밀번호" onChange={(event) => setWithdrawPassword(event.target.value)} /></label><button type="button" disabled={settingsSaving || !withdrawPassword} onClick={() => void withdrawAccount()}>회원 탈퇴</button></section>}
            </div>
          ) : (
            <>
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
              <b>{(badgeSummary?.totals.points ?? points).toLocaleString()}</b>
              <span>누적 Point</span>
            </div>
            <div>
              <b>{badgeSummary?.totals.completedMissions ?? completeCount}</b>
              <span>완료 미션</span>
            </div>
            <div>
              <b>{badgeSummary?.totals.completedBingos ?? lineKeys.length}</b>
              <span>완성 빙고</span>
            </div>
          </div>
          <div className="my-menu">
            <button type="button" onClick={() => setMyView("travel-note")}>
              <span>▤</span>
              여행 기록
              <b>›</b>
            </button>
            <button
              type="button"
              onClick={() => {
                setFriendsOpen(true);
                void loadFriends();
              }}
            >
              <span>♧</span>
              <span className="my-menu-title">
                친구 관리
                {friends.some(
                  (item) =>
                    item.status === "PENDING" && item.direction === "RECEIVED",
                ) && (
                  <i className="friend-request-badge">
                    {
                      friends.filter(
                        (item) =>
                          item.status === "PENDING" &&
                          item.direction === "RECEIVED",
                      ).length
                    }
                  </i>
                )}
                <small>
                  친구 {friends.filter((item) => item.status === "ACCEPTED").length}명
                </small>
              </span>
              <b>›</b>
            </button>
            <button type="button" onClick={() => void openBadges()}>
              <span>♧</span>
              획득 배지
              <b>›</b>
            </button>
            <button type="button" onClick={() => setMyView("rewards")}>
              <span>♕</span>
              랭킹 보상 이력
              <b>›</b>
            </button>
            <button type="button" onClick={() => void openSettings()}>
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
          <button className="logout-button" type="button" disabled={logoutPending} onClick={() => void logout()}>
            {logoutPending ? "로그아웃 중…" : "로그아웃"}
          </button>
          <div className="my-doodle" aria-hidden="true">
            <span>⌁</span>
            <i>✿</i>
            <b>♧</b>
          </div>
            </>
          )}
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
      {announcementsOpen && (
        <div className="announcement-backdrop" onClick={() => setAnnouncementsOpen(false)}>
          <section className="announcement-sheet" onClick={(event) => event.stopPropagation()}>
            <header><div><small>TRAVEL BINGO NEWS</small><h2>알림</h2></div><button type="button" aria-label="알림 닫기" onClick={() => setAnnouncementsOpen(false)}>×</button></header>
            <div className="announcement-sheet-list">
              {friends.filter((item) => item.status === "PENDING" && item.direction === "RECEIVED").map((item) => (
                <div className="friend-notification" key={`request-${item.id}`}><span>친구 요청</span><div><b>{item.user.nickname}님이 친구 요청을 보냈어요.</b><small>함께 랭킹에 도전해보세요.</small></div><aside><button type="button" onClick={() => void decideFriend(item.id, true)}>수락</button><button type="button" onClick={() => void decideFriend(item.id, false)}>거절</button></aside></div>
              ))}
              {friends.filter((item) => item.status === "ACCEPTED" && item.direction === "SENT" && item.isUnread).map((item) => (
                <button type="button" key={`accepted-${item.id}`} onClick={() => void openAcceptedFriendNotification(item)}><span>친구</span><div><b>{item.user.nickname}님과 친구가 되었어요!</b><small>프로필과 활동 기록 보기</small></div><i>NEW</i></button>
              ))}
              {photoReviewNotifications.map((item) => (
                <button
                  type="button"
                  key={`photo-review-${item.id}`}
                  onClick={() => void openPhotoReviewNotification(item)}
                >
                  <span>{item.decision === "APPROVED" ? "승인" : "반려"}</span>
                  <div>
                    <b>
                      {item.missionTitle} 사진 인증이
                      {item.decision === "APPROVED" ? " 승인됐어요." : " 반려됐어요."}
                    </b>
                    <small>
                      {item.decision === "REJECTED" && item.reason
                        ? item.reason
                        : new Date(item.decidedAt).toLocaleDateString("ko-KR")}
                    </small>
                  </div>
                  {!item.isRead && <i>NEW</i>}
                </button>
              ))}
              {badgeNotifications.map((item) => (
                <button type="button" key={`badge-${item.id}`} onClick={() => void openBadgeNotification(item)}>
                  <span className="badge-notification-icon">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : item.icon}</span>
                  <div><b>새 배지를 획득했어요 · {item.title}</b><small>{new Date(item.earnedAt).toLocaleDateString("ko-KR")}</small></div>
                  {!item.isRead && <i>NEW</i>}
                </button>
              ))}
              {rankingRewards.map((item) => (
                <button type="button" key={`ranking-${item.id}`} onClick={() => void openRankingReward(item)}>
                  <span>{item.rank === 1 ? "1위" : item.rank === 2 ? "2위" : "3위"}</span>
                  <div><b>{item.period === "DAILY" ? "일간" : item.period === "WEEKLY" ? "주간" : "월간"} 랭킹 {item.rank}위 보상 {item.points.toLocaleString()}P</b><small>{new Date(item.awardedAt).toLocaleDateString("ko-KR")}</small></div>
                  {!item.isRead && <i>NEW</i>}
                </button>
              ))}
              {announcements.length ? announcements.map((item) => (
                <button type="button" key={item.id} onClick={() => { setAnnouncementsOpen(false); openAnnouncement(item); }}>
                  <span>{item.isImportant ? "중요" : "안내"}</span>
                  <div><b>{item.title}</b><small>{new Date(item.createdAt).toLocaleDateString("ko-KR")}</small></div>
                  {!item.isRead && <i>NEW</i>}
                </button>
              )) : null}
              {!announcements.length && !badgeNotifications.length && !photoReviewNotifications.length && !rankingRewards.length && !friends.some((item) => (item.status === "PENDING" && item.direction === "RECEIVED") || item.isUnread) && <p>새로운 알림이 없어요.</p>}
            </div>
          </section>
        </div>
      )}
      {selectedAnnouncement && (
        <div className="announcement-backdrop" onClick={closeAnnouncement}>
          <article className="announcement-detail" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="announcement-close" aria-label="공지 닫기" onClick={closeAnnouncement}>×</button>
            <span>{selectedAnnouncement.isImportant ? "IMPORTANT" : "NOTICE"}</span>
            <h2>{selectedAnnouncement.title}</h2>
            <time>{new Date(selectedAnnouncement.createdAt).toLocaleDateString("ko-KR")}</time>
            <p>{selectedAnnouncement.content}</p>
            <button type="button" className="announcement-confirm" onClick={closeAnnouncement}>확인했어요</button>
          </article>
        </div>
      )}
      {friendsOpen && (
        <div className="announcement-backdrop" onClick={() => setFriendsOpen(false)}>
          <section className="friend-sheet" onClick={(event) => event.stopPropagation()}>
            <header><div><small>WALK TOGETHER</small><h2>친구 관리</h2></div><button type="button" onClick={() => setFriendsOpen(false)}>×</button></header>
            <button type="button" className="friend-ranking-link" onClick={openFriendRanking}>친구 랭킹 보러가기 <b>›</b></button>
            <label className="friend-search"><input value={friendQuery} onChange={(event) => void searchFriends(event.target.value)} placeholder="닉네임 또는 이메일 검색" /></label>
            {friendResults.map((user) => <div className="friend-row" key={user.id}><span><b>{user.nickname}</b><small>{user.email}</small></span><button type="button" onClick={() => void requestFriend(user.id)}>친구 요청</button></div>)}
            <h3>받은 요청</h3>
            {friends.filter((item) => item.status === "PENDING" && item.direction === "RECEIVED").map((item) => <div className="friend-row" key={item.id}><span><b>{item.user.nickname}</b><small>{item.user.email}</small></span><div><button type="button" onClick={() => void decideFriend(item.id, true)}>수락</button><button type="button" className="friend-secondary-action" onClick={() => void decideFriend(item.id, false)}>거절</button></div></div>)}
            {!friends.some((item) => item.status === "PENDING" && item.direction === "RECEIVED") && <p className="friend-empty">받은 친구 요청이 없어요.</p>}
            <h3>친구</h3>
            {friends.filter((item) => item.status === "ACCEPTED").map((item) => <div className="friend-row" key={item.id}><button type="button" className="friend-profile-trigger" onClick={() => void openFriendProfile(item.user)}><b>{item.user.nickname}</b><small>활동 프로필 보기</small></button><button type="button" className="friend-secondary-action" onClick={() => void removeFriend(item)}>친구 삭제</button></div>)}
            {!friends.some((item) => item.status === "ACCEPTED") && <p className="friend-empty">아직 등록된 친구가 없어요.</p>}
            <h3>보낸 요청</h3>
            {friends.filter((item) => item.status === "PENDING" && item.direction === "SENT").map((item) => <div className="friend-row" key={item.id}><span><b>{item.user.nickname}</b><small>수락을 기다리고 있어요.</small></span><button type="button" className="friend-secondary-action" onClick={() => void removeFriend(item)}>요청 취소</button></div>)}
            {!friends.some((item) => item.status === "PENDING" && item.direction === "SENT") && <p className="friend-empty">보낸 친구 요청이 없어요.</p>}
          </section>
        </div>
      )}
      {(friendProfile || friendProfileLoading) && (
        <div className="announcement-backdrop" onClick={() => setFriendProfile(null)}>
          <section className="friend-sheet friend-profile-sheet" onClick={(event) => event.stopPropagation()}>
            <header><button type="button" className="friend-profile-back" onClick={() => { setFriendProfile(null); setFriendsOpen(true); }}>←</button><div><small>FRIEND PROFILE</small><h2>친구 프로필</h2></div><button type="button" onClick={() => setFriendProfile(null)}>×</button></header>
            {friendProfileLoading ? <p className="friend-profile-loading">친구의 산책 기록을 불러오고 있어요.</p> : friendProfile && <>
              <div className="friend-profile-identity"><span>{friendProfile.nickname.slice(0, 1)}</span><div><h3>{friendProfile.nickname}</h3><p>{new Date(friendProfile.joinedAt).getFullYear()}년부터 함께 걷는 중</p></div></div>
              <div className="friend-profile-stats"><div><b>{friendProfile.totalPoints.toLocaleString()}</b><span>누적 Point</span></div><div><b>{friendProfile.completedMissions}</b><span>완료 미션</span></div><div><b>{friendProfile.completedBingos}</b><span>완료 빙고</span></div></div>
              <h3>최근 활동</h3>
              <div className="friend-activity-list">{friendProfile.recentActivity.length ? friendProfile.recentActivity.map((activity, index) => <div key={`${activity.title}-${index}`}><span>✓</span><b>{activity.title}</b><small>{activity.completedAt ? new Date(activity.completedAt).toLocaleDateString("ko-KR") : "최근"}</small></div>) : <p className="friend-empty">아직 공개할 활동 기록이 없어요.</p>}</div>
              <button type="button" className="friend-profile-ranking" onClick={openFriendRanking}>친구 랭킹에서 함께 보기</button>
              <div className="friend-safety-actions"><button type="button" onClick={() => setReportTarget(friendProfile)}>신고</button><button type="button" onClick={() => void blockFriend(friendProfile)}>차단</button></div>
            </>}
          </section>
        </div>
      )}
      {reportTarget && (
        <div className="announcement-backdrop" onClick={() => setReportTarget(null)}>
          <section className="friend-sheet report-sheet" onClick={(event) => event.stopPropagation()}>
            <header><div><small>SAFETY REPORT</small><h2>사용자 신고</h2></div><button type="button" onClick={() => setReportTarget(null)}>×</button></header>
            <p>{reportTarget.nickname}님을 신고하는 이유를 알려주세요.</p>
            <label>신고 사유<select value={reportReason} onChange={(event) => setReportReason(event.target.value)}><option>부적절한 닉네임</option><option>괴롭힘 또는 불쾌한 행동</option><option>부정한 미션 인증</option><option>기타</option></select></label>
            <label>상세 내용<textarea value={reportDetail} maxLength={500} rows={5} onChange={(event) => setReportDetail(event.target.value)} placeholder="관리자 확인에 도움이 되는 내용을 적어주세요." /></label>
            <small>{reportDetail.length} / 500자</small>
            <button type="button" className="report-submit" onClick={() => void submitFriendReport()}>신고 접수</button>
          </section>
        </div>
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
                {qrMission && !selected.done && (
                  <div className="qr-verification-panel">
                    <div className={`qr-camera ${qrScanning ? "active" : ""}`}>
                      <video ref={qrVideo} muted playsInline />
                      {!qrScanning && (
                        <div>
                          <span aria-hidden="true">▦</span>
                          <b>현장 QR 코드를 화면 안에 맞춰주세요.</b>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="primary"
                      onClick={startQrScanner}
                      disabled={submitting || qrScanning}
                    >
                      {qrScanning ? "QR을 찾고 있어요…" : "카메라로 QR 스캔"}
                    </button>
                    <div className="qr-divider"><span>또는</span></div>
                    <label>
                      현장 인증 코드
                      <input
                        value={qrToken}
                        onChange={(event) => setQrToken(event.target.value)}
                        placeholder="QR 아래 인증 코드를 입력해주세요"
                        autoCapitalize="none"
                        autoCorrect="off"
                      />
                    </label>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => void submitQrMission()}
                      disabled={submitting || !qrToken.trim()}
                    >
                      {submitting ? "인증하고 있어요…" : "코드로 인증하기"}
                    </button>
                  </div>
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
                    {photoReviewState === "AVAILABLE" && (
                      <button
                        type="button"
                        className="review-request-button"
                        onClick={() => void requestPhotoReview()}
                      >
                        관리자 검수 요청
                      </button>
                    )}
                    {photoReviewState === "PENDING" && (
                      <div className="review-pending-panel" role="status">
                        <b>관리자 검수 대기 중</b>
                        <span>
                          제출 시각을 기준으로 판정하며, 승인되면 보상이 자동 반영돼요.
                        </span>
                      </div>
                    )}
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
                      disabled={
                        photoStage === "REVIEWING" ||
                        photoReviewState === "REQUESTING" ||
                        photoReviewState === "PENDING" ||
                        selected.done
                      }
                    >
                      사진 촬영하기
                    </button>
                    <button
                      className="secondary"
                      onClick={() => albumInput.current?.click()}
                      disabled={
                        photoStage === "REVIEWING" ||
                        photoReviewState === "REQUESTING" ||
                        photoReviewState === "PENDING" ||
                        selected.done
                      }
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
                    {!recordMission && !timerMission && !qrMission && (
                      <div className="reward">
                        <span>획득 보상</span>
                        <b>+ {selected.points} Point</b>
                      </div>
                    )}
                    {qrMission ? null : recordMission ? (
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
      {badgeCelebration && (
        <div className="badge-celebration-backdrop" role="dialog" aria-modal="true" aria-labelledby="new-badge-title">
          <article className="badge-celebration-card">
            <button type="button" className="badge-celebration-close" aria-label="배지 축하 창 닫기" onClick={() => setBadgeCelebration(null)}>×</button>
            <small>NEW BADGE</small>
            <div className="badge-celebration-icon" aria-hidden="true">
              {badgeCelebration.imageUrl ? <img src={badgeCelebration.imageUrl} alt="" /> : badgeCelebration.icon}
            </div>
            <h2 id="new-badge-title">새 배지를 획득했어요!</h2>
            <h3>{badgeCelebration.title}</h3>
            <p>{badgeCelebration.description}</p>
            <button type="button" className="badge-celebration-view" onClick={() => void viewCelebratedBadge()}>획득 배지 보기</button>
          </article>
        </div>
      )}
    </main>
  );
}

function addRepresentativePhotoPatterns(
  svg: string,
  records: ExplorationRecord[],
) {
  if (!svg || !records.length) return svg;
  const patterns = records
    .filter((record) => record.photoUrl)
    .map((record) => {
      const safeUrl = record.photoUrl!
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
      return `<pattern id="memory-photo-${record.regionCode}" width="1" height="1" patternUnits="objectBoundingBox" patternContentUnits="objectBoundingBox"><image href="${safeUrl}" width="1" height="1" preserveAspectRatio="xMidYMid slice" /></pattern>`;
    })
    .join("");
  let withPatterns = svg.replace(/(<svg\b[^>]*>)/, `$1<defs>${patterns}</defs>`);
  for (const record of records) {
    const pathPattern = new RegExp(
      `(<path id="region-${record.regionCode}" class=")([^"]*)(")`,
    );
    withPatterns = withPatterns.replace(
      pathPattern,
      `$1$2 has-memory-photo$3 style="fill:url(#memory-photo-${record.regionCode}) !important"`,
    );
  }
  return withPatterns;
}

function provinceNameFor(regionCode: string): string {
  const prefix = regionCode.slice(0, 2);
  return (
    {
      "11": "서울특별시",
      "21": "부산광역시",
      "22": "대구광역시",
      "23": "인천광역시",
      "24": "광주광역시",
      "25": "대전광역시",
      "26": "울산광역시",
      "29": "세종특별자치시",
      "31": "경기도",
      "32": "강원특별자치도",
      "33": "충청북도",
      "34": "충청남도",
      "35": "전북특별자치도",
      "36": "전라남도",
      "37": "경상북도",
      "38": "경상남도",
      "39": "제주특별자치도",
    } as Record<string, string>
  )[prefix] ?? "대한민국";
}

function regionNamesMatch(left: string, right: string | null): boolean {
  if (!right) return false;
  const normalize = (value: string) => {
    const compact = value.replace(/\s/g, "");
    const metropolitan = compact.match(
      /^(서울|부산|대구|인천|광주|대전|울산|세종)(?:특별시|광역시|특별자치시)$/,
    );
    if (metropolitan) return metropolitan[1];
    return compact
      .replace(/^(제주특별자치도|강원특별자치도|전북특별자치도|경기도|충청북도|충청남도|전라북도|전라남도|경상북도|경상남도)/, "")
      .replace(/[시군구]$/, "");
  };
  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right);
  return (
    normalizedLeft.length > 0 &&
    normalizedRight.length > 0 &&
    (normalizedLeft === normalizedRight ||
      normalizedLeft.includes(normalizedRight) ||
      normalizedRight.includes(normalizedLeft))
  );
}

const HANGUL_INITIALS = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
  "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
];

function hangulInitials(value: string): string {
  return Array.from(value.replace(/\s/g, ""))
    .map((character) => {
      const code = character.charCodeAt(0);
      if (code >= 0xac00 && code <= 0xd7a3) {
        return HANGUL_INITIALS[Math.floor((code - 0xac00) / 588)];
      }
      return /^[ㄱ-ㅎ]$/.test(character) ? character : "";
    })
    .join("");
}

function matchesHangulPattern(value: string, query: string): boolean {
  const targetCharacters = Array.from(value.replace(/\s/g, ""));
  const queryCharacters = Array.from(query.replace(/\s/g, ""));
  if (!queryCharacters.some((character) => /^[ㄱ-ㅎ]$/.test(character))) {
    return false;
  }
  return targetCharacters.some((_, startIndex) =>
    queryCharacters.every((queryCharacter, offset) => {
      const targetCharacter = targetCharacters[startIndex + offset];
      if (!targetCharacter) return false;
      return /^[ㄱ-ㅎ]$/.test(queryCharacter)
        ? hangulInitials(targetCharacter) === queryCharacter
        : targetCharacter === queryCharacter;
    }),
  );
}

function matchesRegionSearch(value: string, query: string): boolean {
  const compactValue = value.toLocaleLowerCase("ko").replace(/\s/g, "");
  const compactQuery = query.toLocaleLowerCase("ko").replace(/\s/g, "");
  if (!compactQuery) return true;
  if (compactValue.includes(compactQuery)) return true;
  return matchesHangulPattern(compactValue, compactQuery);
}
