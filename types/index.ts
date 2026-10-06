export const CONTENT_TYPES = ["article", "book", "video", "podcast", "course"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const MESSAGE_ROLES = ["user", "assistant", "system"] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const AI_TONES = ["concise", "balanced", "detailed"] as const;
export type AiTone = (typeof AI_TONES)[number];

export interface CategoryDTO {
  id: string;
  slug: string;
  name: string;
  icon: string;
}

export interface ContentCardDTO {
  id: string;
  slug: string;
  title: string;
  description: string;
  type: ContentType;
  author: string;
  source: string;
  readingTime: number;
  publishedAt: string;
  category: CategoryDTO;
  saved: boolean;
  href: string;
  premium?: boolean;
}

export interface RecommendationDTO {
  item: ContentCardDTO;
  score: number;
  reason: string;
}

export interface CourseProgressDTO {
  id: string;
  slug: string;
  title: string;
  description: string;
  level: string;
  category: CategoryDTO;
  totalLessons: number;
  completedLessons: number;
  percent: number;
  totalMinutes: number;
  nextLessonSlug: string | null;
  nextLessonTitle: string | null;
  started: boolean;
  contentItemId: string | null;
  saved: boolean;
  premium?: boolean;
}

export interface ConversationSummaryDTO {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

export interface MessageDTO {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  related: ContentCardDTO[];
  followUps: string[];
  provider: string | null;
}

export interface SearchResultDTO {
  query: string;
  content: ContentCardDTO[];
  lessons: Array<{ id: string; title: string; summary: string; courseTitle: string; href: string }>;
  categories: CategoryDTO[];
  total: number;
}

export interface ApiError {
  error: string;
  details?: Record<string, string>;
}

/** XP outcome of an action, returned by mutating endpoints that award XP. */
export interface XpResultDTO {
  gained: number;
  coins?: number;
  xp: number;
  streak: number;
  level: { index: number; name: string; percent: number };
  leveledUp: boolean;
}

export interface QuizQuestionDTO {
  q: string;
  options: string[];
}

export interface QuizResultDTO {
  score: number;
  total: number;
  results: Array<{ correct: boolean; answer: number; explain: string }>;
  xp: XpResultDTO;
  firstTime: boolean;
}

export interface IdeaReviewDTO {
  score: number;
  verdict: string;
  strengths: string[];
  risks: string[];
  steps: string[];
}
