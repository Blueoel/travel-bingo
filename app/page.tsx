"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";

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
  };
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
type AttractionRecommendation = {
  contentId: string;
  contentTypeId: string | null;
  title: string;
  address: string | null;
  imageUrl: string | null;
  latitude: number;
  longitude: number;
  source: "KTO" | "DATABASE";
};
type MissionDraft = {
  title: string;
  description: string;
  scope: "REGION";
  category: string;
  regionId: string;
};
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const PHOTO_API =
  process.env.NEXT_PUBLIC_PHOTO_REVIEW_API_URL ??
  "https://travel-bingo-walk.blueo03.chatgpt.site";
const ADMIN = "10000000-0000-4000-8000-000000000002";
const scopeName = { COMMON: "공통", REGION: "지역", EVENT: "이벤트" };
const difficultyName = ["", "쉬움", "보통", "어려움", "특별"];
const difficultyValue = ["EASY", "EASY", "NORMAL", "HARD", "SPECIAL"];

export default function AdminPage() {
  const [missions, setMissions] = useState<Mission[]>([]),
    [regions, setRegions] = useState<Region[]>([]),
    [dailyIds, setDailyIds] = useState<string[]>([]),
    [dailyMissions, setDailyMissions] = useState<Mission[]>([]);
  const [query, setQuery] = useState(""),
    [scope, setScope] = useState(""),
    [regionId, setRegionId] = useState(""),
    [missionStatus, setMissionStatus] = useState(""),
    [difficulty, setDifficulty] = useState(""),
    [kind, setKind] = useState(""),
    [similarityGroup, setSimilarityGroup] = useState(""),
    [dailyCandidate, setDailyCandidate] = useState("");
  const [view, setView] = useState<
    "catalog" | "daily" | "regions" | "reviews" | "users"
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
  const [zoomedPhoto, setZoomedPhoto] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [userSummary, setUserSummary] = useState<UserSummary>({
    total: 0,
    active: 0,
    suspended: 0,
    deleted: 0,
  });
  const [userQuery, setUserQuery] = useState("");
  const [regionQuery, setRegionQuery] = useState("");
  const [selectedRegionId, setSelectedRegionId] = useState("");
  const [attractionQuery, setAttractionQuery] = useState("");
  const [attractions, setAttractions] = useState<AttractionRecommendation[]>([]);
  const [attractionsLoading, setAttractionsLoading] = useState(false);
  const [missionDraft, setMissionDraft] = useState<MissionDraft | null>(null);
  const [userStatus, setUserStatus] = useState("");
  const [userLoading, setUserLoading] = useState(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [formVerificationType, setFormVerificationType] = useState("PHOTO");
  const params = useMemo(() => {
    const p = new URLSearchParams({ pageSize: "100" });
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
      setMissions(((await a.json()) as { items: Mission[] }).items);
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
  function showForm(mission: Mission | null = null) {
    setMissionDraft(null);
    setEditing(mission);
    setFormVerificationType(mission?.verificationPolicy?.type ?? "PHOTO");
    setOpen(true);
  }
  async function loadAttractions(regionId: string, q = attractionQuery) {
    if (!regionId) return;
    setSelectedRegionId(regionId);
    setAttractionsLoading(true);
    try {
      const params = new URLSearchParams({ limit: "12" });
      if (q.trim()) params.set("q", q.trim());
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
  function createMissionFromAttraction(attraction: AttractionRecommendation) {
    setEditing(null);
    setFormVerificationType("PHOTO");
    setMissionDraft({
      title: `${attraction.title} 방문하기`,
      description: `${attraction.title}을 방문해 인증 사진을 남겨보세요.`,
      scope: "REGION",
      category: "관광지 탐방",
      regionId: selectedRegionId,
    });
    setOpen(true);
  }
  async function saveMission(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    const verificationType = String(data.verificationType);
    const verificationPolicy =
      verificationType === "TEXT"
        ? { type: "TEXT", maxLength: Number(data.textMaxLength) }
        : verificationType === "TIMER"
          ? {
              type: "TIMER",
              durationSeconds: Number(data.timerMinutes) * 60,
            }
          : { type: verificationType };
    const result = await fetch(
      editing ? `${API}/admin/missions/${editing.id}` : `${API}/admin/missions`,
      {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json", "x-user-id": ADMIN },
        body: JSON.stringify({
          ...data,
          estimatedMinutesMin: Number(data.estimatedMinutesMin),
          estimatedMinutesMax: Number(data.estimatedMinutesMax),
          verificationPolicy,
          regionIds: data.regionId ? [data.regionId] : [],
          changeNote: editing ? "관리자 화면에서 수정" : "관리자 화면에서 생성",
        }),
      },
    );
    if (!result.ok) return setError(`저장 실패: ${await result.text()}`);
    setOpen(false);
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
        ? `${region.name} 지역 서비스를 활성화했습니다.`
        : `${region.name} 지역 서비스를 비활성화했습니다.`,
    );
    await load();
  }
  async function loadReviews() {
    try {
      const query = reviewMode === "history" ? "?status=history" : "";
      const result = await fetch(
        `${PHOTO_API}/api/admin/photo-reviews${query}`,
        {
          credentials: "include",
          headers: { "x-user-id": ADMIN },
        },
      );
      if (!result.ok) throw new Error("사진 검수 목록을 불러오지 못했습니다.");
      setReviews(((await result.json()) as { reviews: PhotoReview[] }).reviews);
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
    const reason = reviewReasons[id]?.trim();
    if (decision === "REJECTED" && !reason) {
      return setError("거절 사유를 먼저 선택해주세요.");
    }
    const result = await fetch(`${PHOTO_API}/api/admin/photo-reviews/${id}`, {
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
        ? "계정을 탈퇴 처리하고 개인정보를 익명화했습니다."
        : action === "SUSPEND"
          ? "계정 이용을 정지하고 로그인 세션을 종료했습니다."
          : "계정을 다시 활성화했습니다.",
    );
    await loadUsers();
  }
  const common = missions.filter((m) => m.scope === "COMMON").length,
    regional = missions.filter((m) => m.scope === "REGION").length,
    dailyCandidates = missions.filter(
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
          <b>walkbingo</b>
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
                <b>{missions.length}</b>
                <small>현재 검색 결과</small>
              </article>
              <article>
                <span>공통 미션</span>
                <b>{common}</b>
                <small>Daily 빙고 후보</small>
              </article>
              <article>
                <span>지역 미션</span>
                <b>{regional}</b>
                <small>지역 연결 미션</small>
              </article>
              <article>
                <span>활성 미션</span>
                <b className="green">
                  {missions.filter((m) => m.status === "ACTIVE").length}
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
            <section className="summary">
              <article>
                <span>전체 지역</span>
                <b>{regions.length}</b>
                <small>등록된 서비스 지역</small>
              </article>
              <article>
                <span>활성 지역</span>
                <b className="green">
                  {regions.filter((region) => region.status === "ACTIVE").length}
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
                <b>
                  {regions.filter((region) => !region.canActivate).length}
                </b>
                <small>콘텐츠 보강 필요</small>
              </article>
            </section>
            <section className="catalog regionCatalog">
              <div className="catalogHead">
                <div>
                  <h2>지역 서비스 준비 현황</h2>
                  <p>
                    활성 지역 미션 25개와 공개된 25칸 빙고판이 있어야
                    활성화할 수 있습니다.
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
                      <th>공개 빙고판</th>
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
                        <td>{region.publishedBoardCount ?? 0}개</td>
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
              {selectedRegionId && (
                <section className="attractionPanel">
                  <div className="catalogHead">
                    <div>
                      <h2>
                        {
                          regions.find(
                            (region) => region.id === selectedRegionId,
                          )?.name
                        }{" "}
                        관광지 추천
                      </h2>
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
                    <button className="secondary">검색</button>
                  </form>
                  {attractionsLoading ? (
                    <p className="attractionEmpty">관광지를 찾고 있습니다.</p>
                  ) : attractions.length ? (
                    <div className="attractionGrid">
                      {attractions.map((attraction) => (
                        <article key={`${attraction.source}-${attraction.contentId}`}>
                          {attraction.imageUrl ? (
                            <img
                              src={attraction.imageUrl}
                              alt={`${attraction.title} 관광지`}
                            />
                          ) : (
                            <div className="attractionPlaceholder">사진 없음</div>
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
                            <h3>{attraction.title}</h3>
                            <p>{attraction.address ?? "주소 정보 없음"}</p>
                            <button
                              className="primary"
                              onClick={() =>
                                createMissionFromAttraction(attraction)
                              }
                            >
                              이 장소로 미션 만들기
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
                      src={`${PHOTO_API}${review.imageUrl}`}
                      alt={`${review.missionTitle} 인증 사진`}
                      onClick={() =>
                        setZoomedPhoto(`${PHOTO_API}${review.imageUrl}`)
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
                        </select>
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
                  <option value="MANUAL">직접 확인</option>
                </select>
              </label>
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
              <label>
                최소 시간(분)
                <input
                  name="estimatedMinutesMin"
                  type="number"
                  min="1"
                  defaultValue={editing?.estimatedMinutesMin ?? 5}
                />
              </label>
              <label>
                최대 시간(분)
                <input
                  name="estimatedMinutesMax"
                  type="number"
                  min="1"
                  defaultValue={editing?.estimatedMinutesMax ?? 10}
                />
              </label>
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
