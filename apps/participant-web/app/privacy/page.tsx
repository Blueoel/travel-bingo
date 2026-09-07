import "../legal.css";

export default function PrivacyPage() {
  return <main className="legal-page"><article className="legal-document">
    <a className="legal-back" href="/">← 앱으로 돌아가기</a>
    <header><small>TRAVEL BINGO</small><h1>개인정보처리방침</h1><p>시행일: 2026년 9월 7일</p></header>
    <section><h2>1. 개인정보 처리 목적</h2><p>Travel Bingo 운영팀(이하 “운영팀”)은 회원 가입과 로그인, 여행·산책 미션 제공 및 인증, 포인트·랭킹·친구 기능 운영, 고객 문의와 부정 이용 방지, 서비스 품질 개선을 위해 필요한 범위에서 개인정보를 처리합니다.</p></section>
    <section><h2>2. 처리하는 개인정보</h2><table><thead><tr><th>구분</th><th>항목</th><th>목적</th></tr></thead><tbody>
      <tr><td>필수</td><td>이메일 주소, 닉네임, 암호화된 비밀번호</td><td>계정 생성, 로그인, 본인 식별</td></tr>
      <tr><td>선택</td><td>프로필 사진</td><td>프로필 및 랭킹 표시</td></tr>
      <tr><td>미션 이용</td><td>인증 사진, 텍스트 기록, QR 인증 정보</td><td>미션 판정, 빙고판·여행 기록 제공</td></tr>
      <tr><td>위치 기능</td><td>현재 위치, 위치 정확도, 측정 시각, 이동 거리·시간</td><td>주변 지역 추천, 장소·거리·체류 미션 인증</td></tr>
      <tr><td>자동 생성</td><td>접속 기록, 세션 정보, 오류 기록</td><td>로그인 유지, 보안, 오류 대응</td></tr>
    </tbody></table><p>카메라·사진·위치 정보는 해당 기능을 사용할 때 권한을 받은 뒤 처리하며, 권한을 거부하면 관련 미션이나 기능을 이용할 수 없습니다.</p></section>
    <section><h2>3. 보유 및 이용 기간</h2><ul><li>회원 정보와 미션 기록: 회원 탈퇴 시까지</li><li>문의·신고 처리 기록: 처리 완료 후 3년</li><li>접속 기록: 생성일로부터 3개월</li></ul><p>다만 관계 법령에 보존 의무가 있거나 분쟁 처리를 위해 필요한 경우 해당 기간 동안 분리하여 보관한 뒤 파기합니다.</p></section>
    <section><h2>4. 제3자 제공 및 처리 위탁</h2><p>운영팀은 원칙적으로 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 서비스 운영을 위해 다음 업체의 시스템을 이용합니다.</p><table><thead><tr><th>업체</th><th>업무</th><th>처리 정보</th></tr></thead><tbody>
      <tr><td>Render</td><td>API 서버 운영</td><td>서비스 이용 및 접속 정보</td></tr>
      <tr><td>Neon</td><td>데이터베이스 운영</td><td>회원·미션·문의 정보</td></tr>
      <tr><td>OpenAI Sites</td><td>웹 앱 제공</td><td>웹 서비스 접속 정보</td></tr>
      <tr><td>Google Gemini API</td><td>사진 미션 판정</td><td>사용자가 제출한 미션 사진</td></tr>
    </tbody></table><p>위탁 업체나 업무가 변경되면 이 방침을 통해 알립니다. 사진 미션을 제출하면 판정에 필요한 사진이 국외에 위치한 시스템에서 처리될 수 있습니다.</p></section>
    <section><h2>5. 위치정보 처리</h2><p>위치정보는 주변 지역 추천과 GPS 기반 미션 인증을 위해 사용합니다. 미션 인증 기록에는 위치 좌표·정확도·측정 시각이 포함될 수 있으며, 목적을 벗어나 이용하지 않습니다. 위치 권한은 휴대전화 설정에서 언제든 철회할 수 있습니다.</p></section>
    <section><h2>6. 사진과 카메라 이용</h2><ul><li>카메라: QR 코드 스캔과 현장 인증 사진 촬영</li><li>사진: 앨범에서 인증 사진 선택과 프로필 사진 설정</li></ul><p>타인의 얼굴, 차량번호 등 불필요한 개인정보가 포함되지 않도록 촬영해주세요.</p></section>
    <section><h2>7. 이용자의 권리</h2><p>이용자는 앱의 마이페이지에서 정보를 확인·수정하고 회원 탈퇴를 요청할 수 있습니다. 열람, 정정, 삭제, 처리 정지 및 위치정보 관련 문의는 마이페이지의 <b>신고·문의</b>를 이용해주세요.</p></section>
    <section><h2>8. 파기 절차와 안전성 확보</h2><p>보유 기간이 끝난 정보는 복구할 수 없는 방식으로 삭제합니다. 운영팀은 비밀번호 암호화, 접근 권한 제한, 인증 세션 관리, 통신 구간 보호 등 합리적인 보호조치를 적용합니다.</p></section>
    <section><h2>9. 개인정보 보호 문의</h2><p>개인정보 및 위치정보 관리 담당: Travel Bingo 운영팀<br/>접수 방법: 앱 마이페이지 → 신고·문의 → 개인정보·계정 문의</p></section>
    <section className="legal-notice"><h2>방침 변경 안내</h2><p>중요한 내용이 변경되면 시행 전에 앱 공지로 안내합니다.</p></section>
  </article></main>;
}
