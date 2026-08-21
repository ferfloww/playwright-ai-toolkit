export interface PlaywrightJsonFailure {
  testTitle: string;
  filePath: string;
  errorMessage: string;
  errorStack?: string;
  retries: number;
}

export type FailureCategory =
  | "flaky"
  | "real_bug"
  | "broken_selector"
  | "environment_issue"
  | "unknown";

export interface TriageResult {
  testTitle: string;
  category: FailureCategory;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  suggestedAction: string;
}
