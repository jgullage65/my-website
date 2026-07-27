import {
  ASSISTANT_QUALITY_EVALUATION_DIMENSIONS,
  type AssistantQualityDimensionEvaluation,
  type AssistantQualityEvaluationDimension,
  type AssistantQualityEvaluationRating,
} from "./evaluationContracts";

export type ParsedAssistantQualityEvaluation = {
  overallScore: number | null;
  passed: boolean | null;
  summary: string;
  strengths: string[];
  issues: string[];
  dimensions: AssistantQualityDimensionEvaluation[];
};

const VALID_DIMENSIONS = new Set<AssistantQualityEvaluationDimension>(
  ASSISTANT_QUALITY_EVALUATION_DIMENSIONS,
);

const VALID_RATINGS = new Set<AssistantQualityEvaluationRating>([
  "excellent",
  "good",
  "needs_improvement",
  "poor",
  "not_scored",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJsonObject(rawResponse: string): Record<string, unknown> {
  const normalized = rawResponse.trim();

  if (!normalized) {
    throw new Error("empty_assistant_quality_evaluation_response");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(normalized);
  } catch {
    throw new Error("invalid_assistant_quality_evaluation_json");
  }

  if (!isRecord(parsed)) {
    throw new Error("invalid_assistant_quality_evaluation_shape");
  }

  return parsed;
}

function parseNullableScore(value: unknown, field: string): number | null {
  if (value === null) {
    return null;
  }

  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 100
  ) {
    throw new Error(`invalid_assistant_quality_${field}`);
  }

  return value;
}

function parseNullableBoolean(value: unknown, field: string): boolean | null {
  if (value === null || typeof value === "boolean") {
    return value;
  }

  throw new Error(`invalid_assistant_quality_${field}`);
}

function parseRequiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`invalid_assistant_quality_${field}`);
  }

  return value.trim();
}

function parseStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`invalid_assistant_quality_${field}`);
  }

  return value.map((item, index) =>
    parseRequiredString(item, `${field}_${index}`),
  );
}

function expectedRatingForScore(
  score: number | null,
): AssistantQualityEvaluationRating {
  if (score === null) {
    return "not_scored";
  }

  if (score >= 90) {
    return "excellent";
  }

  if (score >= 75) {
    return "good";
  }

  if (score >= 50) {
    return "needs_improvement";
  }

  return "poor";
}

function parseDimension(
  value: unknown,
  index: number,
): AssistantQualityDimensionEvaluation {
  if (!isRecord(value)) {
    throw new Error(`invalid_assistant_quality_dimension_${index}`);
  }

  if (
    typeof value.dimension !== "string" ||
    !VALID_DIMENSIONS.has(value.dimension as AssistantQualityEvaluationDimension)
  ) {
    throw new Error(`invalid_assistant_quality_dimension_name_${index}`);
  }

  if (
    typeof value.rating !== "string" ||
    !VALID_RATINGS.has(value.rating as AssistantQualityEvaluationRating)
  ) {
    throw new Error(`invalid_assistant_quality_dimension_rating_${index}`);
  }

  const dimension = value.dimension as AssistantQualityEvaluationDimension;
  const score = parseNullableScore(value.score, `dimension_score_${dimension}`);
  const rating = value.rating as AssistantQualityEvaluationRating;
  const rationale = parseRequiredString(
    value.rationale,
    `dimension_rationale_${dimension}`,
  );
  const evidence = parseStringArray(
    value.evidence,
    `dimension_evidence_${dimension}`,
  );

  if (rating !== expectedRatingForScore(score)) {
    throw new Error(`inconsistent_assistant_quality_dimension_rating_${dimension}`);
  }

  if (score !== null && evidence.length === 0) {
    throw new Error(`missing_assistant_quality_dimension_evidence_${dimension}`);
  }

  if (score === null && evidence.length > 0) {
    throw new Error(`unexpected_assistant_quality_dimension_evidence_${dimension}`);
  }

  return {
    dimension,
    score,
    rating,
    rationale,
    evidence,
  };
}

function parseDimensions(value: unknown): AssistantQualityDimensionEvaluation[] {
  if (!Array.isArray(value)) {
    throw new Error("invalid_assistant_quality_dimensions");
  }

  if (value.length !== ASSISTANT_QUALITY_EVALUATION_DIMENSIONS.length) {
    throw new Error("incomplete_assistant_quality_dimensions");
  }

  const dimensions = value.map(parseDimension);
  const dimensionNames = new Set(dimensions.map((item) => item.dimension));

  if (dimensionNames.size !== ASSISTANT_QUALITY_EVALUATION_DIMENSIONS.length) {
    throw new Error("duplicate_assistant_quality_dimensions");
  }

  for (const expectedDimension of ASSISTANT_QUALITY_EVALUATION_DIMENSIONS) {
    if (!dimensionNames.has(expectedDimension)) {
      throw new Error(`missing_assistant_quality_dimension_${expectedDimension}`);
    }
  }

  return ASSISTANT_QUALITY_EVALUATION_DIMENSIONS.map((expectedDimension) => {
    const evaluation = dimensions.find(
      (item) => item.dimension === expectedDimension,
    );

    if (!evaluation) {
      throw new Error(`missing_assistant_quality_dimension_${expectedDimension}`);
    }

    return evaluation;
  });
}

export function parseAssistantQualityEvaluationResponse(
  rawResponse: string,
): ParsedAssistantQualityEvaluation {
  const parsed = parseJsonObject(rawResponse);
  const overallScore = parseNullableScore(parsed.overallScore, "overall_score");
  const passed = parseNullableBoolean(parsed.passed, "passed");
  const dimensions = parseDimensions(parsed.dimensions);
  const scoredDimensions = dimensions.filter((dimension) => dimension.score !== null);

  if (overallScore === null && passed !== null) {
    throw new Error("inconsistent_assistant_quality_pass_state");
  }

  if (overallScore !== null && passed === null) {
    throw new Error("missing_assistant_quality_pass_state");
  }

  if (overallScore !== null && scoredDimensions.length === 0) {
    throw new Error("unsupported_assistant_quality_overall_score");
  }

  return {
    overallScore,
    passed,
    summary: parseRequiredString(parsed.summary, "summary"),
    strengths: parseStringArray(parsed.strengths, "strengths"),
    issues: parseStringArray(parsed.issues, "issues"),
    dimensions,
  };
}
