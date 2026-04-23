export function formatCurrency(value: number | null | undefined): string {
  if (value == null) {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null) {
    return "--";
  }

  return `${value.toFixed(2)}%`;
}

export function formatCompactNumber(value: number | null | undefined): string {
  if (value == null) {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

export function formatRelativeSeconds(seconds: number | null): string {
  if (seconds == null) {
    return "No data";
  }

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  return `${Math.floor(seconds / 60)}m ago`;
}

export function formatDateLabel(value: string | null | undefined): string {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00Z`));
}
