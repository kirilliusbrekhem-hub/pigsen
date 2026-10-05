export const rub = (n: number) => new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(Math.round(n));
export const dateRu = (d: string | Date) => new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
