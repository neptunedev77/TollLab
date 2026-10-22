const integer = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 })
const oneDecimal = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 })
const percent = new Intl.NumberFormat('pt-PT', { style: 'percent', maximumFractionDigits: 0 })

/** Inteiro no formato português (ex.: 7 000). */
export const formatInteger = (value: number) => integer.format(Math.round(value))

/** Minutos com no máximo uma casa decimal (ex.: 38,9 min). */
export const formatMinutes = (value: number) => `${oneDecimal.format(value)} min`

export const formatPercent = (fraction: number) => percent.format(fraction)
