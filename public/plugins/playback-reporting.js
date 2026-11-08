/*
 * Lumio plugin: Playback Reporting
 *
 * An admin page in Lumio's settings for the statistics of Jellyfin's "Playback Reporting" plugin, so administrators
 * needn't open Jellyfin's dashboard for them: totals, plays per day, users, what was played with what (type, playback
 * method, client, device) and the times of day. Reads the plugin's own API (/user_usage_stats/…), with the signed-in
 * administrator's session. Needs the Jellyfin plugin "Playback Reporting".
 *
 * Part of Lumio (GPL-3.0); added from Settings → Plugins → Available plugins.
 */

const TEXT = {
  de: {
    title: 'Wiedergabe-Statistik',
    period: 'Zeitraum',
    days: (n) => `${n} Tage`,
    year: '1 Jahr',
    types: { Movie: 'Filme', Episode: 'Folgen', Audio: 'Musik' },
    measure: 'Messen nach',
    count: 'Wiedergaben',
    time: 'Zeit',
    plays: 'Wiedergaben',
    totalTime: 'Gesamtzeit',
    users: 'Aktive Nutzer',
    perDay: 'Pro Tag',
    people: 'Nutzer',
    user: 'Nutzer',
    lastSeen: 'Zuletzt',
    lastItem: 'Zuletzt gespielt',
    client: 'Client',
    byType: 'Nach Typ',
    byMethod: 'Wiedergabe-Methode',
    byClient: 'Nach Client',
    byDevice: 'Nach Gerät',
    hours: 'Tageszeiten',
    weekdays: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
    loading: 'Wird geladen …',
    empty: 'Keine Wiedergaben in diesem Zeitraum.',
    missing: 'Das Jellyfin-Plugin „Playback Reporting“ antwortet nicht. Ist es installiert und aktiv?',
  },
  en: {
    title: 'Playback statistics',
    period: 'Period',
    days: (n) => `${n} days`,
    year: '1 year',
    types: { Movie: 'Films', Episode: 'Episodes', Audio: 'Music' },
    measure: 'Measure by',
    count: 'Plays',
    time: 'Time',
    plays: 'Plays',
    totalTime: 'Total time',
    users: 'Active users',
    perDay: 'Per day',
    people: 'Users',
    user: 'User',
    lastSeen: 'Last seen',
    lastItem: 'Last played',
    client: 'Client',
    byType: 'By type',
    byMethod: 'Playback method',
    byClient: 'By client',
    byDevice: 'By device',
    hours: 'Times of day',
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    loading: 'Loading …',
    empty: 'No plays in this period.',
    missing: 'The Jellyfin plugin "Playback Reporting" doesn’t answer. Is it installed and enabled?',
  },
}

const STYLE = `
.lpr { display: grid; gap: 1.5rem; }
.lpr-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem 1.25rem; }
.lpr-controls label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; color: var(--muted-foreground); }
.lpr select { height: 2.25rem; padding: 0 0.625rem; border: 1px solid var(--input); border-radius: var(--radius); background: transparent; color: var(--foreground); font: inherit; font-size: 0.875rem; }
.lpr select option { background: var(--card); color: var(--foreground); }
.lpr-chips { display: flex; flex-wrap: wrap; gap: 0.375rem; }
.lpr-chip { height: 2rem; padding: 0 0.75rem; border: 1px solid var(--border); border-radius: 999px; background: transparent; color: var(--muted-foreground); font: inherit; font-size: 0.8125rem; cursor: pointer; }
.lpr-chip[aria-pressed="true"] { background: var(--foreground); border-color: var(--foreground); color: var(--background); }
.lpr button:focus { outline: none; }
.lpr button:focus-visible, .lpr select:focus-visible { outline: 2px solid color-mix(in oklab, var(--foreground) 35%, transparent); outline-offset: 2px; }
.lpr-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); gap: 0.75rem; }
.lpr-card, .lpr-panel { border: 1px solid var(--border); border-radius: calc(var(--radius) + 4px); background: var(--card); }
.lpr-card { padding: 1rem; }
.lpr-card dt { font-size: 0.75rem; color: var(--muted-foreground); }
.lpr-card dd { margin: 0.25rem 0 0; font-size: 1.5rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.lpr-panel { padding: 1rem; display: grid; gap: 0.75rem; min-width: 0; }
.lpr-panel h2 { margin: 0; font-size: 0.875rem; font-weight: 600; }
.lpr-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); gap: 0.75rem; }
.lpr-days { display: flex; align-items: flex-end; gap: 2px; height: 9rem; }
.lpr-days > div { flex: 1; min-width: 0; height: 100%; display: flex; align-items: flex-end; }
.lpr-days > div > span { display: block; width: 100%; min-height: 1px; border-radius: 3px 3px 0 0; background: var(--primary); opacity: 0.85; }
.lpr-days > div:hover > span { opacity: 1; }
.lpr-axis { display: flex; justify-content: space-between; font-size: 0.6875rem; color: var(--muted-foreground); }
.lpr-bars { display: grid; gap: 0.5rem; }
.lpr-bar { display: grid; gap: 0.25rem; font-size: 0.8125rem; }
.lpr-bar > div:first-child { display: flex; justify-content: space-between; gap: 0.75rem; }
.lpr-bar > div:first-child span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lpr-bar > div:first-child span:last-child { color: var(--muted-foreground); font-variant-numeric: tabular-nums; white-space: nowrap; }
.lpr-track { height: 0.375rem; border-radius: 999px; background: var(--muted); overflow: hidden; }
.lpr-track > span { display: block; height: 100%; border-radius: 999px; background: var(--primary); }
.lpr-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
.lpr-table th { text-align: left; font-weight: 500; color: var(--muted-foreground); padding: 0 0.5rem 0.5rem; white-space: nowrap; }
.lpr-table td { padding: 0.5rem; border-top: 1px solid var(--border); vertical-align: top; }
.lpr-table td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.lpr-table th.num { text-align: right; }
.lpr-scroll { overflow-x: auto; }
.lpr-heat { display: grid; grid-template-columns: 2rem repeat(24, minmax(0, 1fr)); gap: 2px; font-size: 0.625rem; color: var(--muted-foreground); }
.lpr-heat span { aspect-ratio: 1; border-radius: 2px; background: var(--primary); }
.lpr-heat .lpr-label { aspect-ratio: auto; background: none; display: flex; align-items: center; }
.lpr-muted { color: var(--muted-foreground); font-size: 0.875rem; }
`

export default function setup(lumio) {
  const t = TEXT[lumio.locale] ?? TEXT.en
  lumio.addStyle(STYLE)
  lumio.addSettingsPage({
    id: 'playback-reporting',
    label: t.title,
    admin: true,
    render(element) {
      return renderPage(element, lumio, t)
    },
  })
}

function renderPage(element, lumio, t) {
  const session = lumio.jellyfin
  const locale = lumio.locale === 'de' ? 'de-DE' : 'en-US'
  const number = new Intl.NumberFormat(locale)
  const state = { days: 30, types: ['Movie', 'Episode', 'Audio'], measure: 'count' }
  let alive = true

  const root = el('div', 'lpr')
  const controls = el('div', 'lpr-controls')
  const content = el('div', 'lpr')
  root.append(controls, content)
  element.append(root)

  // ---- controls ----
  const period = el('select')
  for (const [value, label] of [[7, t.days(7)], [30, t.days(30)], [90, t.days(90)], [365, t.year]]) {
    const option = el('option')
    option.value = String(value)
    option.textContent = label
    period.append(option)
  }
  period.value = String(state.days)
  period.addEventListener('change', () => {
    state.days = Number(period.value)
    load()
  })
  const measure = el('select')
  for (const [value, label] of [['count', t.count], ['time', t.time]]) {
    const option = el('option')
    option.value = value
    option.textContent = label
    measure.append(option)
  }
  measure.addEventListener('change', () => {
    state.measure = measure.value
    load()
  })
  const chips = el('div', 'lpr-chips')
  for (const type of ['Movie', 'Episode', 'Audio']) {
    const chip = el('button', 'lpr-chip')
    chip.type = 'button'
    chip.textContent = t.types[type]
    chip.setAttribute('aria-pressed', 'true')
    chip.addEventListener('click', () => {
      const on = state.types.includes(type)
      // At least one type stays chosen.
      if (on && state.types.length === 1) return
      state.types = on ? state.types.filter((entry) => entry !== type) : [...state.types, type]
      chip.setAttribute('aria-pressed', String(!on))
      load()
    })
    chips.append(chip)
  }
  controls.append(labelled(t.period, period), chips, labelled(t.measure, measure))

  // ---- data ----
  async function api(path) {
    const response = await fetch(`${session.serverUrl}/user_usage_stats/${path}`, {
      headers: { Authorization: `MediaBrowser Token="${session.accessToken}"` },
    })
    if (!response.ok) throw new Error(`Playback Reporting ${response.status}`)
    return response.json()
  }

  async function load() {
    if (!session) return
    content.replaceChildren(muted(t.loading))
    const end = new Date()
    const endDate = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`
    const offset = -end.getTimezoneOffset() / 60
    const range = `days=${state.days}&endDate=${endDate}&timezoneOffset=${offset}`
    const filter = `filter=${state.types.join(',')}`
    try {
      const [activity, perDay, byType, byMethod, byClient, byDevice, hourly] = await Promise.all([
        api(`user_activity?${range}`),
        api(`PlayActivity?${range}&${filter}&dataType=${state.measure}`),
        api(`ItemType/BreakdownReport?${range}`),
        api(`PlaybackMethod/BreakdownReport?${range}`),
        api(`ClientName/BreakdownReport?${range}`),
        api(`DeviceName/BreakdownReport?${range}`),
        api(`HourlyReport?${range}&${filter}`),
      ])
      if (alive) render({ activity, perDay, byType, byMethod, byClient, byDevice, hourly })
    } catch {
      if (alive) content.replaceChildren(muted(t.missing))
    }
  }

  // ---- rendering ----
  function render(data) {
    const typed = data.byType.filter((entry) => state.types.includes(entry.label))
    const plays = typed.reduce((sum, entry) => sum + entry.count, 0)
    const seconds = typed.reduce((sum, entry) => sum + entry.time, 0)
    const users = data.activity.filter((entry) => entry.total_count > 0)
    if (!plays && !users.length) {
      content.replaceChildren(muted(t.empty))
      return
    }

    const cards = el('dl', 'lpr-cards')
    cards.append(card(t.plays, number.format(plays)), card(t.totalTime, duration(seconds)), card(t.users, number.format(users.length)))

    // Plays (or time) per day, all users together.
    const days = new Map()
    for (const user of data.perDay) {
      if (user.user_id === 'labels_user') continue
      for (const [day, value] of Object.entries(user.user_usage ?? {})) days.set(day, (days.get(day) ?? 0) + value)
    }
    const dayList = [...days.entries()].sort(([a], [b]) => a.localeCompare(b))
    const max = Math.max(1, ...dayList.map(([, value]) => value))
    const bars = el('div', 'lpr-days')
    for (const [day, value] of dayList) {
      const column = el('div')
      column.title = `${formatDay(day)}: ${state.measure === 'time' ? duration(value) : number.format(value)}`
      const bar = el('span')
      bar.style.height = `${(value / max) * 100}%`
      column.append(bar)
      bars.append(column)
    }
    const axis = el('div', 'lpr-axis')
    axis.append(text(dayList[0] ? formatDay(dayList[0][0]) : ''), text(dayList.at(-1) ? formatDay(dayList.at(-1)[0]) : ''))
    const perDay = panel(t.perDay, bars, axis)

    // The users, most active first.
    const table = el('table', 'lpr-table')
    const head = el('tr')
    for (const [label, numeric] of [[t.user], [t.plays, true], [t.totalTime, true], [t.lastItem], [t.client], [t.lastSeen, true]]) {
      const cell = el('th', numeric ? 'num' : '')
      cell.textContent = label
      head.append(cell)
    }
    table.append(head)
    for (const user of [...users].sort((a, b) => b.total_count - a.total_count)) {
      const row = el('tr')
      row.append(
        cell(user.user_name),
        cell(number.format(user.total_count), true),
        cell(duration(user.total_time), true),
        cell(user.item_name ?? ''),
        cell(user.client_name ?? ''),
        cell(user.latest_date ? new Date(user.latest_date).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' }) : '', true),
      )
      table.append(row)
    }
    const scroll = el('div', 'lpr-scroll')
    scroll.append(table)
    const people = panel(t.people, scroll)

    const typeNames = (label) => t.types[label] ?? label
    const breakdowns = el('div', 'lpr-grid')
    breakdowns.append(
      panel(t.byType, barList(typed, typeNames)),
      panel(t.byMethod, barList(data.byMethod)),
      panel(t.byClient, barList(data.byClient)),
      panel(t.byDevice, barList(data.byDevice)),
    )

    content.replaceChildren(cards, perDay, people, breakdowns, panel(t.hours, heatmap(data.hourly)))
  }

  function barList(entries, name = (label) => label) {
    const list = el('div', 'lpr-bars')
    const key = state.measure === 'time' ? 'time' : 'count'
    const sorted = [...entries].filter((entry) => entry[key] > 0).sort((a, b) => b[key] - a[key]).slice(0, 8)
    const top = Math.max(1, ...sorted.map((entry) => entry[key]))
    if (!sorted.length) list.append(muted('–'))
    for (const entry of sorted) {
      const row = el('div', 'lpr-bar')
      const line = el('div')
      line.append(text(name(entry.label)), text(key === 'time' ? duration(entry.time) : number.format(entry.count)))
      const track = el('div', 'lpr-track')
      const fill = el('span')
      fill.style.width = `${(entry[key] / top) * 100}%`
      track.append(fill)
      row.append(line, track)
      list.append(row)
    }
    return list
  }

  /** Seven weekdays by 24 hours, darker where more was played. Keys are "<weekday>-<hour>", in seconds. */
  function heatmap(hourly) {
    const grid = el('div', 'lpr-heat')
    const top = Math.max(1, ...Object.values(hourly ?? {}))
    grid.append(el('span', 'lpr-label'))
    for (let hour = 0; hour < 24; hour++) {
      const label = el('span', 'lpr-label')
      label.textContent = hour % 3 === 0 ? String(hour) : ''
      grid.append(label)
    }
    for (let day = 0; day < 7; day++) {
      const label = el('span', 'lpr-label')
      label.textContent = t.weekdays[day]
      grid.append(label)
      for (let hour = 0; hour < 24; hour++) {
        const value = hourly?.[`${day}-${pad(hour)}`] ?? 0
        const square = el('span')
        square.style.opacity = String(value ? 0.12 + (value / top) * 0.88 : 0.05)
        square.title = `${t.weekdays[day]} ${pad(hour)}:00 – ${duration(value)}`
        grid.append(square)
      }
    }
    return grid
  }

  function duration(seconds) {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.round((seconds % 3600) / 60)
    if (hours >= 24) return `${number.format(Math.floor(hours / 24))} d ${hours % 24} h`
    return hours ? `${hours} h ${minutes} min` : `${minutes} min`
  }

  function formatDay(day) {
    return new Date(`${day}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
  }

  load()
  return () => {
    alive = false
    root.remove()
  }
}

// ---- small DOM helpers ----

function el(tag, className) {
  const node = document.createElement(tag)
  if (className) node.className = className
  return node
}

function text(value) {
  const span = el('span')
  span.textContent = value
  return span
}

function muted(value) {
  const p = el('p', 'lpr-muted')
  p.textContent = value
  return p
}

function labelled(label, control) {
  const wrapper = el('label')
  wrapper.append(label, control)
  return wrapper
}

function card(label, value) {
  const wrapper = el('div', 'lpr-card')
  const term = el('dt')
  term.textContent = label
  const detail = el('dd')
  detail.textContent = value
  wrapper.append(term, detail)
  return wrapper
}

function panel(title, ...children) {
  const section = el('section', 'lpr-panel')
  const heading = el('h2')
  heading.textContent = title
  section.append(heading, ...children)
  return section
}

function cell(value, numeric) {
  const td = el('td', numeric ? 'num' : '')
  td.textContent = value
  return td
}

function pad(value) {
  return String(value).padStart(2, '0')
}
