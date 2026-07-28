async function getBucket() {
  const { env } = await import("cloudflare:workers");
  if (!env.PHOTOS) throw new Error("R2 binding `PHOTOS` is unavailable.");
  return env.PHOTOS;
}

export async function storeReviewPhoto(input: {
  missionId: string;
  mimeType: string;
  base64: string;
}): Promise<string> {
  const key = `reviews/${input.missionId}/${crypto.randomUUID()}`;
  const bytes = Uint8Array.from(atob(input.base64), (character) =>
    character.charCodeAt(0),
  );
  const bucket = await getBucket();
  await bucket.put(key, bytes, {
    httpMetadata: { contentType: input.mimeType },
  });
  return key;
}

export async function getReviewPhoto(key: string) {
  const bucket = await getBucket();
  return bucket.get(key);
}
