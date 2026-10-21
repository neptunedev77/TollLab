/** Tarifa máxima aceite por passagem: 100 €. Evita valores absurdos por erro de escrita. */
export const MAX_TARIFF_CENTS = 10_000

export type TariffCheck = { readonly ok: true; readonly cents: number } | { readonly ok: false; readonly message: string }

/** Valida uma tarifa em cêntimos: número finito, inteiro, não negativo e dentro do limite. */
export function checkTariffCents(value: unknown): TariffCheck {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return { ok: false, message: 'A tarifa tem de ser um número.' }
  }
  if (!Number.isFinite(value)) return { ok: false, message: 'A tarifa tem de ser um valor finito.' }
  if (value < 0) return { ok: false, message: 'A tarifa não pode ser negativa.' }
  if (!Number.isInteger(value)) return { ok: false, message: 'A tarifa tem de estar em cêntimos inteiros.' }
  if (value > MAX_TARIFF_CENTS) {
    return { ok: false, message: `A tarifa não pode exceder ${formatEuros(MAX_TARIFF_CENTS)}.` }
  }
  return { ok: true, cents: value }
}

const euroFormatter = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })

/** Formata cêntimos em euros no formato português (ex.: 1,85 €). */
export function formatEuros(cents: number): string {
  return euroFormatter.format(cents / 100)
}
