const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const MONTH_NAMES = MONTHS;

export function getYearOptions(): string[] {
  const currentYear = new Date().getFullYear();
  const years: string[] = [];
  for (let y = currentYear + 1; y >= currentYear - 3; y--) {
    years.push(String(y));
  }
  return years;
}

export function getFinancialYearOptions(): string[] {
  const currentYear = new Date().getFullYear();
  const options: string[] = [];
  for (let y = currentYear + 1; y >= currentYear - 3; y--) {
    options.push(`${y}-${String(y + 1).slice(2)}`);
  }
  return options;
}

export function splitMonthYear(monthYear: string): { month: string; year: string } {
  if (!monthYear) return { month: "", year: "" };
  const parts = monthYear.split("-");
  if (parts.length === 2) {
    return { month: parts[0], year: parts[1] };
  }
  return { month: "", year: "" };
}

export function joinMonthYear(month: string, year: string): string {
  if (!month || !year) return "";
  return `${month}-${year}`;
}
