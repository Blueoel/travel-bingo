export interface Coordinates {
  readonly latitude: number;
  readonly longitude: number;
}

export interface GpsVerificationRule {
  readonly radiusM: number;
  readonly maximumAccuracyM: number;
  readonly maximumAgeMs: number;
}

export interface GpsVerificationInput {
  readonly target: Coordinates;
  readonly measured: Coordinates;
  readonly accuracyM: number;
  readonly measuredAt: Date;
  readonly receivedAt: Date;
  readonly rule: GpsVerificationRule;
}

export type GpsVerificationResult =
  | {
      readonly approved: true;
      readonly distanceM: number;
    }
  | {
      readonly approved: false;
      readonly code:
        | "INVALID_COORDINATES"
        | "INVALID_ACCURACY"
        | "LOCATION_TOO_OLD"
        | "LOCATION_TOO_INACCURATE"
        | "OUTSIDE_ALLOWED_RADIUS";
      readonly distanceM?: number;
    };

const EARTH_RADIUS_M = 6_371_000;

function isValidCoordinates(coordinates: Coordinates): boolean {
  return (
    Number.isFinite(coordinates.latitude) &&
    Number.isFinite(coordinates.longitude) &&
    coordinates.latitude >= -90 &&
    coordinates.latitude <= 90 &&
    coordinates.longitude >= -180 &&
    coordinates.longitude <= 180
  );
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function calculateHaversineDistanceMeters(
  start: Coordinates,
  end: Coordinates,
): number {
  if (!isValidCoordinates(start) || !isValidCoordinates(end)) {
    return Number.NaN;
  }

  const startLatitude = degreesToRadians(start.latitude);
  const endLatitude = degreesToRadians(end.latitude);
  const latitudeDelta = endLatitude - startLatitude;
  const longitudeDelta = degreesToRadians(end.longitude - start.longitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(haversine));
}

export function evaluateGpsVerification(
  input: GpsVerificationInput,
): GpsVerificationResult {
  if (
    !isValidCoordinates(input.target) ||
    !isValidCoordinates(input.measured)
  ) {
    return { approved: false, code: "INVALID_COORDINATES" };
  }

  if (!Number.isFinite(input.accuracyM) || input.accuracyM < 0) {
    return { approved: false, code: "INVALID_ACCURACY" };
  }

  const ageMs = input.receivedAt.getTime() - input.measuredAt.getTime();
  if (ageMs < 0 || ageMs > input.rule.maximumAgeMs) {
    return { approved: false, code: "LOCATION_TOO_OLD" };
  }

  if (input.accuracyM > input.rule.maximumAccuracyM) {
    return { approved: false, code: "LOCATION_TOO_INACCURATE" };
  }

  const distanceM = calculateHaversineDistanceMeters(
    input.target,
    input.measured,
  );
  if (distanceM > input.rule.radiusM) {
    return { approved: false, code: "OUTSIDE_ALLOWED_RADIUS", distanceM };
  }

  return { approved: true, distanceM };
}
