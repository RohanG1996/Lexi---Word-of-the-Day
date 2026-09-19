export function shouldShowWidgetToday(lastShownDate: string | null, today: string): boolean {
  return lastShownDate !== today;
}
