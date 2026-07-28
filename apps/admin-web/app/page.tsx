"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Region = { id: string; name: string };
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
  verificationPolicy?: { type?: string };
  estimatedMinutesMin?: number | null;
  estimatedMinutesMax?: number | null;
  similarityGroup?: string | null;
  regions: Region[];
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
    [dailyIds, setDailyIds] = useState<string[]>([]);
  const [query, setQuery] = useState(""),
    [scope, setScope] = useState(""),
    [regionId, setRegionId] = useState("");
  const [view, setView] = useState<
    "catalog" | "daily" | "reviews" | "users"
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
  const [userStatus, setUserStatus] = useState("");
  const [userLoading, setUserLoading] = useState(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const params = useMemo(() => {
    const p = new URLSearchParams({ pageSize: "100" });
    if (query) p.set("q", query);
    if (scope) p.set("scope", scope);
    if (regionId) p.set("regionId", regionId);
    return p;
  }, [query, scope, regionId]);
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
      setDailyIds(((await c.json()) as { missionIds: string[] }).missionIds);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "목록을 불러오지 못했습니다.");
    }
  }
  useEffect(() => {
    void load();
  }, [params]);
  function showForm(mission: Mission | null = null) {
    setEditing(mission);
    setOpen(true);
  }
  async function saveMission(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    const result = await fetch(
      editing ? `${API}/admin/missions/${editing.id}` : `${API}/admin/missions`,
      {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json", "x-user-id": ADMIN },
        body: JSON.stringify({
          ...data,
          estimatedMinutesMin: Number(data.estimatedMinutesMin),
          estimatedMinutesMax: Number(data.estimatedMinutesMax),
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
          <span>지역 관리</span>
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
                  : view === "reviews"
                    ? "사진 검수"
                    : "사용자 관리"}
            </h1>
            <p>
              {view === "catalog"
                ? "공통·지역 미션을 등록하고 운영 상태를 관리합니다."
                : view === "daily"
                  ? "매일 무작위로 배치할 공통 미션 후보를 선택합니다."
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
                  활성 공통 미션 중 최소 25개를 선택하세요. 현재{" "}
                  <b>{dailyIds.length}개</b>가 선택되었습니다.
                </p>
              </div>
              <span>{dailyIds.length}/100</span>
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
                      </small>
                    </span>
                    <i>{checked ? "✓" : "+"}</i>
                  </label>
                );
              })}
            </div>
          </section>
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
                                {user.role === "ADMIN" ? "보호 계정" : "처리 완료"}
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
                                  onClick={() =>
                                    manageUser(user, "WITHDRAW")
                                  }
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
                defaultValue={editing?.title}
                placeholder="예: 오늘의 파란색"
              />
            </label>
            <label>
              설명
              <textarea
                name="description"
                required
                defaultValue={editing?.description}
                placeholder="참여자가 이해하기 쉬운 행동을 적어주세요."
              />
            </label>
            <div className="grid">
              <label>
                범위
                <select name="scope" defaultValue={editing?.scope ?? "COMMON"}>
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
                  defaultValue={editing?.category ?? "관찰"}
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
                  defaultValue={editing?.verificationPolicy?.type ?? "PHOTO"}
                >
                  <option value="PHOTO">사진</option>
                  <option value="GPS">GPS</option>
                  <option value="GPS_STAY">GPS 체류</option>
                  <option value="QUIZ">문제</option>
                  <option value="MANUAL">직접 확인</option>
                </select>
              </label>
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
                  defaultValue={editing?.regions[0]?.id ?? ""}
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
