// Шаблон юридического документа. Подлежит проверке юристом перед публикацией в окончательной редакции.
export const LEGAL = {
  owner: process.env.LEGAL_OWNER || "Владелец сервиса PìgBiz",
  email: process.env.SUPPORT_EMAIL || "",
  updated: "7 октября 2026",
};

export function contactLine(): string {
  return LEGAL.email ? `по электронной почте ${LEGAL.email}` : "через раздел Профиль на сайте";
}
