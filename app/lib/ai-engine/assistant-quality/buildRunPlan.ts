import type {
  AssistantQualityQuestionDefinition,
  AssistantQualityRunQuestion,
} from "./contracts";

function createRunQuestionId(definitionId: string, sequence: number): string {
  return `${definitionId}:${sequence}`;
}

export function buildAssistantQualityRunQuestions(
  definitions: AssistantQualityQuestionDefinition[],
): AssistantQualityRunQuestion[] {
  const enabledDefinitions = definitions.filter((definition) => definition.enabledByDefault);

  return enabledDefinitions.map((definition, index) => {
    const sequence = index + 1;

    return {
      id: createRunQuestionId(definition.id, sequence),
      definitionId: definition.id,
      title: definition.title,
      prompt: definition.prompt,
      category: definition.category,
      source: definition.source,
      status: "pending",
      sequence,
    };
  });
}
