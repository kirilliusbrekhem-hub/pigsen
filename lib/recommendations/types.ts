import type { RecommendationDTO } from "@/types";

/** Signals collected about a user. A future ML/AI engine receives the same input. */
export interface UserSignals {
  interests: string[]; // category slugs chosen by the user
  savedCategoryIds: string[];
  viewedCategoryIds: string[];
  completedCategoryIds: string[];
  searchTerms: string[];
  savedIds: Set<string>;
  viewedIds: Set<string>;
  completedCourseItemIds: Set<string>;
}

export interface RecommendationEngine {
  name: string;
  recommend(userId: string, signals: UserSignals, limit: number): Promise<RecommendationDTO[]>;
}
