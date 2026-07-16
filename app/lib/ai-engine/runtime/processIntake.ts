import type {
    BusinessContextEntry,
    BuildProgress,
  } from "@/app/lib/ai-engine/contracts";
  import {
    extractBusinessIntake,
    type IntakeExtractionRequest,
  } from "@/app/lib/ai-engine/intake";
  import type {
    IntakeRuntimeResult,
    RuntimeDependencies,
  } from "./contracts";
  
  function buildProposedContextEntries(params: {
    request: IntakeExtractionRequest;
    extractedAt: string;
    facts: Awaited<
      ReturnType<typeof extractBusinessIntake>
    >["result"]["facts"];
  }): BusinessContextEntry[] {
    return params.facts.map((fact) => ({
      id: fact.temporaryId,
      sessionId: params.request.sessionId,
      category: fact.category,
      title: fact.title,
      content: fact.content,
      confidence: fact.confidence,
      confidenceScore: fact.confidenceScore,
      status: "proposed",
      source: {
        intakeBlockId: fact.sourceBlockId,
        excerpt: fact.sourceExcerpt,
        sourceType: "manual_intake",
      },
      metadata: {
        generated: true,
        userEdited: false,
        conflictingEntryIds: [],
        tags: fact.tags,
      },
      createdAt: params.extractedAt,
      updatedAt: params.extractedAt,
    }));
  }
  
  export async function processIntake(
    request: IntakeExtractionRequest,
    dependencies: RuntimeDependencies,
  ): Promise<IntakeRuntimeResult> {
    const intake = await extractBusinessIntake({
      request,
      runModel: dependencies.runIntakeModel,
    });
  
    const extractedAt = new Date().toISOString();
  
    return {
      intake,
      proposedContext: {
        entries: buildProposedContextEntries({
          request,
          extractedAt,
          facts: intake.result.facts,
        }),
        createdAt: extractedAt,
      },
    };
  }
  
  export function buildIntakeProgress(
    result: IntakeRuntimeResult,
  ): BuildProgress[] {
    const createdAt = result.proposedContext.createdAt;
  
    return [
      {
        stage: "reading_business",
        message: "Business information loaded",
        completed: true,
        count: result.intake.diagnostics.inputBlockCount,
        createdAt,
      },
      {
        stage: "extracting_facts",
        message: "Business facts extracted",
        completed: true,
        count: result.intake.diagnostics.extractedFactCount,
        createdAt,
      },
      {
        stage: "generating_qa",
        message: "Q&A candidates generated",
        completed: true,
        count: result.intake.diagnostics.generatedFaqCount,
        createdAt,
      },
      {
        stage: "detecting_conflicts",
        message: "Conflicts checked",
        completed: true,
        count: result.intake.diagnostics.conflictCount,
        createdAt,
      },
      {
        stage: "building_memory",
        message: "Proposed business memory prepared for review",
        completed: true,
        count: result.proposedContext.entries.length,
        createdAt,
      },
      {
        stage: "preparing_demo",
        message: "Waiting for user approval",
        completed: false,
        count: null,
        createdAt,
      },
    ];
  }
  