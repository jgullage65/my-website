import type { DeterministicFact, MaterialConflict } from "./contracts";
import { keyText, stableId } from "./util";
const material = (fact: DeterministicFact) => {
    const text = keyText(fact.value);
    const values = text.match(/(?:[$£€]\s?\d+(?:\.\d+)?|\d+\s?(?:days?|hours?|months?|years?|%|usd|gbp|eur)|[\w.+-]+@[\w.-]+\.[a-z]{2,})/g);
    return values?.sort().join("|") ?? text;
};
export function detectConflicts(facts: readonly DeterministicFact[]): MaterialConflict[] {
    const byTopic = new Map<string, DeterministicFact[]>();
    for (const fact of facts) {
        if (!byTopic.has(fact.topicKey))
            byTopic.set(fact.topicKey, []);
        byTopic.get(fact.topicKey)!.push(fact);
    }
    const result: MaterialConflict[] = [];
    for (const [topicKey, group] of Array.from(byTopic.entries())) {
        const values = new Set(group.map(material));
        if (group.length < 2 || values.size < 2)
            continue;
        const preferred = group.find(f => f.provenance === "owner") ??
            [...group].sort((a, b) => b.confidenceScore - a.confidenceScore)[0]!;
        result.push({
            id: stableId("conflict", `${topicKey}\0${Array.from(values).join("\0")}`),
            topicKey,
            factIds: group.map(f => f.id).sort(),
            preferredFactId: preferred.id,
            websiteFactIds: group.filter(f => f.provenance === "website").map(f => f.id),
            sessionEntryIds: [],
            reason: group.some(f => f.provenance === "owner")
                ? "Owner information differs from website evidence; owner information has precedence, and both remain reviewable."
                : "Independent sources make materially different claims about the same topic."
        });
    }
    return result;
}
