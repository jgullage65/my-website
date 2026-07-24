export const AI_BUILDER_MAX_FINAL_INPUT_CHARACTERS = 9_000_000;

export type WebsiteExtractionPage = {
  pageNumber: number;
  sourceIdentifier: string;
  url: string;
  pageType: string;
  title: string;
  text: string;
};

export type WebsiteExtractionChunk = WebsiteExtractionPage & {
  chunkIndex: number;
  chunkCount: number;
};

export type WebsiteExtractionBatch = {
  batchIndex: number;
  units: WebsiteExtractionChunk[];
  input: string;
  finalInputCharacterCount: number;
};

export class AiBuilderInputBatchingError extends Error {
  constructor(message: string) {
    super(`AI_BUILDER_INPUT_BATCHING_ERROR: ${message}`);
    this.name = "AiBuilderInputBatchingError";
  }
}

export function renderWebsiteExtractionUnit(unit: WebsiteExtractionChunk): string {
  return [
    `PAGE ${unit.pageNumber}`,
    `SOURCE ID: ${unit.sourceIdentifier}`,
    `URL: ${unit.url}`,
    `TYPE: ${unit.pageType}`,
    unit.title ? `TITLE: ${unit.title}` : "",
    `CHUNK: ${unit.chunkIndex} OF ${unit.chunkCount}`,
    "CONTENT:",
    unit.text,
  ].filter(Boolean).join("\n");
}

export function renderWebsiteExtractionBatch(units: WebsiteExtractionChunk[]): string {
  return units.map(renderWebsiteExtractionUnit).join("\n\n---\n\n");
}

function splitPage(page: WebsiteExtractionPage, measure: (input: string) => number, maximum: number): WebsiteExtractionChunk[] {
  const provisionalCount = Math.max(1, page.text.length);
  const chunks: WebsiteExtractionChunk[] = [];
  let offset = 0;
  while (offset < page.text.length || (page.text.length === 0 && chunks.length === 0)) {
    let low = page.text.length === 0 ? 0 : 1;
    let high = page.text.length - offset;
    let fittingLength = -1;
    while (low <= high) {
      const length = Math.floor((low + high) / 2);
      const candidate = { ...page, text: page.text.slice(offset, offset + length), chunkIndex: chunks.length + 1, chunkCount: provisionalCount };
      if (measure(renderWebsiteExtractionBatch([candidate])) <= maximum) {
        fittingLength = length;
        low = length + 1;
      } else high = length - 1;
    }
    if (fittingLength < 0) throw new AiBuilderInputBatchingError(`page metadata cannot fit for source ${page.sourceIdentifier}`);
    chunks.push({ ...page, text: page.text.slice(offset, offset + fittingLength), chunkIndex: chunks.length + 1, chunkCount: provisionalCount });
    offset += fittingLength;
    if (page.text.length === 0) break;
  }
  return chunks.map((chunk) => ({ ...chunk, chunkCount: chunks.length }));
}

export function buildWebsiteExtractionBatches(
  pages: WebsiteExtractionPage[],
  measureFinalInput: (input: string) => number,
  maximum = AI_BUILDER_MAX_FINAL_INPUT_CHARACTERS,
): WebsiteExtractionBatch[] {
  const batches: WebsiteExtractionChunk[][] = [];
  let current: WebsiteExtractionChunk[] = [];
  const close = () => { if (current.length) batches.push(current); current = []; };

  for (const page of pages) {
    const whole = { ...page, chunkIndex: 1, chunkCount: 1 };
    const chunks = measureFinalInput(renderWebsiteExtractionBatch([whole])) <= maximum
      ? [whole]
      : splitPage(page, measureFinalInput, maximum);
    for (const chunk of chunks) {
      const candidate = [...current, chunk];
      if (measureFinalInput(renderWebsiteExtractionBatch(candidate)) > maximum) close();
      if (measureFinalInput(renderWebsiteExtractionBatch([chunk])) > maximum) {
        throw new AiBuilderInputBatchingError(`chunk cannot fit for source ${chunk.sourceIdentifier}`);
      }
      current.push(chunk);
    }
  }
  close();
  return batches.map((units, index) => {
    const input = renderWebsiteExtractionBatch(units);
    const finalInputCharacterCount = measureFinalInput(input);
    if (finalInputCharacterCount > maximum) throw new AiBuilderInputBatchingError(`batch ${index + 1} is ${finalInputCharacterCount} characters`);
    return { batchIndex: index + 1, units, input, finalInputCharacterCount };
  });
}

export function assertSafeWebsiteExtractionInput(input: string, measureFinalInput: (input: string) => number): number {
  const length = measureFinalInput(input);
  if (length > AI_BUILDER_MAX_FINAL_INPUT_CHARACTERS) throw new AiBuilderInputBatchingError(`final AI input is ${length} characters`);
  return length;
}
