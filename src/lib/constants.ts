/** Market hours for US exchanges (Eastern Time) */
export const US_MARKET = {
  openHour: 9,
  openMinute: 30,
  closeHour: 16,
  closeMinute: 0,
  timezone: "America/New_York",
} as const;

/** Cache revalidation intervals (seconds) */
export const REVALIDATE = {
  quotes: 15,
  search: 300,
  profile: 86400,
  news: 600,
} as const;
