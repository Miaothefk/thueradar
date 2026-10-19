export type CitationSource = { id: string };
export type CitationValidation = {
  citedIds: string[];
  invalidIds: string[];
  hasEvidence: boolean;
  isValid: boolean;
};
export declare function extractCitationIds(answer: string): string[];
export declare function validateCitations(answer: string, sources: CitationSource[]): CitationValidation;
export declare function buildNoEvidenceResponse(reason?: string): {
  status: "NO_EVIDENCE";
  answer: string;
  citations: never[];
};
