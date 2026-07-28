"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Region={id:string;name:string};
type Mission={id:string;title:string;description:string;category:string;points:number;scope:"COMMON"|"REGION"|"EVENT";status:"ACTIVE"|"INACTIVE"|"NEEDS_REVIEW";difficulty:number;kind:string;verificationPolicy?:{type?:string};regions:Region[]};
const API=process.env.NEXT_PUBLIC_API_URL??"http://localhost:4000/api/v1";
const ADMIN="10000000-0000-4000-8000-000000000002";
const scopeName={COMMON:"공통",REGION:"지역",EVENT:"이벤트"};
const difficultyName=["","쉬움","보통","어려움","특별"];

export default function AdminPage(){
  const [missions,setMissions]=useState<Mission[]>([]),[regions,setRegions]=useState<Region[]>([]);
  const [query,setQuery]=useState(""),[scope,setScope]=useState(""),[regionId,setRegionId]=useState("");
  const [open,setOpen]=useState(false),[error,setError]=useState("");
  const params=useMemo(()=>{const p=new URLSearchParams({pageSize:"100"});if(query)p.set("q",query);if(scope)p.set("scope",scope);if(regionId)p.set("regionId",regionId);return p},[query,scope,regionId]);
  async function load(){try{const headers={"x-user-id":ADMIN};const [a,b]=await Promise.all([fetch(`${API}/admin/missions?${params}`,{headers}),fetch(`${API}/admin/missions/regions`,{headers})]);if(!a.ok||!b.ok)throw new Error("관리자 API에 연결할 수 없습니다.");setMissions(((await a.json())as{items:Mission[]}).items);setRegions(await b.json());setError("")}catch(e){setError(e instanceof Error?e.message:"목록을 불러오지 못했습니다.")}}
  useEffect(()=>{void load()},[params]);
  async function create(e:FormEvent<HTMLFormElement>){e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget).entries());const result=await fetch(`${API}/admin/missions`,{method:"POST",headers:{"content-type":"application/json","x-user-id":ADMIN},body:JSON.stringify({...data,estimatedMinutesMin:Number(data.estimatedMinutesMin),estimatedMinutesMax:Number(data.estimatedMinutesMax),regionIds:data.regionId?[data.regionId]:[]})});if(!result.ok)return setError(`저장 실패: ${await result.text()}`);setOpen(false);await load()}
  const common=missions.filter(m=>m.scope==="COMMON").length,regional=missions.filter(m=>m.scope==="REGION").length;
  return <div className="shell">
    <aside><div className="brand"><i>W</i><b>walkbingo</b><small>ADMIN</small></div><nav><span>대시보드</span><span className="selected">미션 관리</span><span>빙고 구성</span><span>지역 관리</span><span>사용자</span></nav><div className="user">선　<b>관리자</b></div></aside>
    <main><header><div><em>CONTENT OPERATIONS</em><h1>미션 관리</h1><p>Daily 공통 미션과 지역 미션을 한곳에서 관리합니다.</p></div><button className="primary" onClick={()=>setOpen(true)}>＋ 새 미션</button></header>
      <section className="summary"><article><span>전체 미션</span><b>{missions.length}</b><small>현재 검색 결과</small></article><article><span>공통 미션</span><b>{common}</b><small>Daily 빙고 후보</small></article><article><span>지역 미션</span><b>{regional}</b><small>지역 연결 미션</small></article><article><span>활성 미션</span><b className="green">{missions.filter(m=>m.status==="ACTIVE").length}</b><small>현재 운영 중</small></article></section>
      <section className="catalog"><div className="catalogHead"><div><h2>미션 카탈로그</h2><p>검색·분류·내보내기가 가능합니다.</p></div><button className="secondary" onClick={async()=>{const r=await fetch(`${API}/admin/missions/export.csv?${params}`,{headers:{"x-user-id":ADMIN}});if(!r.ok)return setError("CSV를 내려받지 못했습니다.");const url=URL.createObjectURL(await r.blob());const a=document.createElement("a");a.href=url;a.download="travel-bingo-missions.csv";a.click();URL.revokeObjectURL(url)}}>CSV 내보내기</button></div>
        <div className="filters"><input aria-label="미션 검색" placeholder="미션명 또는 설명 검색" value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="범위" value={scope} onChange={e=>setScope(e.target.value)}><option value="">모든 범위</option><option value="COMMON">공통</option><option value="REGION">지역</option><option value="EVENT">이벤트</option></select><select aria-label="지역" value={regionId} onChange={e=>setRegionId(e.target.value)}><option value="">모든 지역</option>{regions.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
        {error&&<p className="error">{error} API 서버 실행 상태를 확인해 주세요.</p>}
        <div className="table"><table><thead><tr><th>미션</th><th>범위</th><th>유형</th><th>난이도</th><th>인증</th><th>포인트</th><th>상태</th></tr></thead><tbody>{missions.length?missions.map(m=><tr key={m.id}><td><b>{m.title}</b><small>{m.description}</small></td><td><mark className={m.scope.toLowerCase()}>{scopeName[m.scope]}</mark><small>{m.regions[0]?.name}</small></td><td>{m.category}</td><td>{difficultyName[m.difficulty]}</td><td>{m.verificationPolicy?.type??m.kind}</td><td><b>{m.points} P</b></td><td><mark className="activeStatus">{m.status==="ACTIVE"?"활성":m.status}</mark></td></tr>):<tr><td colSpan={7} className="empty">조건에 맞는 미션이 없습니다.</td></tr>}</tbody></table></div>
      </section></main>
    {open&&<div className="backdrop" onMouseDown={()=>setOpen(false)}><form className="modal" onSubmit={create} onMouseDown={e=>e.stopPropagation()}><div className="modalHead"><div><em>NEW MISSION</em><h2>새 미션 추가</h2></div><button type="button" onClick={()=>setOpen(false)}>×</button></div>
      <label>미션명<input name="title" required placeholder="예: 오늘의 파란색"/></label><label>설명<textarea name="description" required placeholder="참여자가 이해하기 쉬운 행동을 적어주세요."/></label>
      <div className="grid"><label>범위<select name="scope"><option value="COMMON">공통</option><option value="REGION">지역</option><option value="EVENT">이벤트</option></select></label><label>유형<input name="category" required defaultValue="관찰"/></label><label>난이도<select name="difficulty"><option value="EASY">쉬움 · 10P</option><option value="NORMAL">보통 · 20P</option><option value="HARD">어려움 · 30P</option><option value="SPECIAL">특별 · 50P</option></select></label><label>인증 방식<select name="verificationType"><option value="PHOTO">사진</option><option value="GPS">GPS</option><option value="GPS_STAY">GPS 체류</option><option value="QUIZ">문제</option><option value="MANUAL">직접 확인</option></select></label><label>최소 시간(분)<input name="estimatedMinutesMin" type="number" min="1" defaultValue="5"/></label><label>최대 시간(분)<input name="estimatedMinutesMax" type="number" min="1" defaultValue="10"/></label></div>
      <label>연결 지역<select name="regionId"><option value="">없음 · 공통 미션</option>{regions.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label><label>비슷한 미션 그룹<input name="similarityGroup" placeholder="예: 색깔 수집"/></label><input type="hidden" name="status" value="ACTIVE"/><div className="actions"><button type="button" className="secondary" onClick={()=>setOpen(false)}>취소</button><button className="primary">미션 저장</button></div>
    </form></div>}
  </div>
}
