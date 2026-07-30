UPDATE "Mission"
SET
  "radiusM" = 100,
  "description" = replace("description", '120m', '100m'),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "kind" = 'PLACE_VISIT'
  AND "radiusM" = 120;

UPDATE "SessionCell"
SET
  "missionSnapshot" = jsonb_set(
    jsonb_set("missionSnapshot", '{radiusM}', to_jsonb(100), true),
    '{description}',
    to_jsonb(replace(COALESCE("missionSnapshot"->>'description', ''), '120m', '100m')),
    true
  ),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "missionSnapshot"->>'kind' = 'PLACE_VISIT'
  AND ("missionSnapshot"->>'radiusM')::integer = 120;
