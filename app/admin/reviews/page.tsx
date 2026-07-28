"use client";

import { useCallback, useEffect, useState } from "react";

type Review = {
  id: string;
  missionTitle: string;
  confidence: number;
  evidence: string[];
  failureReasons: string[];
  retryGuide: string | null;
  submittedAt: string;
  imageUrl: string;
};

export default function PhotoReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [message, setMessage] = useState("검수 대기 사진을 불러오는 중입니다.");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/photo-reviews");
    if (!response.ok) {
      setMessage("관리자 권한으로 로그인한 뒤 다시 확인해주세요.");
      return;
    }
    const result = (await response.json()) as { reviews: Review[] };
    setReviews(result.reviews);
    setMessage(result.reviews.length ? "" : "현재 검수 대기 사진이 없습니다.");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (id: string, decision: "APPROVED" | "REJECTED") => {
    const response = await fetch(`/api/admin/photo-reviews/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    if (!response.ok) {
      setMessage("판정을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    setReviews((current) => current.filter((review) => review.id !== id));
  };

  return (
    <main className="review-admin">
      <header>
        <p>TRAVEL BINGO ADMIN</p>
        <h1>사진 인증 검수</h1>
        <a href="/">참여자 화면으로 돌아가기</a>
      </header>
      {message && <p className="review-message">{message}</p>}
      <section className="review-grid">
        {reviews.map((review) => (
          <article className="review-card" key={review.id}>
            <img
              src={review.imageUrl}
              alt={`${review.missionTitle} 인증 사진`}
            />
            <div>
              <h2>{review.missionTitle}</h2>
              <p>AI 신뢰도 {Math.round(review.confidence * 100)}%</p>
              {review.evidence.map((item) => (
                <small key={item}>근거: {item}</small>
              ))}
              {review.failureReasons.map((item) => (
                <small key={item}>확인 필요: {item}</small>
              ))}
            </div>
            <div className="review-actions">
              <button onClick={() => decide(review.id, "REJECTED")}>
                거절
              </button>
              <button onClick={() => decide(review.id, "APPROVED")}>
                승인
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
