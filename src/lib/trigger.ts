export function shouldShowWidgetToday(lastShownDate: string | null, today: string): boolean {
  return lastShownDate !== today;
}

// The side panel's "today's word" banner is the fallback for a widget closed without saving: it only appears
// while the widget is closed (today's shared widget state says so) and the word is still unsaved. An open or
// minimised widget is still on screen with its own Save, so the banner would double up with it.
export function shouldShowTodayWordBanner(params: {
  todayWordDate: string;
  currentDate: string;
  widgetState: { date: string; mode: "expanded" | "collapsed" | "closed" } | null;
  alreadySaved: boolean;
}): boolean {
  const { widgetState } = params;
  return (
    params.todayWordDate === params.currentDate &&
    widgetState !== null &&
    widgetState.date === params.currentDate &&
    widgetState.mode === "closed" &&
    !params.alreadySaved
  );
}
