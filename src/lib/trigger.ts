export function shouldShowWidgetToday(lastShownDate: string | null, today: string): boolean {
  return lastShownDate !== today;
}

// The side panel's "today's word" banner is the fallback for a widget closed without saving: it only appears
// once the widget has had its one shot for the day (lastShownDate === today) and only until the word is saved,
// so it never doubles up with the widget itself and never lingers once there's nothing left to recover.
export function shouldShowTodayWordBanner(params: {
  todayWordDate: string;
  currentDate: string;
  lastShownDate: string | null;
  alreadySaved: boolean;
}): boolean {
  return (
    params.todayWordDate === params.currentDate &&
    params.lastShownDate === params.currentDate &&
    !params.alreadySaved
  );
}
