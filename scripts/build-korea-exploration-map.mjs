import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const sourceDirectory = process.argv[2];
const outputDirectory =
  process.argv[3] ?? "apps/participant-web/public/maps";

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

const points = features.flatMap((feature) =>
  geometryRings(feature.geometry).flat(),
);
const bounds = boundsOfRaw(points);

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

const metadata = [];
const groups = new Map();
for (const feature of features) {
  const code = String(feature.properties?.id ?? "");
  const name = String(feature.properties?.title ?? code);
  const rings = geometryRings(feature.geometry);
  const d = rings
    .map((ring) => {
      const simplified = simplifyClosedRing(ring, 180).map(project);
      return `${simplified
        .map(
          ([x, y], index) =>
            `${index === 0 ? "M" : "L"}${round(x)} ${round(y)}`,
        )
        .join(" ")} Z`;
    })
    .join(" ");
  const projectedPoints = rings.flat().map(project);
  const regionBounds = boundsOf(projectedPoints);
  const region = {
    code,
    name,
    province: feature.province,
    id: `region-${code}`,
    bounds: regionBounds,
    center: [
      round((regionBounds.minX + regionBounds.maxX) / 2),
      round((regionBounds.minY + regionBounds.maxY) / 2),
    ],
  };
  metadata.push(region);
  const pathElement = `<path id="${region.id}" class="region" data-code="${escapeXml(code)}" data-name="${escapeXml(name)}" data-province="${escapeXml(feature.province)}" d="${d}"><title>${escapeXml(feature.province)} ${escapeXml(name)}</title></path>`;
  const list = groups.get(feature.province) ?? [];
  list.push(pathElement);
  groups.set(feature.province, list);
}

const groupMarkup = [...groups.entries()]
  .map(
    ([province, paths]) =>
      `<g id="province-${slug(province)}" class="province" data-province="${escapeXml(province)}">\n${paths.join("\n")}\n</g>`,
  )
  .join("\n");

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="map-title map-description">
  <title id="map-title">대한민국 시군구 탐험 지도</title>
  <desc id="map-description">각 시군구를 독립적으로 선택하고 사진으로 채울 수 있는 기능용 지도</desc>
  <metadata>
    Source: SGIS boundary data processed by StatGarten maps (2020).
    Derived dataset repository license: MIT, Copyright (c) 2022 StatGarten.
    Generated for Travel Bingo. Replace with the official 2025 SGIS boundary package before final release.
  </metadata>
  <style>
    .region {
      fill: #f7f2e6;
      stroke: #334638;
      stroke-width: 1.15;
      vector-effect: non-scaling-stroke;
      cursor: pointer;
      transition: fill .18s ease, opacity .18s ease;
    }
    .region:hover, .region:focus { fill: #dce9cb; outline: none; }
    .region[data-tier="bronze"] { stroke: #a96f3f; stroke-width: 2.2; }
    .region[data-tier="silver"] { stroke: #aeb5bd; stroke-width: 2.4; }
    .region[data-tier="gold"] { stroke: #d5a625; stroke-width: 2.8; }
  </style>
  <g id="korea-regions">
${groupMarkup}
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
      regionCount: metadata.length,
      viewBox: [0, 0, width, height],
      regions: metadata.sort((a, b) => a.code.localeCompare(b.code)),
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(`Generated ${metadata.length} regions in ${outputDirectory}`);

function geometryRings(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return geometry.coordinates;
  if (geometry.type === "MultiPolygon") return geometry.coordinates.flat();
  return [];
}

function simplifyClosedRing(points, tolerance) {
  if (points.length < 5) return points;
  const open = points.slice(0, -1);
  const simplified = simplify(open, tolerance);
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
  const bounds = boundsOfRaw(regionPoints);
  return {
    minX: round(bounds.minX),
    minY: round(bounds.minY),
    maxX: round(bounds.maxX),
    maxY: round(bounds.maxY),
  };
}

function boundsOfRaw(regionPoints) {
  const bounds = {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };
  for (const [x, y] of regionPoints) {
    if (x < bounds.minX) bounds.minX = x;
    if (x > bounds.maxX) bounds.maxX = x;
    if (y < bounds.minY) bounds.minY = y;
    if (y > bounds.maxY) bounds.maxY = y;
  }
  return bounds;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function slug(value) {
  return Buffer.from(value).toString("hex");
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
