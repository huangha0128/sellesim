export function formatPrice(n) {
  const num = Number(n)
  return `¥${num % 1 === 0 ? num.toFixed(0) : num.toFixed(1)}`
}

/** 货币符号：USD 用 $，其余（含缺省）用 ¥ */
export function currencySymbol(currency) {
  return currency === 'USD' ? '$' : '¥'
}

/** 按货币符号格式化价格（后端已按展示货币换算好的 price + currency） */
export function formatPriceByCurrency(n, currency) {
  const num = Number(n)
  return `${currencySymbol(currency)}${num % 1 === 0 ? num.toFixed(0) : num.toFixed(1)}`
}

export function formatDate(ts) {
  const d = new Date(ts)
  const p = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function formatTime(ts) {
  const d = new Date(ts)
  const p = (x) => String(x).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}

export function formatDateTime(ts) {
  return `${formatDate(ts)} ${formatTime(ts)}`
}

export function genOrderNo() {
  const d = new Date()
  const p = (x) => String(x).padStart(2, '0')
  return (
    'DPH' +
    d.getFullYear() +
    p(d.getMonth() + 1) +
    p(d.getDate()) +
    p(d.getHours()) +
    p(d.getMinutes()) +
    p(d.getSeconds()) +
    String(Math.floor(Math.random() * 90) + 10)
  )
}

export function formatGb(gb) {
  return `${gb}GB`
}

export function maskEmail(email) {
  if (!email || !email.includes('@')) return email
  const [name, domain] = email.split('@')
  return `${name.slice(0, 2)}****@${domain}`
}
