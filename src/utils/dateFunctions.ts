// src/utils/dateFunctions.ts

/**
 * Calculates the Monday and Friday of the current week.
 * @returns An object containing the Date for Monday and Friday of the current week.
 */
export const getCurrentWeekDates = (): { monday: Date; friday: Date } => {
  const now = new Date();
  const currentDayOfWeek = now.getDay(); // Sunday is 0, Monday is 1, ..., Saturday is 6

  // Calculate days to subtract to get to Monday
  // If today is Sunday (0), we want to go back 6 days to get to the Monday of the *previous* week if Sunday starts the week.
  // Or, if Monday starts the week, Sunday (0) means we want the Monday of the *next* week, or current if it's past.
  // Assuming standard ISO 8601 week where Monday is the first day of the week:
  const daysToSubtractForMonday =
    currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;

  const monday = new Date(now);
  monday.setDate(now.getDate() - daysToSubtractForMonday);
  monday.setHours(0, 0, 0, 0); // Normalize time to start of the day

  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4); // Friday is 4 days after Monday
  friday.setHours(0, 0, 0, 0); // Normalize time

  return { monday, friday };
};

/**
 * Formats a Date object into a "Month Day" string (e.g., "May 12").
 * @param date The Date object to format.
 * @returns A string representing the formatted date.
 */
export const formatDateMonthDay = (date: Date): string => {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
