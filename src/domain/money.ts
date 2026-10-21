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

/**
 * Converte o texto de um campo em euros (aceita vírgula ou ponto decimal, ex.: "1,85") em cêntimos.
 * Rejeita campos vazios, texto não numérico, mais de duas casas decimais e valores fora dos limites.
 */
export function parseEuroInput(text: string): TariffCheck {
  const normalized = text.trim().replace(/\s|€/g, '').replace(',', '.')
  if (normalized === '') return { ok: false, message: 'Indica uma tarifa em euros.' }
  if (!/^-?\d*(\.\d*)?$/.test(normalized) || normalized === '.' || normalized === '-') {
    return { ok: false, message: 'Usa apenas números, por exemplo 1,85.' }
  }
  if (/\.\d{3,}$/.test(normalized)) return { ok: false, message: 'Usa no máximo duas casas decimais (cêntimos).' }
  const euros = Number(normalized)
  // `|| 0` normaliza −0 (ex.: "-0") para 0.
  return checkTariffCents(Math.round(euros * 100) || 0)
}

/** Texto de um valor em cêntimos para um campo editável (ex.: 185 → "1,85"). */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}
