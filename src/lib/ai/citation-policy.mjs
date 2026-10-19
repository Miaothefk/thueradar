export function extractCitationIds(answer) {
  return [...new Set([...answer.matchAll(/\[(D\d+)\]/g)].map((match) => match[1]))];
}

export function validateCitations(answer, sources) {
  const citedIds = extractCitationIds(answer);
  const validIds = new Set(sources.map((source) => source.id));
  const invalidIds = citedIds.filter((id) => !validIds.has(id));

  return {
    citedIds,
    invalidIds,
    hasEvidence: sources.length > 0,
    isValid: sources.length > 0 && citedIds.length > 0 && invalidIds.length === 0,
  };
}

export function buildNoEvidenceResponse(reason = "Không tìm thấy văn bản đã xác minh phù hợp.") {
  return {
    status: "NO_EVIDENCE",
    answer: `Chưa thể trả lời dựa trên bằng chứng trong kho văn bản. ${reason}`,
    citations: [],
  };
}
