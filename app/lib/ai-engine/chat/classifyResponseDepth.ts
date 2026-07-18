export type ResponseDepth = "brief" | "standard" | "detailed";

export type ResponseIntent =
  | "focused_fact"
  | "focused_recommendation"
  | "explanation"
  | "comparison"
  | "planning"
  | "multiple_deliverables";

export type ResponseDepthDecision = {
  depth: ResponseDepth;
  intent: ResponseIntent;
  reason: string;
};

type IntentScore = {
  intent: ResponseIntent;
  score: number;
  matchedSignals: string[];
};

type ScoringRule = {
  intent: ResponseIntent;
  weight: number;
  signals: Array<{
    label: string;
    pattern: RegExp;
  }>;
};

const BREVITY_PHRASES = [
  /\bkeep it (?:brief|short|concise)\b/i,
  /\b(?:brief|short|concise) answer\b/i,
  /\bjust (?:answer|tell me) (?:directly|briefly)\b/i,
  /\banswer directly\b/i,
  /\bin (?:one|1) sentence\b/i,
  /\byes or no\b/i,
  /\bno (?:details|explanation)\b/i,
];

const DETAIL_PHRASES = [
  /\b(?:explain|describe) in detail\b/i,
  /\bgo into detail\b/i,
  /\bdetailed (?:answer|explanation|breakdown|analysis|plan)\b/i,
  /\b(?:complete|comprehensive|thorough) (?:breakdown|analysis|plan|strategy|guide|explanation|comparison)\b/i,
  /\bdeep(?:-| )dive\b/i,
  /\bstep(?:-| )by(?:-| )step\b/i,
  /\bfull (?:breakdown|analysis|plan|proposal|explanation|comparison)\b/i,
];

const INTENT_TIE_ORDER: ResponseIntent[] = [
  "planning",
  "multiple_deliverables",
  "comparison",
  "focused_recommendation",
  "explanation",
  "focused_fact",
];

const SCORING_RULES: ScoringRule[] = [
  {
    intent: "planning",
    weight: 5,
    signals: [
      { label: "strategy", pattern: /\bstrateg(?:y|ic)\b/i },
      { label: "roadmap", pattern: /\broadmap\b/i },
      {
        label: "implementation plan",
        pattern: /\bimplementation plan\b/i,
      },
      {
        label: "workflow plan",
        pattern:
          /\b(?:create|build|design|outline) (?:me )?(?:a )?(?:workflow|plan)\b/i,
      },
      {
        label: "plan",
        pattern: /\b(?:action plan|plan for|plan to)\b/i,
      },
      {
        label: "proposal or rollout",
        pattern: /\b(?:proposal|rollout)\b/i,
      },
      {
        label: "broad analysis",
        pattern: /\b(?:analy[sz]e|analysis)\b/i,
      },
    ],
  },
  {
    intent: "comparison",
    weight: 4,
    signals: [
      {
        label: "comparison",
        pattern:
          /\b(?:compare|comparison|versus|vs\.?|difference between)\b/i,
      },
    ],
  },
  {
    intent: "focused_recommendation",
    weight: 3,
    signals: [
      {
        label: "fit recommendation",
        pattern: /\b(?:good fit|right fit|best fit|good for)\b/i,
      },
      {
        label: "choice recommendation",
        pattern:
          /\b(?:should (?:i|we)|would you recommend|recommend(?:ation)?|which (?:one|option|product|service|plan)|which is better)\b/i,
      },
    ],
  },
  {
    intent: "explanation",
    weight: 3,
    signals: [
      {
        label: "how or explanation request",
        pattern:
          /\bhow (?:does|do|would|can|is|are|should)\b|\b(?:explain|describe)(?: how| why)?\b/i,
      },
    ],
  },
  {
    intent: "focused_fact",
    weight: 2,
    signals: [
      {
        label: "product or service definition",
        pattern: /\bwhat (?:does|is|are)\b/i,
      },
      {
        label: "focused business fact",
        pattern:
          /\b(?:price|pricing|cost|policy|feature|requirement|definition|availability|available|deadline|date)\b/i,
      },
    ],
  },
];

const FACT_SUBJECTS =
  /\b(?:price|pricing|cost|policy|feature|requirement|definition|availability|deadline|date)\b/gi;
const ACTIONS =
  /\b(?:explain|describe|compare|analy[sz]e|recommend|create|build|outline|plan|prioritize|track|list|identify)\b/gi;
const MEANINGFUL_RECOMMENDATION_CONDITIONS =
  /\b(?:\d+[ -]person|small|mid(?:-| )size[d]?|large|enterprise|agency|team|company|business|organization|expanding|growing|scaling|entering|healthcare|industry|sector|market|budget|location|region|b2b|b2c)\b/i;

function lastMatchingIndex(message: string, patterns: RegExp[]): number {
  return patterns.reduce((lastIndex, pattern) => {
    const globalPattern = new RegExp(
      pattern.source,
      pattern.flags.includes("i") ? "gi" : "g",
    );

    for (const match of message.matchAll(globalPattern)) {
      lastIndex = Math.max(lastIndex, match.index ?? -1);
    }

    return lastIndex;
  }, -1);
}

function countDistinctMatches(message: string, pattern: RegExp): number {
  return new Set(
    (message.match(pattern) ?? []).map((match) => match.toLowerCase()),
  ).size;
}

function scoreIntents(message: string): IntentScore[] {
  const scores = new Map<ResponseIntent, IntentScore>(
    INTENT_TIE_ORDER.map((intent) => [
      intent,
      { intent, score: intent === "focused_fact" ? 1 : 0, matchedSignals: [] },
    ]),
  );

  for (const rule of SCORING_RULES) {
    const score = scores.get(rule.intent);
    if (!score) continue;

    for (const signal of rule.signals) {
      if (!signal.pattern.test(message)) continue;
      score.score += rule.weight;
      score.matchedSignals.push(signal.label);
    }
  }

  const questionCount = (message.match(/\?/g) ?? []).length;
  const actionCount = (message.match(ACTIONS) ?? []).length;
  const factCount = countDistinctMatches(message, FACT_SUBJECTS);
  const multiple = scores.get("multiple_deliverables");

  if (multiple && questionCount >= 2) {
    multiple.score += 5;
    multiple.matchedSignals.push("multiple questions");
  }

  if (multiple && actionCount >= 3) {
    multiple.score += 4;
    multiple.matchedSignals.push("several requested actions");
  } else if (multiple && actionCount === 2) {
    multiple.score += 2;
    multiple.matchedSignals.push("two requested actions");
  }

  if (multiple && factCount >= 2) {
    multiple.score += 3;
    multiple.matchedSignals.push("several requested facts");
  }

  const recommendation = scores.get("focused_recommendation");
  if (
    recommendation &&
    recommendation.score > 0 &&
    MEANINGFUL_RECOMMENDATION_CONDITIONS.test(message)
  ) {
    recommendation.score += 1;
    recommendation.matchedSignals.push("meaningful business qualifiers");
  }

  return INTENT_TIE_ORDER.map((intent) => scores.get(intent)!);
}

function detectIntent(message: string): ResponseIntent {
  return scoreIntents(message).reduce((winner, candidate) =>
    candidate.score > winner.score ? candidate : winner,
  ).intent;
}

function automaticDecision(
  message: string,
  intent: ResponseIntent,
): ResponseDepthDecision {
  if (intent === "planning") {
    return {
      depth: "detailed",
      intent,
      reason:
        "The user requested a strategy, plan, or broad analysis. A detailed structured response is appropriate.",
    };
  }

  if (intent === "multiple_deliverables") {
    return {
      depth: "detailed",
      intent,
      reason:
        "The user requested multiple distinct outputs. Address them in a detailed structured response.",
    };
  }

  if (intent === "comparison") {
    const criteriaCount = countDistinctMatches(message, FACT_SUBJECTS);
    const listItems = (message.match(/,/g) ?? []).length + 1;
    const hasSeveralCriteria =
      /\bacross\b/i.test(message) &&
      (criteriaCount >= 3 || listItems >= 4);

    return {
      depth: hasSeveralCriteria ? "detailed" : "standard",
      intent,
      reason: hasSeveralCriteria
        ? "The user requested a comparison across several criteria. Compare them in a detailed, organized response."
        : "The user asked for a focused comparison. Explain the key differences without unrelated detail.",
    };
  }

  if (intent === "focused_recommendation") {
    const hasMeaningfulConditions =
      MEANINGFUL_RECOMMENDATION_CONDITIONS.test(message);

    return {
      depth: hasMeaningfulConditions ? "standard" : "brief",
      intent,
      reason: hasMeaningfulConditions
        ? "The user asked for a recommendation with meaningful conditions. Give a focused answer with the key reasoning."
        : "The user asked for one focused recommendation. Answer directly with limited reasoning.",
    };
  }

  if (intent === "explanation") {
    return {
      depth: "standard",
      intent,
      reason:
        "The user asked how one process or feature works. Explain it clearly without expanding into unrelated advice.",
    };
  }

  return {
    depth: "brief",
    intent,
    reason: "The user asked for one focused fact. Answer directly.",
  };
}

export function classifyResponseDepth(
  message: string,
): ResponseDepthDecision {
  const normalized = message.trim().replace(/\s+/g, " ");
  const intent = detectIntent(normalized);
  const decision = automaticDecision(normalized, intent);
  const brevityIndex = lastMatchingIndex(normalized, BREVITY_PHRASES);
  const detailIndex = lastMatchingIndex(normalized, DETAIL_PHRASES);

  if (brevityIndex < 0 && detailIndex < 0) return decision;

  if (detailIndex > brevityIndex) {
    return {
      depth: "detailed",
      intent,
      reason:
        "The user's last explicit length instruction requested detail. Provide a detailed response suited to the request.",
    };
  }

  return {
    depth: "brief",
    intent,
    reason:
      "The user's last explicit length instruction requested brevity. Answer directly and keep it short.",
  };
}
