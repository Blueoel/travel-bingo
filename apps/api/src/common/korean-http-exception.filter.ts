import {
  Catch,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";

type HttpResponse = {
  status(code: number): HttpResponse;
  json(body: unknown): void;
};

const ENGLISH = /[A-Za-z]{3,}/;

@Catch(HttpException)
export class KoreanHttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<HttpResponse>();
    const status = exception.getStatus();
    const body = exception.getResponse();
    const source = typeof body === "string" ? body : readMessage(body);
    const message = localize(source, status);

    response.status(status).json({
      statusCode: status,
      message,
      error: statusLabel(status),
    });
  }
}

function readMessage(body: object): string {
  if (!("message" in body)) return "";
  const value = body.message;
  return Array.isArray(value) ? value.join(" ") : typeof value === "string" ? value : "";
}

function localize(message: string, status: number): string {
  if (message && !ENGLISH.test(message)) return message;
  if (/session|unauthorized|authentication/i.test(message) || status === HttpStatus.UNAUTHORIZED) return "로그인이 만료되었어요. 다시 로그인해주세요.";
  if (/photo|image|jpeg|png|webp/i.test(message)) return "사진을 처리하지 못했어요. 지원되는 사진인지 확인해주세요.";
  if (/location|latitude|longitude|gps/i.test(message)) return "위치 정보를 확인하지 못했어요. 위치 권한과 GPS 상태를 확인해주세요.";
  if (/already completed/i.test(message) || status === HttpStatus.CONFLICT) return "이미 처리되었거나 현재 상태에서는 진행할 수 없는 요청이에요.";
  if (status === HttpStatus.NOT_FOUND) return "요청한 정보를 찾지 못했어요.";
  if (status === HttpStatus.FORBIDDEN) return "이 작업을 수행할 권한이 없어요.";
  if (status === HttpStatus.BAD_REQUEST) return "입력 내용을 다시 확인해주세요.";
  return "요청을 처리하지 못했어요. 잠시 후 다시 시도해주세요.";
}

function statusLabel(status: number): string {
  if (status === HttpStatus.BAD_REQUEST) return "잘못된 요청";
  if (status === HttpStatus.UNAUTHORIZED) return "로그인 필요";
  if (status === HttpStatus.FORBIDDEN) return "권한 없음";
  if (status === HttpStatus.NOT_FOUND) return "정보 없음";
  if (status === HttpStatus.CONFLICT) return "처리 충돌";
  return "요청 처리 오류";
}
