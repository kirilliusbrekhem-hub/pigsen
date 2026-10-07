// Client-safe constants for community, chat rooms and DMs.
export const POST_KINDS = { win: "Победа", question: "Вопрос", post: "Пост" } as const;
export type PostKind = keyof typeof POST_KINDS;
export const POST_TOPICS = { business: "Бизнес", startups: "Стартапы", savings: "Копилка", investing: "Инвестиции", other: "Другое" } as const;
export type PostTopic = keyof typeof POST_TOPICS;
export const KIND_IDS = Object.keys(POST_KINDS) as [PostKind, ...PostKind[]];
export const TOPIC_IDS = Object.keys(POST_TOPICS) as [PostTopic, ...PostTopic[]];

export const CHAT_ROOMS = [
  { id: "business", name: "Бизнес" },
  { id: "startups", name: "Стартапы" },
  { id: "savings", name: "Копилка и накопления" },
  { id: "investing", name: "Инвестиции" },
  { id: "offtop", name: "Болталка" },
] as const;
export type RoomId = (typeof CHAT_ROOMS)[number]["id"];
export const isRoom = (id: string): id is RoomId => CHAT_ROOMS.some((r) => r.id === id);

export const CHAT_MAX = 500;
export const DM_MAX = 1000;
export const LIKE_REWARD = 10;
export const LIKE_REWARD_AT = 5;

export interface PublicUser { id: string; name: string; avatarUrl: string | null; pro: boolean; title?: string }
export interface ChatMsgView { id: string; text: string; createdAt: string; mine: boolean; author: PublicUser }
export interface DmView { id: string; text: string; createdAt: string; mine: boolean; read: boolean }
export interface ConversationView { user: PublicUser; last: { text: string; createdAt: string; mine: boolean }; unread: number }
