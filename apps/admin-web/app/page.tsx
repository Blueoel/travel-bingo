"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

type Region = {
  id: string;
  name: string;
  administrativeCode?: string;
  status?: "ACTIVE" | "INACTIVE" | "NEEDS_REVIEW";
  activeMissionCount?: number;
  publishedBoardCount?: number;
  canActivate?: boolean;
  missingMissionCount?: number;
};
type RegionSearchResult = {
  administrativeCode: string;
  name: string;
  province: string;
  legalRegionCode: string;
  legalSigunguCode: string | null;
  registeredRegionId: string | null;
};
type Mission = {
  id: string;
  title: string;
  description: string;
  category: string;
  points: number;
  scope: "COMMON" | "REGION" | "EVENT";
  status: "ACTIVE" | "INACTIVE" | "NEEDS_REVIEW";
  difficulty: number;
  kind: string;
  verificationPolicy?: {
    type?: string;
    maxLength?: number;
    durationSeconds?: number;
    maximumAccuracyM?: number;
    maximumAgeMs?: number;
    photoVerificationMode?: "AI" | "RECORD";
    answer?: string;
  };
  radiusM?: number | null;
  place?: {
    id: string;
    title: string;
    address: string | null;
    latitude: string;
    longitude: string;
    imageUrl?: string | null;
    source?: string;
    externalContentId?: string;
    contentType?: string;
  } | null;
  estimatedMinutesMin?: number | null;
  estimatedMinutesMax?: number | null;
  similarityGroup?: string | null;
  regions: Region[];
  collections?: { id: string; name: string; type: string }[];
};
type PhotoReview = {
  id: string;
  missionTitle: string;
  missionDescription: string;
  verificationLabel: string;
  guestId: string;
  points: number;
  confidence: number;
  evidence: string[];
  failureReasons: string[];
  submittedAt: string;
  reviewDecision: "APPROVED" | "REJECTED" | null;
  reviewReason: string | null;
  reviewerEmail: string | null;
  reviewedAt: string | null;
  imageUrl: string;
  source?: "BACKEND";
};
type UserRecord = {
  id: string;
  nickname: string;
  email: string | null;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
  createdAt: string;
  updatedAt: string;
  _count: { bingoSessions: number; verifications: number };
};
type UserSummary = {
  total: number;
  active: number;
  suspended: number;
  deleted: number;
};
type UserReport = {
  id: string;
  reason: string;
  detail: string | null;
  status: "OPEN" | "RESOLVED" | "DISMISSED";
  createdAt: string;
  reporter: { nickname: string; email: string | null };
  reported: {
    id: string;
    nickname: string;
    email: string | null;
    status: string;
  };
};
type Announcement = {
  id: string;
  title: string;
  content: string;
  status: "DRAFT" | "PUBLISHED" | "ENDED";
  isImportant: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  _count: { reads: number };
};
type BadgeDefinition = {
  id: string;
  code: string;
  title: string;
  description: string;
  icon: string;
  imageUrl: string | null;
  metric:
    "POINTS" | "COMPLETED_MISSIONS" | "COMPLETED_BINGOS" | "COMPLETED_REGIONS";
  target: number;
  displayOrder: number;
  status: "ACTIVE" | "INACTIVE";
};
type BadgeTestState = {
  user: { id: string; nickname: string; email: string | null };
  badge: BadgeDefinition;
  current: number;
  target: number;
};
type RankingSettlement = {
  id: string;
  period: "DAILY" | "WEEKLY" | "MONTHLY";
  periodStart: string;
  periodEnd: string;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  participantCount: number;
  rewardCount: number;
  rewardPointTotal: number;
  completedAt: string | null;
  lastError: string | null;
  rewards: Array<{
    id: string;
    rank: number;
    score: number;
    points: number;
    user: { nickname: string; email: string | null };
  }>;
};
type SystemHealthStatus = "HEALTHY" | "WARNING" | "ERROR" | "NOT_CONFIGURED";
type SystemHealth = {
  status: "HEALTHY" | "WARNING" | "ERROR";
  checkedAt: string;
  components: Array<{
    key: string;
    label: string;
    status: SystemHealthStatus;
    summary: string;
    detail: string | null;
    latencyMs: number | null;
  }>;
  content: {
    dailyCandidateCount: number;
    dailyReady: boolean;
    activeRegionCount: number;
    readyRegionCount: number;
    regionsNeedingMissions: Array<{
      id: string;
      name: string;
      activeMissionCount: number;
      missingMissionCount: number;
    }>;
    pendingPhotoReviewCount: number;
    pendingOutboxCount: number;
    outboxFailedCount: number;
    outboxWorkerConnected: boolean;
    outboxOldestOccurredAt: string | null;
    outboxTopics: Array<{
      topic: string;
      count: number;
      failedCount: number;
    }>;
    luckyChancePercent: number;
    luckyPoints: number;
  };
  operations: {
    daily: OperationHealth | null;
    settlements: Array<OperationHealth & { period: string }>;
  };
  recentErrors: Array<{ source: string; message: string; occurredAt: string }>;
  warnings: string[];
};
type OperationHealth = {
  status: string;
  label: string;
  startedAt: string;
  completedAt: string | null;
  lastError: string | null;
};
type AttractionRecommendation = {
  contentId: string;
  contentTypeId: string | null;
  title: string;
  address: string | null;
  imageUrl: string | null;
  latitude: number;
  longitude: number;
  source: "KTO" | "DATABASE";
  recommendationReason: "NEARBY" | "RELATED";
  relatedRank: number | null;
  photoCredit: string | null;
  photoLocation: string | null;
  distanceKm: number;
  contentCategory: string;
  existingMission: { id: string; title: string; status: string } | null;
};
type MissionDraft = {
  title: string;
  description: string;
  scope: "REGION";
  category: string;
  regionId: string;
  placeTitle?: string;
  placeAddress?: string;
  latitude?: number;
  longitude?: number;
  imageUrl?: string | null;
  externalContentId?: string;
  contentTypeId?: string | null;
  radiusM?: number;
};
type MissionQr = {
  missionId: string;
  title: string;
  status: string;
  token: string;
  issuedAt: string;
  expiresAt: string;
  validHours: number;
  imageUrl: string;
};
type MissionQrUsageItem = {
  id: string;
  status: string;
  reasonCode: string | null;
  submittedAt: string;
  decidedAt: string | null;
  sessionId: string;
  position: number;
  participant: { nickname: string; email: string | null };
};
const API = "/api/backend";
const PHOTO_API =
  process.env.NEXT_PUBLIC_PHOTO_REVIEW_API_URL ??
  "https://travel-bingo-walk.blueo03.chatgpt.site";
const photoReviewImageUrl = (review: PhotoReview) =>
  review.imageUrl.startsWith("data:")
    ? review.imageUrl
    : `${PHOTO_API}${review.imageUrl}`;
const ADMIN = "10000000-0000-4000-8000-000000000002";
const scopeName = { COMMON: "공통", REGION: "지역", EVENT: "이벤트" };
const difficultyName = ["", "쉬움", "보통", "어려움", "특별"];
const difficultyValue = ["EASY", "EASY", "NORMAL", "HARD", "SPECIAL"];
const verificationName: Record<string, string> = {
  PHOTO: "사진",
  GPS: "GPS",
  TEXT: "텍스트",
  TIMER: "타이머",
  QUIZ: "퀴즈",
  MANUAL: "직접 인증",
};
const attractionContentTypes = [
  ["", "모든 관광지 유형"],
  ["12", "관광지"],
  ["14", "문화시설"],
  ["15", "축제·행사"],
  ["25", "여행코스"],
  ["28", "레포츠"],
  ["32", "숙박"],
  ["38", "쇼핑"],
  ["39", "음식점"],
] as const;
const toLocalInput = (value?: string | null) =>
  value
    ? new Date(
        new Date(value).getTime() -
          new Date(value).getTimezoneOffset() * 60_000,
      )
        .toISOString()
        .slice(0, 16)
    : "";
const announcementPhase = (item: Announcement) => {
  const now = Date.now();
  if (item.status === "DRAFT") return { key: "DRAFT", label: "임시저장" };
  if (
    item.status === "ENDED" ||
    (item.endsAt && new Date(item.endsAt).getTime() <= now)
  )
    return { key: "ENDED", label: "종료" };
  if (item.startsAt && new Date(item.startsAt).getTime() > now)
    return { key: "SCHEDULED", label: "예약" };
  return { key: "ACTIVE", label: "게시 중" };
};
const healthStatusLabel: Record<SystemHealthStatus, string> = {
  HEALTHY: "정상",
  WARNING: "확인 필요",
  ERROR: "오류",
  NOT_CONFIGURED: "설정 필요",
};
const operationStatusLabel = (status: string) =>
  status === "COMPLETED" ? "완료" : status === "FAILED" ? "실패" : "처리 중";

export default function AdminPage() {
  const [missions, setMissions] = useState<Mission[]>([]),
    [regions, setRegions] = useState<Region[]>([]),
    [dailyIds, setDailyIds] = useState<string[]>([]),
    [dailyMissions, setDailyMissions] = useState<Mission[]>([]);
  const [missionPage, setMissionPage] = useState(1);
  const [missionTotal, setMissionTotal] = useState(0);
  const [missionSummary, setMissionSummary] = useState({
    total: 0,
    common: 0,
    regional: 0,
    active: 0,
  });
  const [query, setQuery] = useState(""),
    [scope, setScope] = useState(""),
    [regionId, setRegionId] = useState(""),
    [missionStatus, setMissionStatus] = useState(""),
    [difficulty, setDifficulty] = useState(""),
    [kind, setKind] = useState(""),
    [similarityGroup, setSimilarityGroup] = useState(""),
    [dailyCandidate, setDailyCandidate] = useState("");
  const [view, setView] = useState<
      | "catalog"
      | "daily"
      | "regions"
      | "reviews"
      | "users"
      | "announcements"
      | "reports"
      | "badges"
      | "settlements"
      | "diagnostics"
    >("catalog"),
    [editing, setEditing] = useState<Mission | null>(null),
    [open, setOpen] = useState(false);
  const [reviews, setReviews] = useState<PhotoReview[]>([]);
  const [reviewMode, setReviewMode] = useState<"pending" | "history">(
    "pending",
  );
  const [reviewReasons, setReviewReasons] = useState<Record<string, string>>(
    {},
  );
  const [customReviewReasons, setCustomReviewReasons] = useState<
    Record<string, string>
  >({});
  const [zoomedPhoto, setZoomedPhoto] = useState<string | null>(null);
  const [missionQr, setMissionQr] = useState<MissionQr | null>(null);
  const [missionQrLoading, setMissionQrLoading] = useState(false);
  const [missionQrValidHours, setMissionQrValidHours] = useState(24);
  const [missionQrHistory, setMissionQrHistory] = useState<
    MissionQrUsageItem[]
  >([]);
  const [missionQrHistoryLoading, setMissionQrHistoryLoading] = useState(false);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [reports, setReports] = useState<UserReport[]>([]);
  const [reportStatus, setReportStatus] = useState<
    "OPEN" | "RESOLVED" | "DISMISSED"
  >("OPEN");
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [badges, setBadges] = useState<BadgeDefinition[]>([]);
  const [editingBadge, setEditingBadge] = useState<BadgeDefinition | null>(
    null,
  );
  const [badgeTestEmail, setBadgeTestEmail] = useState("");
  const [badgeTest, setBadgeTest] = useState<BadgeTestState | null>(null);
  const [badgeTestLoading, setBadgeTestLoading] = useState(false);
  const [rankingSettlements, setRankingSettlements] = useState<
    RankingSettlement[]
  >([]);
  const [rankingSettlementsLoading, setRankingSettlementsLoading] =
    useState(false);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [systemHealthLoading, setSystemHealthLoading] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] =
    useState<Announcement | null>(null);
  const [announcementQuery, setAnnouncementQuery] = useState("");
  const [announcementFilter, setAnnouncementFilter] = useState<
    "ALL" | "DRAFT" | "ACTIVE" | "SCHEDULED" | "ENDED"
  >("ALL");
  const [userSummary, setUserSummary] = useState<UserSummary>({
    total: 0,
    active: 0,
    suspended: 0,
    deleted: 0,
  });
  const [userQuery, setUserQuery] = useState("");
  const [regionQuery, setRegionQuery] = useState("");
  const [regionDiscoveryQuery, setRegionDiscoveryQuery] = useState("");
  const [regionDiscoveryResults, setRegionDiscoveryResults] = useState<
    RegionSearchResult[]
  >([]);
  const [regionDiscoveryLoading, setRegionDiscoveryLoading] = useState(false);
  const [managedRegionId, setManagedRegionId] = useState("");
  const [selectedRegionId, setSelectedRegionId] = useState("");
  const [attractionQuery, setAttractionQuery] = useState("");
  const [attractionContentType, setAttractionContentType] = useState("");
  const [attractionRadiusKm, setAttractionRadiusKm] = useState("20");
  const [attractions, setAttractions] = useState<AttractionRecommendation[]>(
    [],
  );
  const [selectedAttraction, setSelectedAttraction] =
    useState<AttractionRecommendation | null>(null);
  const [attractionsLoading, setAttractionsLoading] = useState(false);
  const [missionDraft, setMissionDraft] = useState<MissionDraft | null>(null);
  const [userStatus, setUserStatus] = useState("");
  const [userLoading, setUserLoading] = useState(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [formVerificationType, setFormVerificationType] = useState("PHOTO");
  const params = useMemo(() => {
    const p = new URLSearchParams({
      page: String(missionPage),
      pageSize: "20",
    });
    if (query) p.set("q", query);
    if (scope) p.set("scope", scope);
    if (regionId) p.set("regionId", regionId);
    if (missionStatus) p.set("status", missionStatus);
    if (difficulty) p.set("difficulty", difficulty);
    if (kind) p.set("kind", kind);
    if (similarityGroup) p.set("similarityGroup", similarityGroup);
    if (dailyCandidate) p.set("dailyCandidate", dailyCandidate);
    return p;
  }, [
    query,
    scope,
    regionId,
    missionStatus,
    difficulty,
    kind,
    similarityGroup,
    dailyCandidate,
    missionPage,
  ]);
  async function load() {
    try {
      const headers = { "x-user-id": ADMIN };
      const [a, b, c] = await Promise.all([
        fetch(`${API}/admin/missions?${params}`, { headers }),
        fetch(`${API}/admin/missions/regions`, { headers }),
        fetch(`${API}/admin/missions/collections/daily`, { headers }),
      ]);
      if (!a.ok || !b.ok || !c.ok)
        throw new Error("관리자 API에 연결할 수 없습니다.");
      const missionResult = (await a.json()) as {
        items: Mission[];
        total: number;
        summary?: {
          total: number;
          common: number;
          regional: number;
          active: number;
        };
      };
      setMissions(missionResult.items);
      setMissionTotal(missionResult.total);
      setMissionSummary(
        missionResult.summary ?? {
          total: missionResult.total,
          common: missionResult.items.filter((item) => item.scope === "COMMON").length,
          regional: missionResult.items.filter((item) => item.scope === "REGION").length,
          active: missionResult.items.filter((item) => item.status === "ACTIVE").length,
        },
      );
      setRegions(await b.json());
      const daily = (await c.json()) as {
        missionIds: string[];
        items: Mission[];
      };
      setDailyIds(daily.missionIds);
      setDailyMissions(daily.items);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "목록을 불러오지 못했습니다.");
    }
  }
  useEffect(() => {
    void load();
  }, [params]);
  useEffect(() => {
    setMissionPage(1);
  }, [query, scope, regionId, missionStatus, difficulty, kind, similarityGroup, dailyCandidate]);
  useEffect(() => {
    const query = regionDiscoveryQuery.trim();
    if (view !== "regions" || !query) {
      setRegionDiscoveryResults([]);
      setRegionDiscoveryLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setRegionDiscoveryLoading(true);
      try {
        const search = new URLSearchParams({ q: query, limit: "10" });
        const response = await fetch(
          `${API}/recommendations/admin/regions/search?${search}`,
          {
            headers: { "x-user-id": ADMIN },
            signal: controller.signal,
          },
        );
        if (!response.ok)
          throw new Error("전국 지역 검색을 불러오지 못했습니다.");
        setRegionDiscoveryResults(await response.json());
        setError("");
      } catch (cause) {
        if (controller.signal.aborted) return;
        setRegionDiscoveryResults([]);
        setError(
          cause instanceof Error
            ? cause.message
            : "전국 지역 검색을 불러오지 못했습니다.",
        );
      } finally {
        if (!controller.signal.aborted) setRegionDiscoveryLoading(false);
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [regionDiscoveryQuery, view]);
  function showForm(mission: Mission | null = null) {
    setMissionDraft(null);
    setEditing(mission);
    setFormVerificationType(mission?.verificationPolicy?.type ?? "PHOTO");
    setOpen(true);
  }
  async function loadMissionQrHistory(missionId: string) {
    setMissionQrHistoryLoading(true);
    try {
      const response = await fetch(
        `${API}/admin/missions/${missionId}/qr/history?limit=30`,
        { headers: { "x-user-id": ADMIN } },
      );
      if (!response.ok) throw new Error("QR 사용 이력을 불러오지 못했습니다.");
      const data = (await response.json()) as { items: MissionQrUsageItem[] };
      setMissionQrHistory(data.items);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "QR 사용 이력을 불러오지 못했습니다.",
      );
    } finally {
      setMissionQrHistoryLoading(false);
    }
  }

  async function showMissionQr(
    mission: Pick<Mission, "id" | "title" | "status">,
    validHours = 24,
  ) {
    setMissionQrLoading(true);
    setError("");
    try {
      const response = await fetch(`${API}/admin/missions/${mission.id}/qr`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-user-id": ADMIN,
        },
        body: JSON.stringify({ validHours }),
      });
      if (!response.ok) throw new Error("QR 코드를 불러오지 못했습니다.");
      const data = (await response.json()) as Omit<MissionQr, "imageUrl">;
      const imageUrl = await QRCode.toDataURL(data.token, {
        width: 420,
        margin: 2,
        color: { dark: "#15382a", light: "#fffdf7" },
        errorCorrectionLevel: "M",
      });
      setMissionQr({ ...data, imageUrl });
      setMissionQrValidHours(data.validHours);
      await loadMissionQrHistory(mission.id);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "QR 코드를 불러오지 못했습니다.",
      );
    } finally {
      setMissionQrLoading(false);
    }
  }
  async function loadAttractions(regionId: string, q = attractionQuery) {
    if (!regionId) return;
    setManagedRegionId(regionId);
    setSelectedRegionId(regionId);
    setSelectedAttraction(null);
    setAttractionsLoading(true);
    try {
      const params = new URLSearchParams({ limit: "12" });
      if (q.trim()) params.set("q", q.trim());
      if (attractionContentType)
        params.set("contentTypeId", attractionContentType);
      params.set("radiusKm", attractionRadiusKm);
      const response = await fetch(
        `${API}/recommendations/regions/${regionId}/attractions?${params}`,
        { headers: { "x-user-id": ADMIN } },
      );
      if (!response.ok) throw new Error("관광지 추천을 불러오지 못했습니다.");
      setAttractions(await response.json());
      setError("");
    } catch (cause) {
      setAttractions([]);
      setError(
        cause instanceof Error
          ? cause.message
          : "관광지 추천을 불러오지 못했습니다.",
      );
    } finally {
      setAttractionsLoading(false);
    }
  }
  async function startRegionManagement(candidate: RegionSearchResult) {
    setRegionDiscoveryLoading(true);
    try {
      let registeredRegionId = candidate.registeredRegionId;
      if (!registeredRegionId) {
        const response = await fetch(`${API}/recommendations/admin/regions`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-user-id": ADMIN,
          },
          body: JSON.stringify(candidate),
        });
        if (!response.ok) throw new Error("지역 관리를 시작하지 못했습니다.");
        registeredRegionId = ((await response.json()) as Region).id;
      }

      const regionsResponse = await fetch(`${API}/admin/missions/regions`, {
        headers: { "x-user-id": ADMIN },
      });
      if (!regionsResponse.ok)
        throw new Error("지역 목록을 갱신하지 못했습니다.");
      setRegions(await regionsResponse.json());
      setRegionDiscoveryQuery("");
      setRegionDiscoveryResults([]);
      setNotice(
        `${candidate.name} 관리를 시작합니다. 추천 관광지를 확인해보세요.`,
      );
      await loadAttractions(registeredRegionId, "");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "지역 관리를 시작하지 못했습니다.",
      );
    } finally {
      setRegionDiscoveryLoading(false);
    }
  }
  function openRegionDetails(region: Region) {
    setManagedRegionId(region.id);
    setSelectedRegionId("");
    setAttractions([]);
  }
  function createMissionFromAttraction(attraction: AttractionRecommendation) {
    if (attraction.existingMission) {
      setNotice(
        `이미 '${attraction.existingMission.title}' 미션으로 등록된 관광지입니다.`,
      );
      return;
    }
    setEditing(null);
    setFormVerificationType("GPS");
    setMissionDraft({
      title: `${attraction.title} 방문하기`,
      description: `${attraction.title}의 100m 이내에서 위치를 인증해보세요.`,
      scope: "REGION",
      category: "관광지 탐방",
      regionId: selectedRegionId,
      placeTitle: attraction.title,
      placeAddress: attraction.address ?? "",
      latitude: attraction.latitude,
      longitude: attraction.longitude,
      imageUrl: attraction.imageUrl,
      externalContentId: attraction.contentId,
      contentTypeId: attraction.contentTypeId,
      radiusM: 100,
    });
    setOpen(true);
  }
  async function saveMission(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    const verificationType = String(data.verificationType);
    const usesEstimatedTime =
      verificationType === "GPS_STAY" || verificationType === "TIMER";
    const verificationPolicy =
      verificationType === "TEXT"
        ? { type: "TEXT", maxLength: Number(data.textMaxLength) }
        : verificationType === "TIMER"
          ? {
              type: "TIMER",
              durationSeconds: Number(data.timerMinutes) * 60,
            }
          : verificationType === "GPS"
            ? {
                type: "GPS",
                maximumAccuracyM: Number(data.maximumAccuracyM),
                maximumAgeMs: 60_000,
              }
            : verificationType === "PHOTO"
              ? {
                  type: "PHOTO",
                  photoVerificationMode: String(data.photoVerificationMode),
                  requiredPhotoCount: 1,
                }
              : verificationType === "QUIZ"
                ? { type: "QUIZ", answer: String(data.quizAnswer) }
                : { type: verificationType };
    const place =
      verificationType === "GPS"
        ? {
            title: String(data.placeTitle),
            address: String(data.placeAddress || ""),
            latitude: Number(data.latitude),
            longitude: Number(data.longitude),
            imageUrl:
              missionDraft?.imageUrl ?? editing?.place?.imageUrl ?? null,
            externalContentId:
              missionDraft?.externalContentId ??
              editing?.place?.externalContentId ??
              null,
            contentType:
              missionDraft?.contentTypeId ??
              editing?.place?.contentType ??
              "TOURIST_SPOT",
            source:
              missionDraft?.externalContentId ||
              editing?.place?.source === "KTO"
                ? "KTO"
                : "ADMIN",
          }
        : null;
    const result = await fetch(
      editing ? `${API}/admin/missions/${editing.id}` : `${API}/admin/missions`,
      {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json", "x-user-id": ADMIN },
        body: JSON.stringify({
          ...data,
          estimatedMinutesMin: usesEstimatedTime
            ? Number(data.estimatedMinutesMin)
            : null,
          estimatedMinutesMax: usesEstimatedTime
            ? Number(data.estimatedMinutesMax)
            : null,
          verificationPolicy,
          radiusM: verificationType === "GPS" ? Number(data.radiusM) : null,
          place,
          regionIds: data.regionId ? [data.regionId] : [],
          changeNote: editing ? "관리자 화면에서 수정" : "관리자 화면에서 생성",
        }),
      },
    );
    if (!result.ok) return setError(`저장 실패: ${await result.text()}`);
    const savedMission = (await result.json()) as Mission;
    const recommendationDraft = missionDraft;
    setOpen(false);
    setMissionDraft(null);
    if (!editing && recommendationDraft) {
      setAttractions((current) =>
        current.map((attraction) =>
          attraction.contentId === recommendationDraft.externalContentId &&
          attraction.contentTypeId === recommendationDraft.contentTypeId
            ? {
                ...attraction,
                existingMission: {
                  id: savedMission.id,
                  title: savedMission.title,
                  status: savedMission.status,
                },
              }
            : attraction,
        ),
      );
      setSelectedAttraction((current) =>
        current && current.contentId === recommendationDraft.externalContentId
          ? {
              ...current,
              existingMission: {
                id: savedMission.id,
                title: savedMission.title,
                status: savedMission.status,
              },
            }
          : current,
      );
    }
    setNotice(
      editing ? "미션 수정이 반영되었습니다." : "새 미션이 등록되었습니다.",
    );
    await load();
  }
  async function saveDaily() {
    const result = await fetch(`${API}/admin/missions/collections/daily`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-user-id": ADMIN },
      body: JSON.stringify({ missionIds: dailyIds }),
    });
    if (!result.ok)
      return setError(`Daily 구성 저장 실패: ${await result.text()}`);
    setNotice(`Daily 후보 ${dailyIds.length}개를 저장했습니다.`);
    setError("");
  }
  async function updateRegionStatus(
    region: Region,
    status: "ACTIVE" | "INACTIVE",
  ) {
    const result = await fetch(
      `${API}/admin/missions/regions/${region.id}/status`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-user-id": ADMIN,
        },
        body: JSON.stringify({ status }),
      },
    );
    if (!result.ok) {
      const payload = (await result.json().catch(() => null)) as {
        message?: string;
      } | null;
      return setError(payload?.message ?? "지역 상태를 변경하지 못했습니다.");
    }
    setNotice(
      status === "ACTIVE"
        ? `${region.name} 서비스를 활성화했습니다. 참가자마다 활성 미션 중 25개가 자동 구성됩니다.`
        : `${region.name} 지역 서비스를 비활성화했습니다.`,
    );
    await load();
  }
  async function loadReviews() {
    try {
      const query = reviewMode === "history" ? "?status=history" : "";
      const options = {
        credentials: "include" as const,
        headers: { "x-user-id": ADMIN },
      };
      const [localResult, backendResult] = await Promise.allSettled([
        fetch(`${PHOTO_API}/api/admin/photo-reviews${query}`, options),
        fetch(`${API}/admin/missions/photo-reviews${query}`, options),
      ]);
      const loaded: PhotoReview[] = [];
      for (const result of [localResult, backendResult]) {
        if (result.status !== "fulfilled" || !result.value.ok) continue;
        loaded.push(
          ...(((await result.value.json()) as { reviews: PhotoReview[] })
            .reviews ?? []),
        );
      }
      setReviews(loaded);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "사진 검수 목록을 불러오지 못했습니다.",
      );
    }
  }
  async function decideReview(id: string, decision: "APPROVED" | "REJECTED") {
    const selectedReason = reviewReasons[id]?.trim();
    const reason =
      selectedReason === "기타"
        ? customReviewReasons[id]?.trim()
        : selectedReason;
    if (decision === "REJECTED" && !reason) {
      return setError(
        selectedReason === "기타"
          ? "기타 반려 사유를 직접 입력해주세요."
          : "반려 사유를 먼저 선택해주세요.",
      );
    }
    const review = reviews.find((item) => item.id === id);
    const endpoint =
      review?.source === "BACKEND"
        ? `${API}/admin/missions/photo-reviews/${id}`
        : `${PHOTO_API}/api/admin/photo-reviews/${id}`;
    const result = await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", "x-user-id": ADMIN },
      body: JSON.stringify({ decision, reason }),
    });
    if (!result.ok) return setError("검수 결과를 저장하지 못했습니다.");
    setReviews((current) => current.filter((review) => review.id !== id));
    setNotice(
      decision === "APPROVED"
        ? "사진 인증을 승인했습니다."
        : "사진 인증을 거절했습니다.",
    );
  }
  useEffect(() => {
    if (view === "reviews") void loadReviews();
  }, [view, reviewMode]);
  async function loadUsers() {
    setUserLoading(true);
    try {
      const query = new URLSearchParams();
      if (userQuery) query.set("q", userQuery);
      if (userStatus) query.set("status", userStatus);
      const result = await fetch(`${API}/admin/users?${query}`, {
        credentials: "include",
        headers: { "x-user-id": ADMIN },
      });
      if (!result.ok) throw new Error("사용자 목록을 불러오지 못했습니다.");
      const data = (await result.json()) as {
        items: UserRecord[];
        summary: UserSummary;
      };
      setUsers(data.items);
      setUserSummary(data.summary);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "사용자 목록을 불러오지 못했습니다.",
      );
    } finally {
      setUserLoading(false);
    }
  }
  useEffect(() => {
    if (view === "users") void loadUsers();
  }, [view, userQuery, userStatus]);
  async function loadReports() {
    const result = await fetch(
      `${API}/admin/users/reports/list?status=${reportStatus}`,
      { credentials: "include", headers: { "x-user-id": ADMIN } },
    );
    if (!result.ok) return setError("사용자 신고를 불러오지 못했습니다.");
    setReports(await result.json());
    setError("");
  }
  useEffect(() => {
    if (view === "reports") void loadReports();
  }, [view, reportStatus]);
  async function resolveReport(id: string, status: "RESOLVED" | "DISMISSED") {
    const result = await fetch(`${API}/admin/users/reports/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json", "x-user-id": ADMIN },
      body: JSON.stringify({ status }),
    });
    if (!result.ok) return setError("신고 상태를 변경하지 못했습니다.");
    setNotice(
      status === "RESOLVED"
        ? "신고를 처리 완료했습니다."
        : "신고를 기각했습니다.",
    );
    await loadReports();
  }
  async function suspendReportedUser(report: UserReport) {
    if (
      !window.confirm(
        `${report.reported.nickname} 계정의 이용을 정지하고 신고를 처리 완료할까요?`,
      )
    )
      return;
    const result = await fetch(
      `${API}/admin/users/${report.reported.id}/status`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json", "x-user-id": ADMIN },
        body: JSON.stringify({ action: "SUSPEND" }),
      },
    );
    if (!result.ok) return setError("신고 대상 계정을 정지하지 못했습니다.");
    await resolveReport(report.id, "RESOLVED");
    setNotice("신고 대상 계정을 이용 정지하고 신고를 처리 완료했습니다.");
  }
  async function manageUser(
    user: UserRecord,
    action: "SUSPEND" | "ACTIVATE" | "WITHDRAW",
  ) {
    if (
      action === "WITHDRAW" &&
      !window.confirm(
        `${user.nickname} 계정을 탈퇴 처리할까요?\n개인정보가 익명화되고 모든 로그인 세션이 종료됩니다.`,
      )
    ) {
      return;
    }
    const result = await fetch(`${API}/admin/users/${user.id}/status`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        "x-user-id": ADMIN,
      },
      body: JSON.stringify({ action }),
    });
    if (!result.ok) {
      const data = (await result.json().catch(() => null)) as {
        message?: string;
      } | null;
      return setError(data?.message ?? "사용자 상태를 변경하지 못했습니다.");
    }
    setNotice(
      action === "WITHDRAW"
        ? "계정을 탈퇴 처리하고 이메일·비밀번호를 삭제했습니다."
        : action === "SUSPEND"
          ? "계정 이용을 정지하고 로그인 세션을 종료했습니다."
          : "계정을 다시 활성화했습니다.",
    );
    await loadUsers();
  }
  async function loadAnnouncements() {
    const result = await fetch(`${API}/admin/announcements`, {
      credentials: "include",
      headers: { "x-user-id": ADMIN },
    });
    if (!result.ok) return setError("공지사항을 불러오지 못했습니다.");
    setAnnouncements(await result.json());
    setError("");
  }
  async function loadBadges() {
    const response = await fetch(`${API}/admin/badges`, {
      headers: { "x-user-id": ADMIN },
    });
    if (!response.ok) return setError("배지 목록을 불러오지 못했습니다.");
    setBadges(await response.json());
    setError("");
  }
  useEffect(() => {
    if (view === "badges") void loadBadges();
  }, [view]);
  async function loadRankingSettlements() {
    setRankingSettlementsLoading(true);
    try {
      const response = await fetch(`${API}/admin/ranking-settlements`, {
        credentials: "include",
        headers: { "x-user-id": ADMIN },
      });
      if (!response.ok)
        return setError("랭킹 정산 기록을 불러오지 못했습니다.");
      setRankingSettlements(await response.json());
      setError("");
    } finally {
      setRankingSettlementsLoading(false);
    }
  }
  async function runRankingSettlements() {
    setRankingSettlementsLoading(true);
    setError("");
    try {
      const response = await fetch(`${API}/admin/ranking-settlements/run`, {
        method: "POST",
        credentials: "include",
        headers: { "x-user-id": ADMIN },
      });
      if (!response.ok)
        return setError("누락 정산 확인을 실행하지 못했습니다.");
      setNotice("일간 경계 기준으로 누락된 주간·월간 정산을 확인했습니다.");
      await loadRankingSettlements();
    } finally {
      setRankingSettlementsLoading(false);
    }
  }
  useEffect(() => {
    if (view === "settlements") void loadRankingSettlements();
  }, [view]);
  async function loadSystemHealth() {
    setSystemHealthLoading(true);
    setError("");
    try {
      const response = await fetch(`${API}/admin/system-health`, {
        credentials: "include",
        headers: { "x-user-id": ADMIN },
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error("시스템 점검 결과를 불러오지 못했습니다.");
      setSystemHealth(await response.json());
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "시스템 점검을 실행하지 못했습니다.",
      );
    } finally {
      setSystemHealthLoading(false);
    }
  }
  useEffect(() => {
    if (view === "diagnostics") void loadSystemHealth();
  }, [view]);
  async function saveBadge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    const body = {
      code: String(data.code),
      title: String(data.title),
      description: String(data.description),
      icon: String(data.icon),
      imageUrl: String(data.imageUrl || ""),
      metric: String(data.metric),
      target: Number(data.target),
      displayOrder: Number(data.displayOrder),
      status: String(data.status),
    };
    const response = await fetch(
      `${API}/admin/badges${editingBadge ? `/${editingBadge.id}` : ""}`,
      {
        method: editingBadge ? "PATCH" : "POST",
        headers: { "x-user-id": ADMIN, "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!response.ok) return setError("배지 설정을 저장하지 못했습니다.");
    setEditingBadge(null);
    setNotice(
      editingBadge ? "배지 설정을 수정했습니다." : "새 배지를 등록했습니다.",
    );
    await loadBadges();
    event.currentTarget.reset();
  }
  async function prepareBadgeTest() {
    if (!badgeTestEmail.trim())
      return setError("테스트할 참가자의 이메일을 입력해주세요.");
    setBadgeTestLoading(true);
    setError("");
    try {
      const response = await fetch(`${API}/admin/badges/test/prepare`, {
        method: "POST",
        credentials: "include",
        headers: { "x-user-id": ADMIN, "content-type": "application/json" },
        body: JSON.stringify({ email: badgeTestEmail }),
      });
      const payload = (await response.json().catch(() => null)) as
        BadgeTestState | { message?: string } | null;
      if (!response.ok || !payload || !("badge" in payload))
        throw new Error(
          payload && "message" in payload
            ? payload.message
            : "테스트 배지를 준비하지 못했습니다.",
        );
      setBadgeTest(payload);
      setNotice(
        `${payload.user.nickname}님의 다음 미션 인증에서 테스트 배지가 지급됩니다.`,
      );
      await loadBadges();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "테스트 배지를 준비하지 못했습니다.",
      );
    } finally {
      setBadgeTestLoading(false);
    }
  }
  async function resetBadgeTest() {
    if (!badgeTest) return;
    setBadgeTestLoading(true);
    setError("");
    try {
      const response = await fetch(`${API}/admin/badges/test/reset`, {
        method: "POST",
        credentials: "include",
        headers: { "x-user-id": ADMIN, "content-type": "application/json" },
        body: JSON.stringify({
          email: badgeTestEmail,
          code: badgeTest.badge.code,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        BadgeTestState | { message?: string } | null;
      if (!response.ok || !payload || !("badge" in payload))
        throw new Error(
          payload && "message" in payload
            ? payload.message
            : "테스트 상태를 초기화하지 못했습니다.",
        );
      setBadgeTest(payload);
      setNotice(
        "획득 기록을 초기화했습니다. 다음 미션 인증으로 다시 시험할 수 있습니다.",
      );
      await loadBadges();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "테스트 상태를 초기화하지 못했습니다.",
      );
    } finally {
      setBadgeTestLoading(false);
    }
  }
  async function cleanupBadgeTests() {
    if (!window.confirm("모든 임시 테스트 배지와 관련 획득 기록을 삭제할까요?"))
      return;
    setBadgeTestLoading(true);
    setError("");
    try {
      const response = await fetch(`${API}/admin/badges/test`, {
        method: "DELETE",
        credentials: "include",
        headers: { "x-user-id": ADMIN },
      });
      const payload = (await response.json().catch(() => null)) as {
        deleted?: number;
        message?: string;
      } | null;
      if (!response.ok)
        throw new Error(
          payload?.message ?? "테스트 배지를 정리하지 못했습니다.",
        );
      setBadgeTest(null);
      setNotice(`테스트 배지 ${payload?.deleted ?? 0}개를 정리했습니다.`);
      await loadBadges();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "테스트 배지를 정리하지 못했습니다.",
      );
    } finally {
      setBadgeTestLoading(false);
    }
  }
  useEffect(() => {
    if (view === "announcements") void loadAnnouncements();
  }, [view]);
  async function saveAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    const result = await fetch(
      editingAnnouncement
        ? `${API}/admin/announcements/${editingAnnouncement.id}`
        : `${API}/admin/announcements`,
      {
        method: editingAnnouncement ? "PATCH" : "POST",
        credentials: "include",
        headers: { "content-type": "application/json", "x-user-id": ADMIN },
        body: JSON.stringify({
          title: data.title,
          content: data.content,
          status: data.status,
          isImportant: data.isImportant === "on",
          startsAt: data.startsAt
            ? new Date(String(data.startsAt)).toISOString()
            : null,
          endsAt: data.endsAt
            ? new Date(String(data.endsAt)).toISOString()
            : null,
        }),
      },
    );
    if (!result.ok) return setError(`공지 저장 실패: ${await result.text()}`);
    setEditingAnnouncement(null);
    event.currentTarget.reset();
    setNotice(
      editingAnnouncement
        ? "공지사항을 수정했습니다."
        : "공지사항을 등록했습니다.",
    );
    await loadAnnouncements();
  }
  async function deleteAnnouncement(item: Announcement) {
    if (!window.confirm(`'${item.title}' 공지를 삭제할까요?`)) return;
    const result = await fetch(`${API}/admin/announcements/${item.id}`, {
      method: "DELETE",
      credentials: "include",
      headers: { "x-user-id": ADMIN },
    });
    if (!result.ok) return setError("공지사항을 삭제하지 못했습니다.");
    if (editingAnnouncement?.id === item.id) setEditingAnnouncement(null);
    setNotice("공지사항을 삭제했습니다.");
    await loadAnnouncements();
  }
  const visibleAnnouncements = useMemo(() => {
    const now = Date.now();
    const query = announcementQuery.trim().toLocaleLowerCase("ko-KR");
    return announcements.filter((item) => {
      const phase =
        item.status === "DRAFT"
          ? "DRAFT"
          : item.status === "ENDED" ||
              (item.endsAt && new Date(item.endsAt).getTime() <= now)
            ? "ENDED"
            : item.startsAt && new Date(item.startsAt).getTime() > now
              ? "SCHEDULED"
              : "ACTIVE";
      return (
        (announcementFilter === "ALL" || phase === announcementFilter) &&
        (!query ||
          `${item.title} ${item.content}`
            .toLocaleLowerCase("ko-KR")
            .includes(query))
      );
    });
  }, [announcements, announcementFilter, announcementQuery]);
  const dailyCandidates = dailyMissions.filter(
    (m) => m.scope === "COMMON" && m.status === "ACTIVE",
  );
  const selectedDailyMissions = useMemo(() => {
    const available = new Map(
      [...dailyMissions, ...dailyCandidates].map((mission) => [
        mission.id,
        mission,
      ]),
    );
    return dailyIds
      .map((id) => available.get(id))
      .filter((mission): mission is Mission => Boolean(mission));
  }, [dailyCandidates, dailyIds, dailyMissions]);
  const visibleRegions = useMemo(() => {
    const normalized = regionQuery.trim().toLocaleLowerCase("ko");
    if (!normalized) return regions;
    return regions.filter(
      (region) =>
        region.name.toLocaleLowerCase("ko").includes(normalized) ||
        region.administrativeCode?.includes(normalized),
    );
  }, [regionQuery, regions]);
  const selectedRegion = regions.find(
    (region) => region.id === managedRegionId,
  );
  const dailyHealth = useMemo(() => {
    const difficultyCounts = [1, 2, 3].map(
      (level) =>
        selectedDailyMissions.filter((mission) => mission.difficulty === level)
          .length,
    );
    const photoCount = selectedDailyMissions.filter(
      (mission) => mission.kind === "PHOTO",
    ).length;
    const grouped = new Map<string, number>();
    selectedDailyMissions.forEach((mission) => {
      if (!mission.similarityGroup) return;
      grouped.set(
        mission.similarityGroup,
        (grouped.get(mission.similarityGroup) ?? 0) + 1,
      );
    });
    const repeatedGroups = [...grouped.entries()]
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1]);
    const warnings = [
      dailyIds.length < 25
        ? `후보가 ${25 - dailyIds.length}개 부족합니다.`
        : "",
      difficultyCounts[0] < 13
        ? `쉬움 미션을 ${13 - difficultyCounts[0]}개 더 추가하면 권장 비율을 맞출 수 있습니다.`
        : "",
      difficultyCounts[1] < 9
        ? `보통 미션을 ${9 - difficultyCounts[1]}개 더 추가하면 권장 비율을 맞출 수 있습니다.`
        : "",
      difficultyCounts[2] < 3
        ? `어려움 미션을 ${3 - difficultyCounts[2]}개 더 추가하면 권장 비율을 맞출 수 있습니다.`
        : "",
      photoCount > Math.floor(selectedDailyMissions.length * 0.6)
        ? "사진 인증 미션 비중이 높습니다. 다른 인증 방식을 보강해 주세요."
        : "",
      ...repeatedGroups
        .filter(([, count]) => count >= 5)
        .map(
          ([group, count]) =>
            `${group} 유사 그룹이 ${count}개입니다. 같은 판에는 최대 1개만 우선 배치됩니다.`,
        ),
    ].filter(Boolean);
    return { difficultyCounts, photoCount, repeatedGroups, warnings };
  }, [dailyIds.length, selectedDailyMissions]);
  return (
    <div className="shell">
      <aside>
        <div className="brand">
          <i>W</i>
          <b>Travel Bingo</b>
          <small>ADMIN</small>
        </div>
        <nav>
          <span>대시보드</span>
          <button
            className={view === "catalog" ? "selected" : ""}
            onClick={() => setView("catalog")}
          >
            미션 관리
          </button>
          <button
            className={view === "daily" ? "selected" : ""}
            onClick={() => setView("daily")}
          >
            Daily 빙고 구성
          </button>
          <button
            className={view === "reviews" ? "selected" : ""}
            onClick={() => setView("reviews")}
          >
            사진 검수
          </button>
          <button
            className={view === "regions" ? "selected" : ""}
            onClick={() => setView("regions")}
          >
            지역 관리
          </button>
          <button
            className={view === "users" ? "selected" : ""}
            onClick={() => setView("users")}
          >
            사용자 관리
          </button>
          <button
            className={view === "announcements" ? "selected" : ""}
            onClick={() => setView("announcements")}
          >
            공지사항
          </button>
          <button
            className={view === "reports" ? "selected" : ""}
            onClick={() => setView("reports")}
          >
            사용자 신고
          </button>
          <button
            className={view === "badges" ? "selected" : ""}
            onClick={() => setView("badges")}
          >
            배지 관리
          </button>
          <button
            className={view === "settlements" ? "selected" : ""}
            onClick={() => setView("settlements")}
          >
            랭킹 정산
          </button>
          <button
            className={view === "diagnostics" ? "selected" : ""}
            onClick={() => setView("diagnostics")}
          >
            시스템 점검
          </button>
        </nav>
        <div className="user">
          선　<b>관리자</b>
        </div>
      </aside>
      <main>
        <header>
          <div>
            <em>CONTENT OPERATIONS</em>
            <h1>
              {view === "catalog"
                ? "미션 관리"
                : view === "daily"
                  ? "Daily 빙고 구성"
                  : view === "regions"
                    ? "지역 관리"
                    : view === "reviews"
                      ? "사진 검수"
                      : view === "announcements"
                        ? "공지사항"
                        : view === "badges"
                          ? "배지 관리"
                          : view === "reports"
                            ? "사용자 신고"
                            : view === "settlements"
                              ? "랭킹 정산"
                              : view === "diagnostics"
                                ? "시스템 점검"
                                : "사용자 관리"}
            </h1>
            <p>
              {view === "catalog"
                ? "공통·지역 미션을 등록하고 운영 상태를 관리합니다."
                : view === "daily"
                  ? "매일 무작위로 배치할 공통 미션 후보를 선택합니다."
                  : view === "regions"
                    ? "지역 빙고 준비 상태를 확인하고 서비스 노출을 관리합니다."
                    : view === "reviews"
                      ? "AI가 판단하기 어려운 사진 인증을 확인하고 승인하거나 거절합니다."
                      : view === "announcements"
                        ? "참가자 앱에 전달할 안내와 중요 소식을 관리합니다."
                        : view === "badges"
                          ? "배지 획득 조건과 참가자 앱 표시 순서를 관리합니다."
                          : view === "reports"
                            ? "참가자가 접수한 신고를 확인하고 처리합니다."
                            : view === "settlements"
                              ? "일간·주간·월간 전체 랭킹의 보상 지급 결과와 오류를 확인합니다."
                              : view === "diagnostics"
                                ? "서비스 연결 상태와 빙고 준비도, 최근 자동 작업 결과를 한곳에서 확인합니다."
                                : "가입 계정과 이용 상태를 안전하게 관리합니다."}
            </p>
          </div>
          {view === "catalog" ? (
            <button className="primary" onClick={() => showForm()}>
              ＋ 새 미션
            </button>
          ) : view === "daily" ? (
            <button className="primary" onClick={saveDaily}>
              구성 저장
            </button>
          ) : null}
        </header>
        {notice && <p className="notice">{notice}</p>}
        {error && (
          <p className="error">{error} API 서버 실행 상태를 확인해 주세요.</p>
        )}
        {view === "catalog" ? (
          <>
            <section className="summary">
              <article>
                <span>전체 미션</span>
                <b>{missionSummary.total}</b>
                <small>현재 검색 결과</small>
              </article>
              <article>
                <span>공통 미션</span>
                <b>{missionSummary.common}</b>
                <small>Daily 빙고 후보</small>
              </article>
              <article>
                <span>지역 미션</span>
                <b>{missionSummary.regional}</b>
                <small>지역 연결 미션</small>
              </article>
              <article>
                <span>활성 미션</span>
                <b className="green">
                  {missionSummary.active}
                </b>
                <small>현재 운영 중</small>
              </article>
            </section>
            <section className="catalog">
              <div className="catalogHead">
                <div>
                  <h2>미션 카탈로그</h2>
                  <p>미션을 선택하면 수정하거나 비활성화할 수 있습니다.</p>
                </div>
                <button
                  className="secondary"
                  onClick={async () => {
                    const r = await fetch(
                      `${API}/admin/missions/export.csv?${params}`,
                      { headers: { "x-user-id": ADMIN } },
                    );
                    if (!r.ok) return setError("CSV를 내려받지 못했습니다.");
                    const u = URL.createObjectURL(await r.blob()),
                      a = document.createElement("a");
                    a.href = u;
                    a.download = "travel-bingo-missions.csv";
                    a.click();
                    URL.revokeObjectURL(u);
                  }}
                >
                  CSV 내보내기
                </button>
              </div>
              <div className="filters">
                <input
                  aria-label="미션 검색"
                  placeholder="미션명 또는 설명 검색"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <select
                  aria-label="범위"
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                >
                  <option value="">모든 범위</option>
                  <option value="COMMON">공통</option>
                  <option value="REGION">지역</option>
                  <option value="EVENT">이벤트</option>
                </select>
                <select
                  aria-label="지역"
                  value={regionId}
                  onChange={(e) => setRegionId(e.target.value)}
                >
                  <option value="">모든 지역</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="상태"
                  value={missionStatus}
                  onChange={(e) => setMissionStatus(e.target.value)}
                >
                  <option value="">모든 상태</option>
                  <option value="ACTIVE">활성</option>
                  <option value="INACTIVE">비활성</option>
                  <option value="NEEDS_REVIEW">검토 필요</option>
                </select>
                <select
                  aria-label="난이도"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                >
                  <option value="">모든 난이도</option>
                  <option value="1">쉬움</option>
                  <option value="2">보통</option>
                  <option value="3">어려움</option>
                  <option value="4">특별</option>
                </select>
                <select
                  aria-label="인증 방식"
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                >
                  <option value="">모든 인증 방식</option>
                  <option value="PHOTO">사진</option>
                  <option value="CHECK_IN">직접 완료</option>
                  <option value="PLACE_VISIT">GPS 방문</option>
                  <option value="COMPOSITE">GPS 체류·복합</option>
                  <option value="QUIZ">퀴즈</option>
                  <option value="WALK_DISTANCE">걷기 거리</option>
                  <option value="WALK_STEPS">걸음 수</option>
                  <option value="QR_SCAN">QR</option>
                </select>
                <input
                  aria-label="유사 미션 그룹"
                  placeholder="유사 그룹 검색"
                  value={similarityGroup}
                  onChange={(e) => setSimilarityGroup(e.target.value)}
                />
                <select
                  aria-label="Daily 후보 포함 여부"
                  value={dailyCandidate}
                  onChange={(e) => setDailyCandidate(e.target.value)}
                >
                  <option value="">Daily 포함 여부 전체</option>
                  <option value="true">Daily 후보</option>
                  <option value="false">Daily 후보 아님</option>
                </select>
              </div>
              <div className="table">
                <table>
                  <thead>
                    <tr>
                      <th>미션</th>
                      <th>범위</th>
                      <th>유형</th>
                      <th>난이도</th>
                      <th>인증</th>
                      <th>포인트</th>
                      <th>상태</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {missions.length ? (
                      missions.map((m) => (
                        <tr key={m.id}>
                          <td>
                            <b>{m.title}</b>
                            <small>{m.description}</small>
                            {m.similarityGroup && (
                              <small>유사 그룹 · {m.similarityGroup}</small>
                            )}
                          </td>
                          <td>
                            <mark className={m.scope.toLowerCase()}>
                              {scopeName[m.scope]}
                            </mark>
                            <small>{m.regions[0]?.name}</small>
                          </td>
                          <td>{m.category}</td>
                          <td>{difficultyName[m.difficulty]}</td>
                          <td>{m.verificationPolicy?.type ?? m.kind}</td>
                          <td>
                            <b>{m.points} P</b>
                          </td>
                          <td>
                            <mark
                              className={
                                m.status === "ACTIVE"
                                  ? "activeStatus"
                                  : "inactiveStatus"
                              }
                            >
                              {m.status === "ACTIVE"
                                ? "활성"
                                : m.status === "INACTIVE"
                                  ? "비활성"
                                  : "검토 필요"}
                            </mark>
                          </td>
                          <td>
                            {m.kind === "QR_SCAN" && (
                              <button
                                className="textButton qrButton"
                                onClick={() => showMissionQr(m)}
                                disabled={missionQrLoading}
                              >
                                QR 보기
                              </button>
                            )}
                            <button
                              className="textButton"
                              onClick={() => showForm(m)}
                            >
                              수정
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="empty">
                          조건에 맞는 미션이 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {missionTotal > 20 && (
                <nav className="pagination" aria-label="미션 목록 페이지">
                  <button
                    className="secondary"
                    disabled={missionPage === 1}
                    onClick={() => setMissionPage((page) => Math.max(1, page - 1))}
                  >
                    이전
                  </button>
                  <span>
                    {missionPage} / {Math.ceil(missionTotal / 20)} 페이지
                    <small>총 {missionTotal}개</small>
                  </span>
                  <button
                    className="secondary"
                    disabled={missionPage >= Math.ceil(missionTotal / 20)}
                    onClick={() => setMissionPage((page) => page + 1)}
                  >
                    다음
                  </button>
                </nav>
              )}
            </section>
          </>
        ) : view === "daily" ? (
          <section className="dailyPanel">
            <div className="dailyIntro">
              <div>
                <h2>Daily 후보 미션</h2>
                <p>
                  사용자별 빙고판을 만들 활성 공통 미션을 선택하세요. 현재{" "}
                  <b>{dailyIds.length}개</b>가 선택되었습니다.
                </p>
              </div>
              <span>{dailyIds.length}/100</span>
            </div>
            <div className="dailyHealth" aria-label="Daily 후보 구성 진단">
              <article>
                <span>전체 후보</span>
                <b>{dailyIds.length}</b>
                <small>
                  {dailyIds.length >= 25 ? "빙고 생성 가능" : "25개 이상 필요"}
                </small>
              </article>
              <article>
                <span>난이도 후보</span>
                <b>
                  {dailyHealth.difficultyCounts[0]} ·{" "}
                  {dailyHealth.difficultyCounts[1]} ·{" "}
                  {dailyHealth.difficultyCounts[2]}
                </b>
                <small>쉬움 · 보통 · 어려움</small>
              </article>
              <article>
                <span>사진 인증</span>
                <b>{dailyHealth.photoCount}</b>
                <small>한 판에는 최대 10개 우선 적용</small>
              </article>
              <article>
                <span>중복 유사 그룹</span>
                <b>{dailyHealth.repeatedGroups.length}</b>
                <small>같은 판에는 최대 1개 우선 적용</small>
              </article>
            </div>
            <div
              className={`dailyWarnings ${
                dailyHealth.warnings.length ? "warning" : "healthy"
              }`}
            >
              <b>
                {dailyHealth.warnings.length
                  ? "구성 보완이 필요합니다"
                  : "권장 Daily 구성을 충족합니다"}
              </b>
              {dailyHealth.warnings.length ? (
                <ul>
                  {dailyHealth.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : (
                <p>
                  현재 후보 풀로 사용자별 25칸과 권장 난이도 비율을 구성할 수
                  있습니다.
                </p>
              )}
            </div>
            <div className="candidateGrid">
              {dailyCandidates.map((m) => {
                const checked = dailyIds.includes(m.id);
                return (
                  <label
                    className={`candidate ${checked ? "checked" : ""}`}
                    key={m.id}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setDailyIds((current) =>
                          checked
                            ? current.filter((id) => id !== m.id)
                            : [...current, m.id],
                        )
                      }
                    />
                    <span>
                      <b>{m.title}</b>
                      <small>
                        {m.category} · {difficultyName[m.difficulty]} ·{" "}
                        {m.points}P
                        {m.similarityGroup ? ` · ${m.similarityGroup}` : ""}
                      </small>
                    </span>
                    <i>{checked ? "✓" : "+"}</i>
                  </label>
                );
              })}
            </div>
          </section>
        ) : view === "regions" ? (
          <>
            <section className="catalog regionDiscovery">
              <div className="catalogHead">
                <div>
                  <small>REGION DISCOVERY</small>
                  <h2>관리할 지역 찾기</h2>
                  <p>
                    전국 지역명을 검색하고 한국관광공사 지역코드 기준 추천
                    관광지를 바로 확인하세요.
                  </p>
                </div>
              </div>
              <div className="regionDiscoverySearch">
                <input
                  aria-label="전국 지역 검색"
                  placeholder="예: 수원시, 전주시, 제주특별자치도"
                  value={regionDiscoveryQuery}
                  onChange={(event) =>
                    setRegionDiscoveryQuery(event.target.value)
                  }
                  autoComplete="off"
                />
                {regionDiscoveryQuery && (
                  <button
                    type="button"
                    aria-label="전국 지역 검색어 지우기"
                    onClick={() => setRegionDiscoveryQuery("")}
                  >
                    ×
                  </button>
                )}
              </div>
              {regionDiscoveryQuery.trim() && (
                <div className="regionDiscoveryResults">
                  {regionDiscoveryLoading ? (
                    <p className="empty">지역 정보를 찾고 있습니다.</p>
                  ) : regionDiscoveryResults.length ? (
                    regionDiscoveryResults.map((candidate) => (
                      <article key={candidate.administrativeCode}>
                        <div>
                          <b>{candidate.name}</b>
                          <small>
                            {candidate.province} · 행정구역 코드{" "}
                            {candidate.administrativeCode}
                          </small>
                        </div>
                        <div className="regionDiscoveryAction">
                          {candidate.registeredRegionId && <mark>관리 중</mark>}
                          <button
                            type="button"
                            className="primary"
                            disabled={regionDiscoveryLoading}
                            onClick={() =>
                              void startRegionManagement(candidate)
                            }
                          >
                            {candidate.registeredRegionId
                              ? "관광지 추천 보기"
                              : "이 지역 관리 시작"}
                          </button>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="empty">
                      검색 결과와 일치하는 지역이 없습니다.
                    </p>
                  )}
                </div>
              )}
            </section>
            <section className="summary">
              <article>
                <span>전체 지역</span>
                <b>{regions.length}</b>
                <small>등록된 서비스 지역</small>
              </article>
              <article>
                <span>활성 지역</span>
                <b className="green">
                  {
                    regions.filter((region) => region.status === "ACTIVE")
                      .length
                  }
                </b>
                <small>사용자에게 노출 중</small>
              </article>
              <article>
                <span>활성화 가능</span>
                <b>
                  {
                    regions.filter(
                      (region) =>
                        region.canActivate && region.status !== "ACTIVE",
                    ).length
                  }
                </b>
                <small>미션과 빙고판 준비 완료</small>
              </article>
              <article>
                <span>준비 중</span>
                <b>{regions.filter((region) => !region.canActivate).length}</b>
                <small>콘텐츠 보강 필요</small>
              </article>
            </section>
            <section className="catalog regionCatalog">
              <div className="catalogHead">
                <div>
                  <h2>관리 중인 지역</h2>
                  <p>
                    활성 지역 미션이 25개 이상이면 서비스를 활성화할 수 있으며,
                    참가자마다 서로 다른 25칸이 자동 구성됩니다.
                  </p>
                </div>
              </div>
              <div className="filters regionFilters">
                <input
                  aria-label="지역 검색"
                  placeholder="지역명 또는 행정구역 코드 검색"
                  value={regionQuery}
                  onChange={(event) => setRegionQuery(event.target.value)}
                />
              </div>
              <div className="table">
                <table>
                  <thead>
                    <tr>
                      <th>지역</th>
                      <th>활성 미션</th>
                      <th>빙고판 구성</th>
                      <th>준비 상태</th>
                      <th>서비스 상태</th>
                      <th>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRegions.map((region) => (
                      <tr key={region.id}>
                        <td>
                          <b>{region.name}</b>
                          <small>
                            행정구역 코드 {region.administrativeCode ?? "-"}
                          </small>
                        </td>
                        <td>
                          <b>{region.activeMissionCount ?? 0} / 25</b>
                          <small>
                            {(region.missingMissionCount ?? 0) > 0
                              ? `${region.missingMissionCount}개 부족`
                              : "기준 충족"}
                          </small>
                        </td>
                        <td>사용자별 자동</td>
                        <td>
                          <mark
                            className={
                              region.canActivate
                                ? "activeStatus"
                                : "inactiveStatus"
                            }
                          >
                            {region.canActivate ? "활성화 가능" : "준비 중"}
                          </mark>
                        </td>
                        <td>
                          {region.status === "ACTIVE" ? "서비스 중" : "비활성"}
                        </td>
                        <td>
                          <div className="regionActions">
                            <button
                              className="textButton"
                              onClick={() => openRegionDetails(region)}
                            >
                              상세 관리
                            </button>
                            <button
                              className="textButton"
                              onClick={() => void loadAttractions(region.id)}
                            >
                              관광지 추천
                            </button>
                            <button
                              className="textButton"
                              disabled={
                                region.status !== "ACTIVE" &&
                                !region.canActivate
                              }
                              onClick={() =>
                                void updateRegionStatus(
                                  region,
                                  region.status === "ACTIVE"
                                    ? "INACTIVE"
                                    : "ACTIVE",
                                )
                              }
                            >
                              {region.status === "ACTIVE"
                                ? "비활성화"
                                : "활성화"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!visibleRegions.length && (
                      <tr>
                        <td colSpan={6} className="empty">
                          검색 결과와 일치하는 지역이 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {selectedRegion && (
                <section className="regionDetailPanel">
                  <div className="catalogHead">
                    <div>
                      <small>REGION PUBLISHING</small>
                      <h2>{selectedRegion.name} 공개 준비</h2>
                      <p>
                        활성 지역 미션이 25개 이상이면 사용자 지역 검색에
                        ‘도전하기’로 표시할 수 있습니다.
                      </p>
                    </div>
                    <button
                      className="secondary"
                      onClick={() => void loadAttractions(selectedRegion.id)}
                    >
                      관광지 추천 보기
                    </button>
                  </div>
                  <div className="regionReadinessGrid">
                    <article
                      className={
                        (selectedRegion.activeMissionCount ?? 0) >= 25
                          ? "ready"
                          : "pending"
                      }
                    >
                      <span>
                        {(selectedRegion.activeMissionCount ?? 0) >= 25
                          ? "✓"
                          : "1"}
                      </span>
                      <div>
                        <small>STEP 1</small>
                        <b>활성 지역 미션 25개</b>
                        <p>
                          {selectedRegion.activeMissionCount ?? 0} / 25개 등록
                          {(selectedRegion.missingMissionCount ?? 0) > 0
                            ? ` · ${selectedRegion.missingMissionCount}개 부족`
                            : " · 기준 충족"}
                        </p>
                      </div>
                    </article>
                    <article
                      className={
                        (selectedRegion.activeMissionCount ?? 0) >= 25
                          ? "ready"
                          : "pending"
                      }
                    >
                      <span>
                        {(selectedRegion.activeMissionCount ?? 0) >= 25
                          ? "✓"
                          : "2"}
                      </span>
                      <div>
                        <small>STEP 2</small>
                        <b>사용자별 25칸 자동 구성</b>
                        <p>난이도·미션 유형·유사 그룹을 고려해 무작위 배치</p>
                      </div>
                    </article>
                    <article
                      className={
                        selectedRegion.status === "ACTIVE" ? "ready" : "pending"
                      }
                    >
                      <span>
                        {selectedRegion.status === "ACTIVE" ? "✓" : "3"}
                      </span>
                      <div>
                        <small>STEP 3</small>
                        <b>사용자 서비스 노출</b>
                        <p>
                          {selectedRegion.status === "ACTIVE"
                            ? "현재 도전 가능한 지역으로 노출 중"
                            : "아직 준비 중으로 표시"}
                        </p>
                      </div>
                    </article>
                  </div>
                </section>
              )}
              {selectedRegionId && (
                <section className="attractionPanel">
                  <div className="catalogHead">
                    <div>
                      <h2>{selectedRegion?.name} 관광지 추천</h2>
                      <p>
                        한국관광공사 관광정보를 참고해 지역 미션 후보를
                        확인합니다.
                      </p>
                    </div>
                    <mark className="activeStatus">한국관광공사 Open API</mark>
                  </div>
                  <form
                    className="attractionSearch"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void loadAttractions(selectedRegionId, attractionQuery);
                    }}
                  >
                    <input
                      aria-label="관광지 검색"
                      placeholder="관광지명 또는 주소 검색"
                      value={attractionQuery}
                      onChange={(event) =>
                        setAttractionQuery(event.target.value)
                      }
                    />
                    <select
                      aria-label="관광지 유형"
                      value={attractionContentType}
                      onChange={(event) =>
                        setAttractionContentType(event.target.value)
                      }
                    >
                      {attractionContentTypes.map(([value, label]) => (
                        <option key={value || "all"} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="검색 반경"
                      value={attractionRadiusKm}
                      onChange={(event) =>
                        setAttractionRadiusKm(event.target.value)
                      }
                    >
                      <option value="5">5km 이내</option>
                      <option value="10">10km 이내</option>
                      <option value="20">20km 이내</option>
                    </select>
                    <button className="secondary">검색</button>
                  </form>
                  {selectedAttraction && (
                    <aside className="attractionDetail">
                      {selectedAttraction.imageUrl ? (
                        <img
                          src={selectedAttraction.imageUrl}
                          alt={`${selectedAttraction.title} 상세 사진`}
                        />
                      ) : (
                        <div className="attractionPlaceholder">사진 없음</div>
                      )}
                      <div>
                        <div className="attractionDetailMarks">
                          <mark className="activeStatus">
                            {selectedAttraction.contentCategory}
                          </mark>
                          <mark className="nearbyStatus">
                            중심지에서 {selectedAttraction.distanceKm}km
                          </mark>
                        </div>
                        <h3>{selectedAttraction.title}</h3>
                        <p>{selectedAttraction.address ?? "주소 정보 없음"}</p>
                        <dl>
                          <div>
                            <dt>좌표</dt>
                            <dd>
                              {selectedAttraction.latitude.toFixed(6)},{" "}
                              {selectedAttraction.longitude.toFixed(6)}
                            </dd>
                          </div>
                          <div>
                            <dt>추천 근거</dt>
                            <dd>
                              {selectedAttraction.recommendationReason ===
                              "RELATED"
                                ? "함께 방문한 관광지 데이터"
                                : "지역 중심지 주변 관광지"}
                            </dd>
                          </div>
                          <div>
                            <dt>GPS 인증</dt>
                            <dd>장소 좌표 기준 100m</dd>
                          </div>
                        </dl>
                        {selectedAttraction.photoCredit && (
                          <small className="attractionCredit">
                            사진 · {selectedAttraction.photoCredit}
                            {selectedAttraction.photoLocation
                              ? ` / ${selectedAttraction.photoLocation}`
                              : ""}
                          </small>
                        )}
                        {selectedAttraction.existingMission ? (
                          <p className="existingMissionNotice">
                            등록 완료 ·{" "}
                            {selectedAttraction.existingMission.title}
                          </p>
                        ) : (
                          <button
                            type="button"
                            className="primary"
                            onClick={() =>
                              createMissionFromAttraction(selectedAttraction)
                            }
                          >
                            이 장소로 미션 만들기
                          </button>
                        )}
                      </div>
                    </aside>
                  )}
                  {attractionsLoading ? (
                    <p className="attractionEmpty">관광지를 찾고 있습니다.</p>
                  ) : attractions.length ? (
                    <div className="attractionGrid">
                      {attractions.map((attraction) => (
                        <article
                          key={`${attraction.source}-${attraction.contentId}`}
                        >
                          {attraction.imageUrl ? (
                            <img
                              src={attraction.imageUrl}
                              alt={`${attraction.title} 관광지`}
                            />
                          ) : (
                            <div className="attractionPlaceholder">
                              사진 없음
                            </div>
                          )}
                          <div>
                            <mark
                              className={
                                attraction.source === "KTO"
                                  ? "activeStatus"
                                  : "inactiveStatus"
                              }
                            >
                              {attraction.source === "KTO"
                                ? "관광공사"
                                : "저장 장소"}
                            </mark>
                            <mark
                              className={
                                attraction.recommendationReason === "RELATED"
                                  ? "relatedStatus"
                                  : "nearbyStatus"
                              }
                            >
                              {attraction.recommendationReason === "RELATED"
                                ? "함께 방문 추천"
                                : "주변 관광지"}
                            </mark>
                            <h3>{attraction.title}</h3>
                            <p>{attraction.address ?? "주소 정보 없음"}</p>
                            {attraction.photoCredit && (
                              <small className="attractionCredit">
                                사진 · {attraction.photoCredit}
                                {attraction.photoLocation
                                  ? ` / ${attraction.photoLocation}`
                                  : ""}
                              </small>
                            )}
                            <p className="attractionMeta">
                              {attraction.contentCategory} ·{" "}
                              {attraction.distanceKm}km
                            </p>
                            <button
                              type="button"
                              className="secondary"
                              onClick={() => setSelectedAttraction(attraction)}
                            >
                              상세 보기
                            </button>
                            <button
                              type="button"
                              className="primary"
                              disabled={Boolean(attraction.existingMission)}
                              onClick={() =>
                                createMissionFromAttraction(attraction)
                              }
                            >
                              {attraction.existingMission
                                ? `등록됨 · ${attraction.existingMission.title}`
                                : "이 장소로 미션 만들기"}
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="attractionEmpty">
                      조건에 맞는 관광지가 없습니다.
                    </p>
                  )}
                </section>
              )}
            </section>
          </>
        ) : view === "reviews" ? (
          <section className="reviewPanel">
            <div className="catalogHead">
              <div>
                <h2>
                  {reviewMode === "pending" ? "검수 대기 목록" : "처리 이력"}
                </h2>
                <p>미션 조건과 제출 사진, AI 판정 근거를 함께 확인합니다.</p>
              </div>
              <div className="reviewTabs">
                <button
                  className={reviewMode === "pending" ? "selected" : ""}
                  onClick={() => setReviewMode("pending")}
                >
                  대기
                </button>
                <button
                  className={reviewMode === "history" ? "selected" : ""}
                  onClick={() => setReviewMode("history")}
                >
                  처리 이력
                </button>
              </div>
            </div>
            {reviews.length ? (
              <div className="reviewGrid">
                {reviews.map((review) => (
                  <article className="reviewCard" key={review.id}>
                    <img
                      src={photoReviewImageUrl(review)}
                      alt={`${review.missionTitle} 인증 사진`}
                      onClick={() =>
                        setZoomedPhoto(photoReviewImageUrl(review))
                      }
                    />
                    <div>
                      <h2>{review.missionTitle}</h2>
                      <p className="reviewDescription">
                        {review.missionDescription}
                      </p>
                      <dl>
                        <div>
                          <dt>사용자</dt>
                          <dd>{review.guestId.slice(0, 8)}…</dd>
                        </div>
                        <div>
                          <dt>제출 일시</dt>
                          <dd>
                            {new Date(review.submittedAt).toLocaleString(
                              "ko-KR",
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt>인증 조건</dt>
                          <dd>{review.verificationLabel}</dd>
                        </div>
                        <div>
                          <dt>보상</dt>
                          <dd>{review.points} Point</dd>
                        </div>
                      </dl>
                      <p>
                        AI 신뢰도 <b>{Math.round(review.confidence * 100)}%</b>
                      </p>
                      {review.evidence.map((item) => (
                        <small key={item}>근거: {item}</small>
                      ))}
                      {review.failureReasons.map((item) => (
                        <small key={item}>확인 필요: {item}</small>
                      ))}
                      {reviewMode === "history" && (
                        <p
                          className={`reviewResult ${review.reviewDecision?.toLowerCase()}`}
                        >
                          {review.reviewDecision === "APPROVED"
                            ? "승인"
                            : "거절"}
                          {review.reviewReason
                            ? ` · ${review.reviewReason}`
                            : ""}
                        </p>
                      )}
                    </div>
                    {reviewMode === "pending" && (
                      <footer>
                        <select
                          aria-label="거절 사유"
                          value={reviewReasons[review.id] ?? ""}
                          onChange={(event) =>
                            setReviewReasons((current) => ({
                              ...current,
                              [review.id]: event.target.value,
                            }))
                          }
                        >
                          <option value="">거절 사유 선택</option>
                          <option value="미션 대상이 확인되지 않음">
                            미션 대상이 확인되지 않음
                          </option>
                          <option value="사진이 흐리거나 가려짐">
                            사진이 흐리거나 가려짐
                          </option>
                          <option value="인증 조건을 충족하지 않음">
                            인증 조건을 충족하지 않음
                          </option>
                          <option value="개인정보가 노출됨">
                            개인정보가 노출됨
                          </option>
                          <option value="기타">기타 · 직접 입력</option>
                        </select>
                        {reviewReasons[review.id] === "기타" && (
                          <textarea
                            className="reviewCustomReason"
                            aria-label="기타 반려 사유"
                            value={customReviewReasons[review.id] ?? ""}
                            maxLength={500}
                            rows={3}
                            placeholder="참가자가 이해할 수 있도록 반려 사유를 작성해주세요."
                            onChange={(event) =>
                              setCustomReviewReasons((current) => ({
                                ...current,
                                [review.id]: event.target.value,
                              }))
                            }
                          />
                        )}
                        <button
                          className="secondary"
                          onClick={() => decideReview(review.id, "REJECTED")}
                        >
                          거절
                        </button>
                        <button
                          className="primary"
                          onClick={() => decideReview(review.id, "APPROVED")}
                        >
                          승인
                        </button>
                      </footer>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty">현재 검수 대기 사진이 없습니다.</p>
            )}
          </section>
        ) : view === "badges" ? (
          <section className="badgeAdminSection">
            <div className="badgeTestPanel">
              <div>
                <small>LIVE FLOW TEST</small>
                <h2>배지 획득 실전 테스트</h2>
                <p>
                  참가자 이메일을 입력하면 현재 완료 미션 수보다 1 높은 임시
                  배지를 만듭니다. 참가자 앱에서 다음 미션 하나를 완료해 팝업과
                  알림을 확인하세요.
                </p>
              </div>
              <div className="badgeTestControls">
                <label>
                  테스트 참가자 이메일
                  <input
                    type="email"
                    value={badgeTestEmail}
                    onChange={(event) => setBadgeTestEmail(event.target.value)}
                    placeholder="participant@example.com"
                  />
                </label>
                <button
                  type="button"
                  className="primary"
                  disabled={badgeTestLoading}
                  onClick={() => void prepareBadgeTest()}
                >
                  {badgeTestLoading ? "처리 중…" : "테스트 배지 준비"}
                </button>
              </div>
              {badgeTest && (
                <div className="badgeTestReady">
                  <span>{badgeTest.badge.icon}</span>
                  <div>
                    <b>
                      {badgeTest.user.nickname} · {badgeTest.badge.title}
                    </b>
                    <p>
                      현재 완료 {badgeTest.current}개 → 다음 미션 완료 시 목표{" "}
                      {badgeTest.target}개 달성
                    </p>
                    <small>
                      확인 순서: 미션 인증 → 빙고 애니메이션(해당 시) → 배지
                      팝업 → 알림 목록 → 새로고침 후 미표시
                    </small>
                  </div>
                  <button
                    type="button"
                    className="secondary"
                    disabled={badgeTestLoading}
                    onClick={() => void resetBadgeTest()}
                  >
                    같은 참가자로 다시 테스트
                  </button>
                </div>
              )}
              <button
                type="button"
                className="badgeTestCleanup"
                disabled={badgeTestLoading}
                onClick={() => void cleanupBadgeTests()}
              >
                임시 테스트 배지 모두 정리
              </button>
            </div>
            <div className="badgeAdmin">
              <form
                className="badgeForm"
                onSubmit={saveBadge}
                key={editingBadge?.id ?? "new-badge"}
              >
                <div className="catalogHead">
                  <div>
                    <h2>{editingBadge ? "배지 수정" : "새 배지 등록"}</h2>
                    <p>
                      아이콘은 지금 이모지로 사용하고, 완성된 손그림 이미지
                      URL을 나중에 연결할 수 있습니다.
                    </p>
                  </div>
                </div>
                <div className="badgeFormGrid">
                  <label>
                    관리 코드
                    <input
                      name="code"
                      required
                      maxLength={50}
                      defaultValue={editingBadge?.code}
                      placeholder="예: PHOTO_COLLECTOR"
                    />
                  </label>
                  <label>
                    배지 아이콘
                    <input
                      name="icon"
                      required
                      maxLength={20}
                      defaultValue={editingBadge?.icon ?? "🏅"}
                    />
                  </label>
                  <label>
                    배지명
                    <input
                      name="title"
                      required
                      maxLength={80}
                      defaultValue={editingBadge?.title}
                    />
                  </label>
                  <label>
                    획득 기준
                    <select
                      name="metric"
                      defaultValue={
                        editingBadge?.metric ?? "COMPLETED_MISSIONS"
                      }
                    >
                      <option value="POINTS">누적 포인트</option>
                      <option value="COMPLETED_MISSIONS">완료 미션 수</option>
                      <option value="COMPLETED_BINGOS">완료 빙고판 수</option>
                      <option value="COMPLETED_REGIONS">
                        완료 지역 빙고 수
                      </option>
                    </select>
                  </label>
                  <label>
                    목표 수치
                    <input
                      name="target"
                      required
                      type="number"
                      min="1"
                      defaultValue={editingBadge?.target ?? 1}
                    />
                  </label>
                  <label>
                    표시 순서
                    <input
                      name="displayOrder"
                      type="number"
                      defaultValue={
                        editingBadge?.displayOrder ?? badges.length * 10 + 10
                      }
                    />
                  </label>
                  <label>
                    운영 상태
                    <select
                      name="status"
                      defaultValue={editingBadge?.status ?? "ACTIVE"}
                    >
                      <option value="ACTIVE">활성</option>
                      <option value="INACTIVE">비활성</option>
                    </select>
                  </label>
                  <label>
                    손그림 이미지 URL
                    <input
                      name="imageUrl"
                      type="url"
                      defaultValue={editingBadge?.imageUrl ?? ""}
                      placeholder="완성 후 입력"
                    />
                  </label>
                </div>
                <label>
                  설명
                  <textarea
                    name="description"
                    required
                    maxLength={240}
                    rows={3}
                    defaultValue={editingBadge?.description}
                  />
                </label>
                <div className="actions">
                  {editingBadge && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setEditingBadge(null)}
                    >
                      수정 취소
                    </button>
                  )}
                  <button className="primary">
                    {editingBadge ? "변경 저장" : "배지 등록"}
                  </button>
                </div>
              </form>
              <div className="badgeAdminList">
                {badges.map((badge) => (
                  <article
                    className={badge.status === "ACTIVE" ? "" : "inactive"}
                    key={badge.id}
                  >
                    <span>
                      {badge.imageUrl ? (
                        <img src={badge.imageUrl} alt="" />
                      ) : (
                        badge.icon
                      )}
                    </span>
                    <div>
                      <small>
                        {badge.status === "ACTIVE" ? "활성" : "비활성"} · 순서{" "}
                        {badge.displayOrder}
                      </small>
                      <h3>{badge.title}</h3>
                      <p>{badge.description}</p>
                      <b>
                        {badge.metric === "POINTS"
                          ? "누적 포인트"
                          : badge.metric === "COMPLETED_MISSIONS"
                            ? "완료 미션"
                            : badge.metric === "COMPLETED_BINGOS"
                              ? "완료 빙고판"
                              : "완료 지역 빙고"}{" "}
                        {badge.target}
                      </b>
                    </div>
                    <button
                      type="button"
                      className="textButton"
                      onClick={() => setEditingBadge(badge)}
                    >
                      수정
                    </button>
                  </article>
                ))}
              </div>
            </div>
          </section>
        ) : view === "announcements" ? (
          <section className="announcementAdmin">
            <form
              className="announcementForm"
              onSubmit={saveAnnouncement}
              key={editingAnnouncement?.id ?? "new"}
            >
              <div className="catalogHead">
                <div>
                  <h2>{editingAnnouncement ? "공지 수정" : "새 공지 작성"}</h2>
                  <p>중요 공지는 참가자 앱에서 읽을 때까지 한 번 안내됩니다.</p>
                </div>
              </div>
              <label>
                제목
                <input
                  name="title"
                  required
                  maxLength={160}
                  defaultValue={editingAnnouncement?.title}
                />
              </label>
              <label>
                내용
                <textarea
                  name="content"
                  required
                  rows={6}
                  defaultValue={editingAnnouncement?.content}
                />
              </label>
              <div className="announcementOptions">
                <label>
                  상태
                  <select
                    name="status"
                    defaultValue={editingAnnouncement?.status ?? "DRAFT"}
                  >
                    <option value="DRAFT">임시저장</option>
                    <option value="PUBLISHED">게시</option>
                    <option value="ENDED">종료</option>
                  </select>
                </label>
                <label>
                  게시 시작
                  <input
                    name="startsAt"
                    type="datetime-local"
                    defaultValue={toLocalInput(editingAnnouncement?.startsAt)}
                  />
                </label>
                <label>
                  게시 종료
                  <input
                    name="endsAt"
                    type="datetime-local"
                    defaultValue={toLocalInput(editingAnnouncement?.endsAt)}
                  />
                </label>
              </div>
              <label className="importantCheck">
                <input
                  name="isImportant"
                  type="checkbox"
                  defaultChecked={editingAnnouncement?.isImportant}
                />{" "}
                중요 공지로 표시
              </label>
              <div className="actions">
                {editingAnnouncement && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setEditingAnnouncement(null)}
                  >
                    수정 취소
                  </button>
                )}
                <button className="primary">
                  {editingAnnouncement ? "변경 저장" : "공지 등록"}
                </button>
              </div>
            </form>
            <div className="announcementList">
              <h2>등록된 공지</h2>
              <div className="announcementFilters">
                <input
                  value={announcementQuery}
                  onChange={(event) => setAnnouncementQuery(event.target.value)}
                  placeholder="제목 또는 내용 검색"
                  aria-label="공지 검색"
                />
                <select
                  value={announcementFilter}
                  onChange={(event) =>
                    setAnnouncementFilter(
                      event.target.value as typeof announcementFilter,
                    )
                  }
                  aria-label="공지 상태 필터"
                >
                  <option value="ALL">전체 상태</option>
                  <option value="DRAFT">임시저장</option>
                  <option value="ACTIVE">게시 중</option>
                  <option value="SCHEDULED">예약</option>
                  <option value="ENDED">종료</option>
                </select>
              </div>
              {visibleAnnouncements.length ? (
                visibleAnnouncements.map((item) => (
                  <article key={item.id}>
                    <div>
                      <span
                        className={`announcementStatus ${announcementPhase(item).key.toLowerCase()}`}
                      >
                        {announcementPhase(item).label}
                      </span>
                      {item.isImportant && <mark>중요</mark>}
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.content}</p>
                    <small>
                      {new Date(item.createdAt).toLocaleDateString("ko-KR")} ·
                      읽음 {item._count.reads}명
                    </small>
                    <div className="announcementActions">
                      <button
                        className="textButton"
                        onClick={() => setEditingAnnouncement(item)}
                      >
                        수정
                      </button>
                      <button
                        className="withdrawButton"
                        onClick={() => void deleteAnnouncement(item)}
                      >
                        삭제
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <p className="empty">조건에 맞는 공지사항이 없습니다.</p>
              )}
            </div>
          </section>
        ) : view === "settlements" ? (
          <section className="rankingSettlementAdmin">
            <div className="settlementPolicy">
              <div>
                <small>DAILY · 매일 00:30</small>
                <h2>50 · 30 · 20P</h2>
                <p>직전 일간 전체 랭킹 1~3위</p>
              </div>
              <div>
                <small>WEEKLY · 월요일 00:30</small>
                <h2>300 · 200 · 100P</h2>
                <p>직전 주간 전체 랭킹 1~3위</p>
              </div>
              <div>
                <small>MONTHLY · 매월 1일 00:30</small>
                <h2>1,000 · 700 · 500P</h2>
                <p>직전 월간 전체 랭킹 1~3위</p>
              </div>
            </div>
            <div className="settlementHead">
              <div>
                <h2>최근 정산 결과</h2>
                <p>
                  동점자는 같은 순위와 같은 포인트를 받으며, 공통·지역·친구
                  랭킹은 조회용으로만 제공됩니다.
                </p>
              </div>
              <button
                type="button"
                className="secondary"
                disabled={rankingSettlementsLoading}
                onClick={() => void runRankingSettlements()}
              >
                {rankingSettlementsLoading ? "확인 중" : "누락 정산 확인"}
              </button>
            </div>
            <div
              className={`settlementList ${rankingSettlementsLoading ? "loading" : ""}`}
            >
              {rankingSettlements.length ? (
                rankingSettlements.map((settlement) => (
                  <article
                    key={settlement.id}
                    className={settlement.status.toLowerCase()}
                  >
                    <header>
                      <span>
                        {settlement.period === "DAILY"
                          ? "일간"
                          : settlement.period === "WEEKLY"
                            ? "주간"
                            : "월간"}
                      </span>
                      <b>
                        {settlement.status === "COMPLETED"
                          ? "정산 완료"
                          : settlement.status === "FAILED"
                            ? "실패"
                            : "처리 중"}
                      </b>
                      <time>
                        {new Date(settlement.periodStart).toLocaleDateString(
                          "ko-KR",
                        )}{" "}
                        ~{" "}
                        {new Date(settlement.periodEnd).toLocaleDateString(
                          "ko-KR",
                        )}
                      </time>
                    </header>
                    <div className="settlementStats">
                      <span>
                        <small>참가자</small>
                        <b>{settlement.participantCount}명</b>
                      </span>
                      <span>
                        <small>보상 인원</small>
                        <b>{settlement.rewardCount}명</b>
                      </span>
                      <span>
                        <small>지급 포인트</small>
                        <b>{settlement.rewardPointTotal.toLocaleString()}P</b>
                      </span>
                    </div>
                    {settlement.rewards.length > 0 && (
                      <div className="settlementWinners">
                        {settlement.rewards.map((reward) => (
                          <span key={reward.id}>
                            <b>{reward.rank}위</b> {reward.user.nickname}
                            <strong>+{reward.points.toLocaleString()}P</strong>
                          </span>
                        ))}
                      </div>
                    )}
                    {settlement.lastError && (
                      <p className="settlementError">{settlement.lastError}</p>
                    )}
                  </article>
                ))
              ) : (
                <p className="empty">아직 기록된 랭킹 정산이 없습니다.</p>
              )}
            </div>
          </section>
        ) : view === "diagnostics" ? (
          <section className="systemHealthAdmin">
            <div
              className={`systemHealthHero ${systemHealth?.status.toLowerCase() ?? "loading"}`}
            >
              <div>
                <small>SERVICE DIAGNOSTICS</small>
                <h2>
                  {systemHealth
                    ? systemHealth.status === "HEALTHY"
                      ? "모든 핵심 서비스가 정상입니다"
                      : systemHealth.status === "WARNING"
                        ? "확인이 필요한 항목이 있습니다"
                        : "서비스 오류를 확인해주세요"
                    : "서비스 상태를 확인하고 있습니다"}
                </h2>
                <p>
                  {systemHealth
                    ? `마지막 점검 ${new Date(systemHealth.checkedAt).toLocaleString("ko-KR")}`
                    : "연결 상태와 운영 데이터를 안전하게 조회합니다."}
                </p>
              </div>
              <button
                type="button"
                className="secondary"
                disabled={systemHealthLoading}
                onClick={() => void loadSystemHealth()}
              >
                {systemHealthLoading ? "점검 중…" : "전체 새로고침"}
              </button>
            </div>
            {systemHealth ? (
              <>
                <div className="healthComponentGrid">
                  {systemHealth.components.map((component) => (
                    <article
                      key={component.key}
                      className={component.status.toLowerCase()}
                    >
                      <header>
                        <span className="healthDot" />
                        <b>{component.label}</b>
                        <mark>{healthStatusLabel[component.status]}</mark>
                      </header>
                      <p>{component.summary}</p>
                      {component.detail ? (
                        <small className="providerDetail">
                          {component.detail}
                        </small>
                      ) : null}
                      <small>
                        {component.latencyMs === null
                          ? "설정 상태 확인"
                          : `응답 ${component.latencyMs.toLocaleString()}ms`}
                      </small>
                    </article>
                  ))}
                </div>
                <div className="healthMetricGrid">
                  <article>
                    <span>Daily 후보</span>
                    <b>
                      {systemHealth.content.dailyCandidateCount}
                      <small>개</small>
                    </b>
                    <p
                      className={
                        systemHealth.content.dailyReady
                          ? "healthyText"
                          : "warningText"
                      }
                    >
                      {systemHealth.content.dailyReady
                        ? "빙고 생성 가능"
                        : "25개 이상 필요"}
                    </p>
                  </article>
                  <article>
                    <span>활성 지역</span>
                    <b>
                      {systemHealth.content.readyRegionCount}
                      <small>
                        {" "}
                        / {systemHealth.content.activeRegionCount}곳
                      </small>
                    </b>
                    <p>25칸 생성 준비 완료</p>
                  </article>
                  <article>
                    <span>사진 검수</span>
                    <b>
                      {systemHealth.content.pendingPhotoReviewCount}
                      <small>건</small>
                    </b>
                    <p>승인·반려 대기</p>
                  </article>
                  <article>
                    <span>이벤트 기록</span>
                    <b>
                      {systemHealth.content.pendingOutboxCount}
                      <small>건</small>
                    </b>
                    <p
                      className={
                        systemHealth.content.outboxFailedCount
                          ? "warningText"
                          : "healthyText"
                      }
                    >
                      {systemHealth.content.outboxFailedCount
                        ? `${systemHealth.content.outboxFailedCount}건 실패 기록`
                        : "실패 기록 없음"}
                    </p>
                  </article>
                  <article>
                    <span>Lucky 설정</span>
                    <b>
                      {systemHealth.content.luckyChancePercent}
                      <small>%</small>
                    </b>
                    <p>당첨 시 {systemHealth.content.luckyPoints}P</p>
                  </article>
                </div>
                <article className="healthPanel outboxHealthPanel">
                  <div className="healthPanelHead">
                    <div>
                      <small>EVENT OUTBOX</small>
                      <h3>이벤트 누적 원인</h3>
                    </div>
                    <b>{systemHealth.content.pendingOutboxCount}건 기록</b>
                  </div>
                  <p className="outboxExplanation">
                    현재 사진 검수 알림은 인증 기록에서 직접 제공됩니다. 이
                    Outbox 항목은 이벤트 이력으로 저장되며 별도 전송 처리기가
                    연결되지 않아 처리 시간이 비어 있습니다.
                  </p>
                  <div className="outboxMeta">
                    <span>
                      처리기{" "}
                      {systemHealth.content.outboxWorkerConnected
                        ? "연결"
                        : "미연결"}
                    </span>
                    <span>
                      실제 실패 {systemHealth.content.outboxFailedCount}건
                    </span>
                    {systemHealth.content.outboxOldestOccurredAt ? (
                      <span>
                        최초 기록{" "}
                        {new Date(
                          systemHealth.content.outboxOldestOccurredAt,
                        ).toLocaleString("ko-KR")}
                      </span>
                    ) : null}
                  </div>
                  {systemHealth.content.outboxTopics.length ? (
                    <ul className="outboxTopicList">
                      {systemHealth.content.outboxTopics.map((item) => (
                        <li key={item.topic}>
                          <code>{item.topic}</code>
                          <b>{item.count}건</b>
                          {item.failedCount ? (
                            <small>{item.failedCount}건 실패</small>
                          ) : (
                            <small>실패 없음</small>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="healthyEmpty">누적된 이벤트가 없습니다.</p>
                  )}
                </article>
                <div className="healthDetailGrid">
                  <article className="healthPanel">
                    <div className="healthPanelHead">
                      <div>
                        <small>CONTENT READINESS</small>
                        <h3>지역 빙고 준비 상태</h3>
                      </div>
                      <b>{systemHealth.content.readyRegionCount}곳 준비 완료</b>
                    </div>
                    {systemHealth.content.regionsNeedingMissions.length ? (
                      <ul className="regionHealthList">
                        {systemHealth.content.regionsNeedingMissions.map(
                          (region) => (
                            <li key={region.id}>
                              <span>
                                <b>{region.name}</b>
                                <small>
                                  활성 미션 {region.activeMissionCount}개
                                </small>
                              </span>
                              <strong>
                                {region.missingMissionCount}개 부족
                              </strong>
                            </li>
                          ),
                        )}
                      </ul>
                    ) : (
                      <p className="healthyEmpty">
                        활성 지역의 미션 구성이 모두 준비되었습니다.
                      </p>
                    )}
                  </article>
                  <article className="healthPanel">
                    <div className="healthPanelHead">
                      <div>
                        <small>AUTOMATION</small>
                        <h3>최근 자동 작업</h3>
                      </div>
                      <span>매일 00:30 기준</span>
                    </div>
                    <div className="operationHealthList">
                      {systemHealth.operations.daily ? (
                        <div>
                          <span
                            className={systemHealth.operations.daily.status.toLowerCase()}
                          >
                            {operationStatusLabel(
                              systemHealth.operations.daily.status,
                            )}
                          </span>
                          <b>
                            Daily 빙고 · {systemHealth.operations.daily.label}
                          </b>
                          <time>
                            {new Date(
                              systemHealth.operations.daily.completedAt ??
                                systemHealth.operations.daily.startedAt,
                            ).toLocaleString("ko-KR")}
                          </time>
                        </div>
                      ) : (
                        <p className="empty">Daily 실행 기록이 없습니다.</p>
                      )}
                      {systemHealth.operations.settlements.map((operation) => (
                        <div key={`${operation.period}-${operation.startedAt}`}>
                          <span className={operation.status.toLowerCase()}>
                            {operationStatusLabel(operation.status)}
                          </span>
                          <b>
                            {operation.period === "DAILY"
                              ? "일간"
                              : operation.period === "WEEKLY"
                                ? "주간"
                                : "월간"}{" "}
                            랭킹 정산
                          </b>
                          <time>
                            {new Date(
                              operation.completedAt ?? operation.startedAt,
                            ).toLocaleString("ko-KR")}
                          </time>
                        </div>
                      ))}
                    </div>
                  </article>
                </div>
                <div className="healthDetailGrid">
                  <article className="healthPanel">
                    <div className="healthPanelHead">
                      <div>
                        <small>ATTENTION</small>
                        <h3>확인할 항목</h3>
                      </div>
                      <b>{systemHealth.warnings.length}건</b>
                    </div>
                    {systemHealth.warnings.length ? (
                      <ul className="healthWarningList">
                        {systemHealth.warnings.map((warning, index) => (
                          <li key={`${warning}-${index}`}>{warning}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="healthyEmpty">
                        현재 확인이 필요한 항목이 없습니다.
                      </p>
                    )}
                  </article>
                  <article className="healthPanel">
                    <div className="healthPanelHead">
                      <div>
                        <small>RECENT ERRORS</small>
                        <h3>최근 오류</h3>
                      </div>
                      <b>{systemHealth.recentErrors.length}건</b>
                    </div>
                    {systemHealth.recentErrors.length ? (
                      <ul className="healthErrorList">
                        {systemHealth.recentErrors.map((item, index) => (
                          <li key={`${item.occurredAt}-${index}`}>
                            <span>
                              <b>{item.source}</b>
                              <small>
                                {new Date(item.occurredAt).toLocaleString(
                                  "ko-KR",
                                )}
                              </small>
                            </span>
                            <p>{item.message}</p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="healthyEmpty">
                        기록된 최근 오류가 없습니다.
                      </p>
                    )}
                  </article>
                </div>
              </>
            ) : (
              <div className="healthLoading">
                핵심 서비스와 운영 데이터를 점검하고 있습니다.
              </div>
            )}
          </section>
        ) : view === "reports" ? (
          <section className="reportAdmin">
            <div className="catalogHead">
              <div>
                <h2>사용자 신고</h2>
                <p>
                  신고자와 대상, 접수 사유를 확인하고 처리 상태를 기록합니다.
                </p>
              </div>
              <select
                value={reportStatus}
                onChange={(event) =>
                  setReportStatus(event.target.value as typeof reportStatus)
                }
              >
                <option value="OPEN">처리 대기</option>
                <option value="RESOLVED">처리 완료</option>
                <option value="DISMISSED">기각</option>
              </select>
            </div>
            <div className="reportAdminList">
              {reports.length ? (
                reports.map((report) => (
                  <article key={report.id}>
                    <header>
                      <mark>{report.reason}</mark>
                      <time>
                        {new Date(report.createdAt).toLocaleString("ko-KR")}
                      </time>
                    </header>
                    <h3>{report.reported.nickname} 신고</h3>
                    <p>{report.detail || "상세 내용 없음"}</p>
                    <dl>
                      <div>
                        <dt>신고자</dt>
                        <dd>
                          {report.reporter.nickname} · {report.reporter.email}
                        </dd>
                      </div>
                      <div>
                        <dt>신고 대상</dt>
                        <dd>
                          {report.reported.nickname} · {report.reported.email}
                        </dd>
                      </div>
                    </dl>
                    {reportStatus === "OPEN" && (
                      <footer>
                        <button
                          className="secondary"
                          onClick={() =>
                            void resolveReport(report.id, "DISMISSED")
                          }
                        >
                          기각
                        </button>
                        <button
                          className="secondary"
                          onClick={() =>
                            void resolveReport(report.id, "RESOLVED")
                          }
                        >
                          처리 완료
                        </button>
                        {report.reported.status === "ACTIVE" && (
                          <button
                            className="primary"
                            onClick={() => void suspendReportedUser(report)}
                          >
                            이용 정지 후 완료
                          </button>
                        )}
                      </footer>
                    )}
                  </article>
                ))
              ) : (
                <p className="empty">해당 상태의 신고가 없습니다.</p>
              )}
            </div>
          </section>
        ) : (
          <>
            <section className="summary userSummary">
              <article>
                <span>전체 계정</span>
                <b>{userSummary.total}</b>
                <small>가입 이력 전체</small>
              </article>
              <article>
                <span>이용 중</span>
                <b className="green">{userSummary.active}</b>
                <small>로그인 가능</small>
              </article>
              <article>
                <span>이용 정지</span>
                <b>{userSummary.suspended}</b>
                <small>관리자 정지</small>
              </article>
              <article>
                <span>탈퇴</span>
                <b>{userSummary.deleted}</b>
                <small>개인정보 익명화</small>
              </article>
            </section>
            <section className="catalog userCatalog">
              <div className="catalogHead">
                <div>
                  <h2>가입 사용자</h2>
                  <p>
                    비밀번호는 저장된 해시를 포함해 관리자 화면에 표시하지
                    않습니다.
                  </p>
                </div>
              </div>
              <div className="filters userFilters">
                <input
                  aria-label="사용자 검색"
                  placeholder="이름 또는 이메일 검색"
                  value={userQuery}
                  onChange={(event) => setUserQuery(event.target.value)}
                />
                <select
                  aria-label="사용자 상태"
                  value={userStatus}
                  onChange={(event) => setUserStatus(event.target.value)}
                >
                  <option value="">모든 상태</option>
                  <option value="ACTIVE">이용 중</option>
                  <option value="SUSPENDED">이용 정지</option>
                  <option value="DELETED">탈퇴</option>
                </select>
              </div>
              <div className={`table ${userLoading ? "tableLoading" : ""}`}>
                <table>
                  <thead>
                    <tr>
                      <th>사용자</th>
                      <th>권한</th>
                      <th>가입일</th>
                      <th>활동</th>
                      <th>상태</th>
                      <th>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length ? (
                      users.map((user) => (
                        <tr key={user.id}>
                          <td>
                            <b>{user.nickname}</b>
                            <small>{user.email ?? "이메일 미등록"}</small>
                          </td>
                          <td>{user.role === "ADMIN" ? "관리자" : "일반"}</td>
                          <td>
                            {new Date(user.createdAt).toLocaleDateString(
                              "ko-KR",
                            )}
                          </td>
                          <td>
                            빙고 {user._count.bingoSessions} · 인증{" "}
                            {user._count.verifications}
                          </td>
                          <td>
                            <mark
                              className={`userStatus ${user.status.toLowerCase()}`}
                            >
                              {user.status === "ACTIVE"
                                ? "이용 중"
                                : user.status === "SUSPENDED"
                                  ? "이용 정지"
                                  : "탈퇴"}
                            </mark>
                          </td>
                          <td>
                            {user.role === "ADMIN" ||
                            user.status === "DELETED" ? (
                              <span className="protectedUser">
                                {user.role === "ADMIN"
                                  ? "보호 계정"
                                  : "처리 완료"}
                              </span>
                            ) : (
                              <div className="userActions">
                                <button
                                  className="textButton"
                                  onClick={() =>
                                    manageUser(
                                      user,
                                      user.status === "ACTIVE"
                                        ? "SUSPEND"
                                        : "ACTIVATE",
                                    )
                                  }
                                >
                                  {user.status === "ACTIVE"
                                    ? "이용 정지"
                                    : "복구"}
                                </button>
                                <button
                                  className="withdrawButton"
                                  onClick={() => manageUser(user, "WITHDRAW")}
                                >
                                  탈퇴 처리
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="empty">
                          조건에 맞는 사용자가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
      {zoomedPhoto && (
        <div className="photoZoom" onClick={() => setZoomedPhoto(null)}>
          <button aria-label="확대 사진 닫기">×</button>
          <img src={zoomedPhoto} alt="확대된 인증 사진" />
        </div>
      )}
      {missionQr && (
        <div className="backdrop" onMouseDown={() => setMissionQr(null)}>
          <section
            className="qrMissionModal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="qrModalClose"
              aria-label="QR 창 닫기"
              onClick={() => setMissionQr(null)}
            >
              ×
            </button>
            <small>MISSION QR</small>
            <h2>{missionQr.title}</h2>
            <p>
              현장에 인쇄해 두면 참가자가 스캔하여 미션을 완료할 수 있습니다.
            </p>
            <div className="qrValiditySummary">
              <span>
                <small>발급</small>
                <b>{new Date(missionQr.issuedAt).toLocaleString("ko-KR")}</b>
              </span>
              <span>
                <small>만료</small>
                <b>{new Date(missionQr.expiresAt).toLocaleString("ko-KR")}</b>
              </span>
            </div>
            <img
              src={missionQr.imageUrl}
              alt={`${missionQr.title} 인증 QR 코드`}
            />
            <code>{missionQr.token}</code>
            <div className="qrReissueControls">
              <label>
                유효기간
                <select
                  value={missionQrValidHours}
                  onChange={(event) =>
                    setMissionQrValidHours(Number(event.target.value))
                  }
                >
                  <option value={1}>1시간</option>
                  <option value={24}>24시간</option>
                  <option value={168}>7일</option>
                  <option value={720}>30일</option>
                </select>
              </label>
              <button
                type="button"
                className="secondary"
                disabled={missionQrLoading}
                onClick={() =>
                  showMissionQr(
                    {
                      id: missionQr.missionId,
                      title: missionQr.title,
                      status: missionQr.status as Mission["status"],
                    },
                    missionQrValidHours,
                  )
                }
              >
                {missionQrLoading ? "발급 중…" : "새 QR 재발급"}
              </button>
            </div>
            <p className="qrReissueNote">
              재발급 전 QR도 표시된 만료 시각까지는 유효합니다.
            </p>
            <div className="qrMissionActions">
              <button
                type="button"
                className="secondary"
                onClick={() => navigator.clipboard.writeText(missionQr.token)}
              >
                인증 코드 복사
              </button>
              <a
                className="primary"
                href={missionQr.imageUrl}
                download={`${missionQr.title}-qr.png`}
              >
                QR 이미지 저장
              </a>
            </div>
            <section className="qrUsageHistory">
              <div>
                <h3>최근 사용 이력</h3>
                <button
                  type="button"
                  className="textButton"
                  onClick={() => loadMissionQrHistory(missionQr.missionId)}
                  disabled={missionQrHistoryLoading}
                >
                  새로고침
                </button>
              </div>
              {missionQrHistoryLoading ? (
                <p>사용 이력을 불러오는 중입니다.</p>
              ) : missionQrHistory.length === 0 ? (
                <p>아직 이 QR 미션을 인증한 참가자가 없습니다.</p>
              ) : (
                <ul>
                  {missionQrHistory.map((item) => (
                    <li key={item.id}>
                      <span
                        className={`qrUsageStatus ${item.status.toLowerCase()}`}
                      >
                        {item.status === "APPROVED"
                          ? "성공"
                          : item.status === "REJECTED"
                            ? "실패"
                            : "확인 중"}
                      </span>
                      <b>{item.participant.nickname}</b>
                      <small>{item.participant.email ?? "이메일 없음"}</small>
                      <time>
                        {new Date(item.submittedAt).toLocaleString("ko-KR")}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </section>
        </div>
      )}
      {open && (
        <div className="backdrop" onMouseDown={() => setOpen(false)}>
          <form
            className="modal"
            onSubmit={saveMission}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modalHead">
              <div>
                <em>{editing ? "EDIT MISSION" : "NEW MISSION"}</em>
                <h2>{editing ? "미션 수정" : "새 미션 추가"}</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)}>
                ×
              </button>
            </div>
            <label>
              미션명
              <input
                name="title"
                required
                defaultValue={editing?.title ?? missionDraft?.title}
                placeholder="예: 오늘의 파란색"
              />
            </label>
            <label>
              설명
              <textarea
                name="description"
                required
                defaultValue={editing?.description ?? missionDraft?.description}
                placeholder="참여자가 이해하기 쉬운 행동을 적어주세요."
              />
            </label>
            <div className="grid">
              <label>
                범위
                <select
                  name="scope"
                  defaultValue={
                    editing?.scope ?? missionDraft?.scope ?? "COMMON"
                  }
                >
                  <option value="COMMON">공통</option>
                  <option value="REGION">지역</option>
                  <option value="EVENT">이벤트</option>
                </select>
              </label>
              <label>
                유형
                <input
                  name="category"
                  required
                  defaultValue={
                    editing?.category ?? missionDraft?.category ?? "관찰"
                  }
                />
              </label>
              <label>
                난이도
                <select
                  name="difficulty"
                  defaultValue={difficultyValue[editing?.difficulty ?? 1]}
                >
                  <option value="EASY">쉬움 · 10P</option>
                  <option value="NORMAL">보통 · 20P</option>
                  <option value="HARD">어려움 · 30P</option>
                  <option value="SPECIAL">특별 · 50P</option>
                </select>
              </label>
              <label>
                인증 방식
                <select
                  name="verificationType"
                  value={formVerificationType}
                  onChange={(event) =>
                    setFormVerificationType(event.target.value)
                  }
                >
                  <option value="PHOTO">사진</option>
                  <option value="GPS">GPS</option>
                  <option value="GPS_STAY">GPS 체류</option>
                  <option value="QUIZ">문제</option>
                  <option value="TEXT">텍스트 기록</option>
                  <option value="TIMER">타이머</option>
                  <option value="QR_SCAN">QR 스캔</option>
                  <option value="MANUAL">직접 확인</option>
                </select>
              </label>
              {formVerificationType === "PHOTO" && (
                <label className="verificationSetting">
                  사진 판정 방식
                  <select
                    name="photoVerificationMode"
                    defaultValue={
                      editing?.verificationPolicy?.photoVerificationMode ??
                      "RECORD"
                    }
                  >
                    <option value="RECORD">
                      자유 기록형 · 사진 제출로 완료
                    </option>
                    <option value="AI">정답형 · AI가 대상 확인</option>
                  </select>
                  <small>
                    특정 사물이나 색처럼 정답이 분명할 때만 AI 판정형을
                    사용하세요. 장소 기록, 분위기, 오래된 흔적처럼 주관적인
                    미션은 자유 기록형이 적합합니다.
                  </small>
                </label>
              )}
              {formVerificationType === "QUIZ" && (
                <label className="verificationSetting">
                  정답
                  <input
                    name="quizAnswer"
                    required
                    maxLength={100}
                    defaultValue={editing?.verificationPolicy?.answer ?? ""}
                    placeholder="참가자가 입력해야 할 정답"
                  />
                  <small>
                    띄어쓰기 앞뒤와 영문 대소문자는 구분하지 않습니다. 정답은
                    참가자 화면에 공개되지 않습니다.
                  </small>
                </label>
              )}
              {formVerificationType === "GPS" && (
                <div className="verificationSetting gpsMissionSettings">
                  <strong>GPS 방문 인증 장소</strong>
                  <label>
                    장소명
                    <input
                      name="placeTitle"
                      required
                      defaultValue={
                        editing?.place?.title ?? missionDraft?.placeTitle ?? ""
                      }
                      placeholder="예: 안성맞춤랜드"
                    />
                  </label>
                  <label>
                    주소
                    <input
                      name="placeAddress"
                      defaultValue={
                        editing?.place?.address ??
                        missionDraft?.placeAddress ??
                        ""
                      }
                      placeholder="장소 주소"
                    />
                  </label>
                  <label>
                    위도
                    <input
                      name="latitude"
                      type="number"
                      step="0.000001"
                      min="-90"
                      max="90"
                      required
                      defaultValue={
                        editing?.place?.latitude ?? missionDraft?.latitude ?? ""
                      }
                      placeholder="37.008000"
                    />
                  </label>
                  <label>
                    경도
                    <input
                      name="longitude"
                      type="number"
                      step="0.000001"
                      min="-180"
                      max="180"
                      required
                      defaultValue={
                        editing?.place?.longitude ??
                        missionDraft?.longitude ??
                        ""
                      }
                      placeholder="127.279700"
                    />
                  </label>
                  <label>
                    인증 반경(m)
                    <input
                      name="radiusM"
                      type="number"
                      min="30"
                      max="1000"
                      required
                      defaultValue={
                        editing?.radiusM ?? missionDraft?.radiusM ?? 100
                      }
                    />
                  </label>
                  <label>
                    허용 GPS 오차(m)
                    <input
                      name="maximumAccuracyM"
                      type="number"
                      min="10"
                      max="200"
                      required
                      defaultValue={
                        editing?.verificationPolicy?.maximumAccuracyM ?? 50
                      }
                    />
                  </label>
                  <small>
                    사용자가 인증 반경 안에 있고 GPS 오차가 허용값 이하일 때만
                    완료됩니다.
                  </small>
                  {missionDraft?.externalContentId && (
                    <small className="ktoMissionSource">
                      한국관광공사 콘텐츠를 기준으로 장소·주소·좌표가 자동
                      입력되었습니다. 같은 관광지는 중복 등록되지 않습니다.
                    </small>
                  )}
                </div>
              )}
              {formVerificationType === "TEXT" && (
                <label className="verificationSetting">
                  최대 글자 수
                  <input
                    name="textMaxLength"
                    type="number"
                    min="1"
                    max="100"
                    required
                    defaultValue={editing?.verificationPolicy?.maxLength ?? 100}
                  />
                  <small>
                    짧은 문장 기록을 위해 최대 100자까지 설정할 수 있습니다.
                  </small>
                </label>
              )}
              {formVerificationType === "TIMER" && (
                <label className="verificationSetting">
                  목표 시간(분)
                  <input
                    name="timerMinutes"
                    type="number"
                    min="1"
                    max="180"
                    required
                    defaultValue={Math.max(
                      1,
                      Math.round(
                        (editing?.verificationPolicy?.durationSeconds ?? 600) /
                          60,
                      ),
                    )}
                  />
                  <small>
                    시작 후 화면을 벗어나도 실제 경과 시간으로 측정됩니다.
                  </small>
                </label>
              )}
              {(formVerificationType === "GPS_STAY" ||
                formVerificationType === "TIMER") && (
                <>
                  <label>
                    최소 시간(분)
                    <input
                      name="estimatedMinutesMin"
                      type="number"
                      min="1"
                      required
                      defaultValue={editing?.estimatedMinutesMin ?? 5}
                    />
                  </label>
                  <label>
                    최대 시간(분)
                    <input
                      name="estimatedMinutesMax"
                      type="number"
                      min="1"
                      required
                      defaultValue={editing?.estimatedMinutesMax ?? 10}
                    />
                  </label>
                </>
              )}
              <label>
                운영 상태
                <select
                  name="status"
                  defaultValue={editing?.status ?? "ACTIVE"}
                >
                  <option value="ACTIVE">활성</option>
                  <option value="INACTIVE">비활성</option>
                  <option value="NEEDS_REVIEW">검토 필요</option>
                </select>
              </label>
              <label>
                연결 지역
                <select
                  name="regionId"
                  defaultValue={
                    editing?.regions[0]?.id ?? missionDraft?.regionId ?? ""
                  }
                >
                  <option value="">없음 · 공통 미션</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              비슷한 미션 그룹
              <input
                name="similarityGroup"
                defaultValue={editing?.similarityGroup ?? ""}
                placeholder="예: 색깔 수집"
              />
            </label>
            <div className="actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setOpen(false)}
              >
                취소
              </button>
              <button className="primary">
                {editing ? "변경 저장" : "미션 저장"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
