const SEOUL_TIME_ZONE = "Asia/Seoul";

export function getSeoulDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SEOUL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Failed to calculate the Seoul calendar date");
  }

  return `${year}-${month}-${day}`;
}

export function toDatabaseDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}
