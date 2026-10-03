export function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function heatmapWeeks(today: string, count: number): string[][] {
  const end = new Date(`${today}T12:00:00`);
  const start = new Date(end);
  start.setDate(start.getDate() - 364);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const weeks: string[][] = [];
  for (const day = new Date(start); day <= end; day.setDate(day.getDate() + 7)) {
    const week: string[] = [];
    for (let offset = 0; offset < 7; offset++) {
      const cell = new Date(day);
      cell.setDate(cell.getDate() + offset);
      week.push(localDate(cell));
    }
    weeks.push(week);
  }
  return weeks.slice(-count);
}
