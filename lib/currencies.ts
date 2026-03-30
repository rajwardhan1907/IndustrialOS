// lib/currencies.ts
// Phase 15 — Multi-Currency Support
// Central currency list and formatting helpers used across all modules.

export interface Currency {
  code:   string;  // ISO 4217 e.g. "USD"
  symbol: string;  // e.g. "$"
  name:   string;  // e.g. "US Dollar"
}

export const CURRENCIES: Currency[] = [
  { code: "USD", symbol: "$",  name: "US Dollar"          },
  { code: "EUR", symbol: "€",  name: "Euro"               },
  { code: "GBP", symbol: "£",  name: "British Pound"      },
  { code: "INR", symbol: "₹",  name: "Indian Rupee"       },
  { code: "CAD", symbol: "CA$",name: "Canadian Dollar"    },
  { code: "AUD", symbol: "A$", name: "Australian Dollar"  },
  { code: "AED", symbol: "د.إ",name: "UAE Dirham"         },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar"   },
  { code: "JPY", symbol: "¥",  name: "Japanese Yen"       },
  { code: "CNY", symbol: "¥",  name: "Chinese Yuan"       },
  { code: "CHF", symbol: "Fr", name: "Swiss Franc"        },
  { code: "BRL", symbol: "R$", name: "Brazilian Real"     },
  { code: "MXN", symbol: "MX$",name: "Mexican Peso"       },
  { code: "ZAR", symbol: "R",  name: "South African Rand" },
  { code: "SAR", symbol: "﷼",  name: "Saudi Riyal"        },
];

export const DEFAULT_CURRENCY = "USD";

/** Get a Currency object by code — falls back to USD if not found */
export function getCurrency(code: string): Currency {
  return CURRENCIES.find(c => c.code === code) ?? CURRENCIES[0];
}

/** Format a number as money with the correct symbol and decimals.
 *  JPY and similar zero-decimal currencies show no decimal places.
 */
export function fmtCurrency(amount: number, currencyCode: string = DEFAULT_CURRENCY): string {
  const currency = getCurrency(currencyCode);
  const noDecimals = ["JPY", "KRW", "VND", "IDR"].includes(currencyCode);
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: noDecimals ? 0 : 2,
    maximumFractionDigits: noDecimals ? 0 : 2,
  });
  return `${currency.symbol}${formatted}`;
}
