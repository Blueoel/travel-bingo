import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import polygonClipping from "polygon-clipping";

const sourceDirectory = process.argv[2];
const outputDirectory =
  process.argv[3] ?? "apps/participant-web/public/maps";
const boundarySimplificationToleranceM = 900;
const landSimplificationToleranceM = 2500;
const minimumCityIslandAreaM2 = 1_000_000;
const minimumBackgroundIslandAreaM2 = 100_000_000;

if (!sourceDirectory) {
  throw new Error(
    "Usage: node scripts/build-korea-exploration-map.mjs SOURCE_JSON_DIRECTORY [OUTPUT_DIRECTORY]",
  );
}

const provinceFiles = [
  "서울특별시_시군구_경계.json",
  "부산광역시_시군구_경계.json",
  "대구광역시_시군구_경계.json",
  "인천광역시_시군구_경계.json",
  "광주광역시_시군구_경계.json",
  "대전광역시_시군구_경계.json",
  "울산광역시_시군구_경계.json",
  "세종특별자치시_시군구_경계.json",
  "경기도_시군구_경계.json",
  "강원도_시군구_경계.json",
  "충청북도_시군구_경계.json",
  "충청남도_시군구_경계.json",
  "전라북도_시군구_경계.json",
  "전라남도_시군구_경계.json",
  "경상북도_시군구_경계.json",
  "경상남도_시군구_경계.json",
  "제주특별자치도_시군구_경계.json",
];

const metropolitanProvinceCodes = new Map([
  ["서울특별시", "11"],
  ["부산광역시", "21"],
  ["대구광역시", "22"],
  ["인천광역시", "23"],
  ["광주광역시", "24"],
  ["대전광역시", "25"],
  ["울산광역시", "26"],
  ["세종특별자치시", "29"],
]);

const features = [];
for (const file of provinceFiles) {
  const collection = JSON.parse(
    await readFile(path.join(sourceDirectory, file), "utf8"),
  );
  const province = file.replace("_시군구_경계.json", "");
  for (const feature of collection.features ?? []) {
    features.push({ ...feature, province });
  }
}

const allPoints = features.flatMap((feature) =>
  geometryRings(feature.geometry).flat(),
);
const bounds = boundsOfRaw(allPoints);
const width = 900;
const height = 1260;
const padding = 28;
const scale = Math.min(
  (width - padding * 2) / (bounds.maxX - bounds.minX),
  (height - padding * 2) / (bounds.maxY - bounds.minY),
);
const renderedWidth = (bounds.maxX - bounds.minX) * scale;
const renderedHeight = (bounds.maxY - bounds.minY) * scale;
const offsetX = (width - renderedWidth) / 2;
const offsetY = (height - renderedHeight) / 2;
const project = ([x, y]) => [
  offsetX + (x - bounds.minX) * scale,
  offsetY + (bounds.maxY - y) * scale,
];

const cityGroups = new Map();
for (const feature of features) {
  const metroCode = metropolitanProvinceCodes.get(feature.province);
  if (metroCode) {
    addCityFeature(cityGroups, {
      code: metroCode,
      name: feature.province,
      province: feature.province,
      cityType: "METROPOLITAN",
      feature,
    });
    continue;
  }

  const featureName = String(feature.properties?.title ?? "");
  const cityMatch = featureName.match(/^(.+?시)(?:\s|$)/);
  if (!cityMatch) continue;
  const cityName = cityMatch[1];
  const featureCode = String(feature.properties?.id ?? "");
  const code = featureName === cityName ? featureCode : `${featureCode.slice(0, 4)}0`;
  addCityFeature(cityGroups, {
    code,
    name: cityName,
    province: feature.province,
    cityType: "MUNICIPAL",
    feature,
  });
}

const cityRegions = [...cityGroups.values()]
  .map((city) => {
    const unionedGeometry = polygonClipping.union(
      ...city.features.map((feature) => geometryToMultiPolygon(feature.geometry)),
    );
    return {
      ...city,
      geometry: filterSmallPolygons(
        unionedGeometry,
        minimumCityIslandAreaM2,
      ),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name, "ko"));

const landGeometry = filterSmallPolygons(
  polygonClipping.union(
    ...features.map((feature) => geometryToMultiPolygon(feature.geometry)),
  ),
  minimumBackgroundIslandAreaM2,
);
const landPath = pathFromMultiPolygon(
  landGeometry,
  project,
  landSimplificationToleranceM,
);

const metadata = [];
const cityPaths = cityRegions.map((city) => {
  const rawPoints = city.geometry.flat(2);
  const projectedPoints = rawPoints.map(project);
  const regionBounds = boundsOf(projectedPoints);
  const id = `region-${city.code}`;
  metadata.push({
    code: city.code,
    name: city.name,
    province: city.province,
    cityType: city.cityType,
    id,
    bounds: regionBounds,
    center: [
      round((regionBounds.minX + regionBounds.maxX) / 2),
      round((regionBounds.minY + regionBounds.maxY) / 2),
    ],
  });
  return `<path id="${id}" class="region city-region" data-code="${escapeXml(city.code)}" data-name="${escapeXml(city.name)}" data-province="${escapeXml(city.province)}" data-city-type="${city.cityType}" d="${pathFromMultiPolygon(city.geometry, project)}"><title>${escapeXml(city.province)} ${escapeXml(city.name)}</title></path>`;
});

const dokdoRing = geometryRings(
  features.find(
    (feature) =>
      feature.province === "경상북도" &&
      String(feature.properties?.title ?? "") === "울릉군",
  )?.geometry,
)
  .map((ring) => ({ ring, bounds: boundsOfRaw(ring) }))
  .sort((a, b) => b.bounds.maxX - a.bounds.maxX)[0];
const dokdoCenter = dokdoRing
  ? project([
      (dokdoRing.bounds.minX + dokdoRing.bounds.maxX) / 2,
      (dokdoRing.bounds.minY + dokdoRing.bounds.maxY) / 2,
    ])
  : [872, 398];

const municipalCityCount = cityRegions.filter(
  (city) => city.cityType === "MUNICIPAL",
).length;
const metropolitanCityCount = cityRegions.filter(
  (city) => city.cityType === "METROPOLITAN",
).length;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="map-title map-description">
  <title id="map-title">대한민국 도시 탐험 지도</title>
  <desc id="map-description">군 지역은 내부 경계 없이 배경으로 표시하고 77개 일반·행정시와 8개 특별·광역·특별자치시를 선택할 수 있는 지도</desc>
  <metadata>
    Source: SGIS boundary data processed by StatGarten maps (2020).
    Derived dataset repository license: MIT, Copyright (c) 2022 StatGarten.
    City boundaries are dissolved from the source administrative polygons.
  </metadata>
  <style>
    .land-background {
      fill: #eee9dd;
      stroke: #829083;
      stroke-width: 1.2;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
    }
    .city-region {
      fill: #f7f2e6;
      fill-opacity: .96;
      stroke: #65746a;
      stroke-width: .8;
      vector-effect: non-scaling-stroke;
      cursor: pointer;
      transition: fill .18s ease, opacity .18s ease;
    }
    .city-region:hover, .city-region:focus { fill: #dce9cb; outline: none; }
    .dokdo-marker { fill: #506756; stroke: #fffdf8; stroke-width: 1.4; vector-effect: non-scaling-stroke; }
    .dokdo-label { fill: #506756; font: 700 11px sans-serif; }
  </style>
  <g id="korea-land-background">
    <path class="land-background" d="${landPath}" />
  </g>
  <g id="korea-city-regions">
${cityPaths.join("\n")}
  </g>
  <g id="dokdo" aria-label="독도">
    <circle class="dokdo-marker" cx="${round(dokdoCenter[0])}" cy="${round(dokdoCenter[1])}" r="4.5" />
    <text class="dokdo-label" x="${round(dokdoCenter[0] - 10)}" y="${round(dokdoCenter[1] - 9)}">독도</text>
  </g>
</svg>
`;

await mkdir(outputDirectory, { recursive: true });
await writeFile(path.join(outputDirectory, "korea-sigungu.svg"), svg, "utf8");
await writeFile(
  path.join(outputDirectory, "korea-sigungu.meta.json"),
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      sourceYear: 2020,
      source: "StatGarten maps, derived from SGIS Open API",
      sourceUrl: "https://github.com/statgarten/maps",
      license: "MIT",
      layerType: "CITY",
      boundarySimplificationToleranceM,
      landSimplificationToleranceM,
      minimumCityIslandAreaM2,
      minimumBackgroundIslandAreaM2,
      municipalCityCount,
      metropolitanCityCount,
      regionCount: metadata.length,
      dokdo: {
        center: dokdoCenter.map(round),
        preservedAsMarker: true,
      },
      viewBox: [0, 0, width, height],
      regions: metadata.sort((a, b) => a.code.localeCompare(b.code)),
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(
  `Generated ${metadata.length} city regions (${municipalCityCount} municipal + ${metropolitanCityCount} metropolitan) in ${outputDirectory}`,
);

function addCityFeature(groups, city) {
  const key = `${city.province}:${city.name}`;
  const existing = groups.get(key);
  if (existing) {
    existing.features.push(city.feature);
    if (city.code < existing.code) existing.code = city.code;
    return;
  }
  groups.set(key, {
    code: city.code,
    name: city.name,
    province: city.province,
    cityType: city.cityType,
    features: [city.feature],
  });
}

function geometryToMultiPolygon(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  return [];
}

function geometryRings(geometry) {
  return geometryToMultiPolygon(geometry).flat();
}

function pathFromMultiPolygon(
  multiPolygon,
  projectPoint,
  tolerance = boundarySimplificationToleranceM,
) {
  return multiPolygon
    .flatMap((polygon) => polygon)
    .map((ring) => {
      const simplified = simplifyClosedRing(
        ring,
        tolerance,
      ).map(projectPoint);
      return `${simplified
        .map(
          ([x, y], index) =>
            `${index === 0 ? "M" : "L"}${round(x)} ${round(y)}`,
        )
        .join(" ")} Z`;
    })
    .join(" ");
}

function filterSmallPolygons(multiPolygon, minimumAreaM2) {
  if (multiPolygon.length <= 1) return multiPolygon;
  const sorted = multiPolygon
    .map((polygon) => ({
      polygon,
      area: Math.abs(ringArea(polygon[0] ?? [])),
    }))
    .sort((a, b) => b.area - a.area);
  return sorted
    .filter((entry, index) => index === 0 || entry.area >= minimumAreaM2)
    .map((entry) => entry.polygon);
}

function ringArea(ring) {
  let area = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[(index + 1) % ring.length];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

function simplifyClosedRing(points, tolerance) {
  if (points.length < 5) return points;
  const open = points.slice(0, -1);
  const simplified = simplify(open, tolerance);
  if (simplified.length < 3) return points;
  return [...simplified, simplified[0]];
}

function simplify(points, tolerance) {
  if (points.length <= 2) return points;
  const sqTolerance = tolerance * tolerance;
  const markers = new Uint8Array(points.length);
  markers[0] = 1;
  markers[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let maxDistance = 0;
    let index = 0;
    for (let i = first + 1; i < last; i += 1) {
      const distance = segmentDistanceSquared(
        points[i],
        points[first],
        points[last],
      );
      if (distance > maxDistance) {
        index = i;
        maxDistance = distance;
      }
    }
    if (maxDistance > sqTolerance) {
      markers[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, index) => markers[index]);
}

function segmentDistanceSquared(point, start, end) {
  let x = start[0];
  let y = start[1];
  let dx = end[0] - x;
  let dy = end[1] - y;
  if (dx || dy) {
    const t =
      ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = end[0];
      y = end[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = point[0] - x;
  dy = point[1] - y;
  return dx * dx + dy * dy;
}

function boundsOf(regionPoints) {
  const regionBounds = boundsOfRaw(regionPoints);
  return {
    minX: round(regionBounds.minX),
    minY: round(regionBounds.minY),
    maxX: round(regionBounds.maxX),
    maxY: round(regionBounds.maxY),
  };
}

function boundsOfRaw(regionPoints) {
  const regionBounds = {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };
  for (const [x, y] of regionPoints) {
    if (x < regionBounds.minX) regionBounds.minX = x;
    if (x > regionBounds.maxX) regionBounds.maxX = x;
    if (y < regionBounds.minY) regionBounds.minY = y;
    if (y > regionBounds.maxY) regionBounds.maxY = y;
  }
  return regionBounds;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
