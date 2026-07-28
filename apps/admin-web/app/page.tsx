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
  confidence: number;
  evidence: string[];
  failureReasons: string[];
  submittedAt: string;
  imageUrl: string;
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
  const [view, setView] = useState<"catalog" | "daily" | "reviews">("catalog"),
    [editing, setEditing] = useState<Mission | null>(null),
    [open, setOpen] = useState(false);
  const [reviews, setReviews] = useState<PhotoReview[]>([]);
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
      const result = await fetch(`${PHOTO_API}/api/admin/photo-reviews`, {
        credentials: "include",
        headers: { "x-user-id": ADMIN },
      });
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
    const result = await fetch(`${PHOTO_API}/api/admin/photo-reviews/${id}`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", "x-user-id": ADMIN },
      body: JSON.stringify({ decision }),
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
  }, [view]);
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
          <span>사용자</span>
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
                  : "사진 검수"}
            </h1>
            <p>
              {view === "catalog"
                ? "공통·지역 미션을 등록하고 운영 상태를 관리합니다."
                : view === "daily"
                  ? "매일 무작위로 배치할 공통 미션 후보를 선택합니다."
                  : "AI가 판단하기 어려운 사진 인증을 확인하고 승인하거나 거절합니다."}
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
        ) : (
          <section className="reviewPanel">
            <div className="catalogHead">
              <div>
                <h2>검수 대기 목록</h2>
                <p>AI 판정 근거와 사진을 비교한 뒤 최종 처리합니다.</p>
              </div>
              <mark>{reviews.length}건 대기</mark>
            </div>
            {reviews.length ? (
              <div className="reviewGrid">
                {reviews.map((review) => (
                  <article className="reviewCard" key={review.id}>
                    <img
                      src={`${PHOTO_API}${review.imageUrl}`}
                      alt={`${review.missionTitle} 인증 사진`}
                    />
                    <div>
                      <h2>{review.missionTitle}</h2>
                      <p>
                        AI 신뢰도 <b>{Math.round(review.confidence * 100)}%</b>
                      </p>
                      {review.evidence.map((item) => (
                        <small key={item}>근거: {item}</small>
                      ))}
                      {review.failureReasons.map((item) => (
                        <small key={item}>확인 필요: {item}</small>
                      ))}
                    </div>
                    <footer>
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
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty">현재 검수 대기 사진이 없습니다.</p>
            )}
          </section>
        )}
      </main>
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
