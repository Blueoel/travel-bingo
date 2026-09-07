const ENGLISH_MESSAGE = /[A-Za-z]{3,}/;

const MESSAGE_MAP: Array<[RegExp, string]> = [
  [/session|unauthorized|authentication|로그인/i, "로그인이 만료되었어요. 다시 로그인해주세요."],
  [/password|credential/i, "이메일 주소 또는 비밀번호를 확인해주세요."],
  [/network|fetch|connection|timeout/i, "서버와 연결하지 못했어요. 네트워크 상태를 확인한 뒤 다시 시도해주세요."],
  [/photo|image|jpeg|png|webp|camera/i, "사진을 처리하지 못했어요. 지원되는 사진인지 확인한 뒤 다시 시도해주세요."],
  [/location|latitude|longitude|gps/i, "위치 정보를 확인하지 못했어요. 위치 권한과 GPS 상태를 확인해주세요."],
  [/not found/i, "요청한 정보를 찾지 못했어요. 화면을 새로고침한 뒤 다시 시도해주세요."],
  [/already completed|conflict/i, "이미 처리된 요청이에요. 화면을 새로고침해주세요."],
  [/invalid|required|unsupported|too long/i, "입력 내용을 다시 확인해주세요."],
  [/forbidden|administrator/i, "이 작업을 수행할 권한이 없어요."],
];

export function userMessage(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (!raw) return fallback;
  const mapped = MESSAGE_MAP.find(([pattern]) => pattern.test(raw));
  if (mapped) return mapped[1];
  return ENGLISH_MESSAGE.test(raw) ? fallback : raw;
}
