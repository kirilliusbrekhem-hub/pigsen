interface Day {
  date: string;
  count: number;
}

const DOW = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

export function ActivityBars({ days }: { days: Day[] }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((s, d) => s + d.count, 0);
  return (
    <div className="act-bars" role="img" aria-label={`Пройдено уроков за ${days.length} дней: ${total}`}>
      {days.map((d, i) => {
        const dt = new Date(`${d.date}T12:00:00`);
        return (
          <div className="bar" key={d.date} title={`${dt.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}: ${d.count} ур.`}>
            <i className={`${d.count ? "on" : ""} ${i === days.length - 1 ? "today" : ""}`} style={{ height: `${Math.max(6, (d.count / max) * 100)}%` }} />
            <span>{i % 2 === days.length % 2 ? "" : DOW[dt.getDay()]}</span>
          </div>
        );
      })}
    </div>
  );
}
