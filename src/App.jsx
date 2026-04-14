import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'

const COLORS = {
  canvas: '#F7F1E8',
  ink: '#221B1B',
  stone: '#685D58',
  canyon: '#A54A2A',
  clay: '#C9733D',
  sand: '#E6C48D',
  sky: '#D6E4F0',
  cream: '#FFFDF8',
  slate: '#ECE8E1',
}

const PAGE = { maxWidth: 1200, margin: '0 auto', padding: '0 28px' }
const NOMINATIM_BASE = import.meta.env.VITE_GEOLAYERS_NOMINATIM_BASE || 'https://nominatim.openstreetmap.org'
const MACROSTRAT_BASE = import.meta.env.VITE_GEOLAYERS_MACROSTRAT_BASE || 'https://macrostrat.org/api'
const MAP_EMBED_BASE = import.meta.env.VITE_GEOLAYERS_MAP_EMBED_BASE || 'https://www.openstreetmap.org/export/embed.html'
const CACHE_KEY = 'geolayers-site-cache-v1'

const PRESETS = [
  {
    id: 'moab',
    name: 'Moab Rim',
    query: 'Moab, UT',
    coords: { lat: 38.5733, lng: -109.5498 },
    threshold: 0.9,
    summary: 'A red-rock stack where resistant sandstones hold the walls and softer mudstones weather out beneath them.',
    story: 'Around Moab, wind-built dunes hardened into sandstone, floodplains laid down mud and silt, and later uplift and erosion exposed the cliff bands.',
    layers: [
      { name: 'Entrada Sandstone', age: 'Middle Jurassic', material: 'fine sandstone', thickness: '120-170 ft', note: 'Rounded slickrock domes and warm orange surfaces.', color: '#D1824B' },
      { name: 'Carmel Formation', age: 'Middle Jurassic', material: 'siltstone, mudstone, gypsum', thickness: '80-160 ft', note: 'A softer interval between stronger cliff units.', color: '#C8A37A' },
      { name: 'Navajo Sandstone', age: 'Early Jurassic', material: 'cross-bedded dune sandstone', thickness: '250-400 ft', note: 'A major ancient dune sea preserved as massive sandstone.', color: '#E7C997' },
      { name: 'Kayenta Formation', age: 'Early Jurassic', material: 'sandstone and siltstone', thickness: '150-240 ft', note: 'Interbedded ledges linked to older stream systems.', color: '#9D6845' },
      { name: 'Wingate Sandstone', age: 'Late Triassic', material: 'eolian sandstone', thickness: '250-320 ft', note: 'Tall vertical cliffs that define canyon-country walls.', color: '#A3472E' },
      { name: 'Chinle Formation', age: 'Late Triassic', material: 'mudstone, siltstone, sandstone', thickness: '300-450 ft', note: 'Colorful slopes beneath harder units.', color: '#7B5A4E' },
    ],
  },
  {
    id: 'zion',
    name: 'Zion Canyon',
    query: 'Zion National Park, UT',
    coords: { lat: 37.2982, lng: -113.0263 },
    threshold: 0.8,
    summary: 'A canyon wall sequence where benches and cliffs mark changes in ancient desert and river environments.',
    story: 'The Zion stack records deserts, rivers, and floodplains laid down in sequence. Navajo Sandstone dominates the canyon walls, but the ledges and slope formers shape how the canyon is read.',
    layers: [
      { name: 'Temple Cap Formation', age: 'Early Jurassic', material: 'siltstone and sandstone', thickness: '80-140 ft', note: 'A transition interval above the main dune sea.', color: '#B55B46' },
      { name: 'Navajo Sandstone', age: 'Early Jurassic', material: 'cross-bedded sandstone', thickness: '1500-2200 ft', note: 'The main Zion wall-builder.', color: '#E9D4A1' },
      { name: 'Kayenta Formation', age: 'Early Jurassic', material: 'sandstone and shale', thickness: '150-250 ft', note: 'A ledgy interval tied to river systems.', color: '#A86D48' },
      { name: 'Moenave Formation', age: 'Early Jurassic', material: 'mudstone and sandstone', thickness: '150-250 ft', note: 'Lower red beds that create slopes and benches.', color: '#91543A' },
      { name: 'Chinle Formation', age: 'Late Triassic', material: 'mudstone and conglomeratic beds', thickness: '250-400 ft', note: 'A softer base with wetter floodplain deposits.', color: '#6F584F' },
    ],
  },
  {
    id: 'capitol-reef',
    name: 'Capitol Reef Fold',
    query: 'Capitol Reef National Park, UT',
    coords: { lat: 38.282, lng: -111.2615 },
    threshold: 0.9,
    summary: 'A tilted sedimentary stack that makes structure and stratigraphy easy to read together.',
    story: 'The Waterpocket Fold bends a long sedimentary sequence into ribs, domes, slopes, and badlands. Resistant sandstones and weaker layers are both visible in the landforms.',
    layers: [
      { name: 'Navajo Sandstone', age: 'Early Jurassic', material: 'massive dune sandstone', thickness: '800-1400 ft', note: 'Light-toned domes and smooth surfaces.', color: '#E8CE98' },
      { name: 'Kayenta Formation', age: 'Early Jurassic', material: 'sandstone and siltstone', thickness: '150-250 ft', note: 'Benches and ledges between more massive units.', color: '#AB724B' },
      { name: 'Wingate Sandstone', age: 'Late Triassic', material: 'eolian sandstone', thickness: '250-320 ft', note: 'A steep cliff-forming wall that emphasizes the fold.', color: '#9C442C' },
      { name: 'Chinle Formation', age: 'Late Triassic', material: 'mudstone, volcanic ash-rich beds, sandstone', thickness: '300-450 ft', note: 'Purple, red, and gray slope-forming beds.', color: '#7B605A' },
      { name: 'Moenkopi Formation', age: 'Early to Middle Triassic', material: 'siltstone and shale', thickness: '600-900 ft', note: 'Broad red-brown slopes lower in the stack.', color: '#8B5D43' },
    ],
  },
]

function safeStorageRead() {
  try {
    return JSON.parse(window.localStorage.getItem(CACHE_KEY) || '{"geocode":{},"reverse":{},"geology":{}}')
  } catch {
    return { geocode: {}, reverse: {}, geology: {} }
  }
}

function safeStorageWrite(cache) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // Ignore storage failures.
  }
}

function readCachedValue(bucket, key) {
  if (typeof window === 'undefined') return null
  const cache = safeStorageRead()
  return cache[bucket]?.[key] ?? null
}

function writeCachedValue(bucket, key, value) {
  if (typeof window === 'undefined') return
  const cache = safeStorageRead()
  cache[bucket] = cache[bucket] || {}
  cache[bucket][key] = value
  safeStorageWrite(cache)
}

function parseCoordinateQuery(query) {
  const match = query.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/)
  if (!match) return null
  const lat = Number.parseFloat(match[1])
  const lng = Number.parseFloat(match[2])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

function distance(left, right) {
  return Math.sqrt((left.lat - right.lat) ** 2 + (left.lng - right.lng) ** 2)
}

function pickPreset(lat, lng) {
  const scored = PRESETS.map((preset) => ({ preset, distance: distance(preset.coords, { lat, lng }) })).sort((a, b) => a.distance - b.distance)[0]
  if (!scored) return null
  return scored.distance <= scored.preset.threshold ? scored.preset : null
}

function buildMapUrl(location) {
  const [south, north, west, east] = (location.boundingbox || []).map(Number.parseFloat)
  const bbox = Number.isFinite(south) && Number.isFinite(north) && Number.isFinite(west) && Number.isFinite(east)
    ? `${west},${south},${east},${north}`
    : `${location.lng - 0.08},${location.lat - 0.05},${location.lng + 0.08},${location.lat + 0.05}`
  const url = new URL(MAP_EMBED_BASE)
  url.searchParams.set('bbox', bbox)
  url.searchParams.set('layer', 'mapnik')
  url.searchParams.set('marker', `${location.lat},${location.lng}`)
  return url.toString()
}

function buildMapLink(location) {
  return `https://www.openstreetmap.org/?mlat=${location.lat}&mlon=${location.lng}#map=11/${location.lat}/${location.lng}`
}

function ageRange(unit) {
  const top = Number.isFinite(unit.topAge) ? unit.topAge : null
  const base = Number.isFinite(unit.baseAge) ? unit.baseAge : null
  if (top === null && base === null) return 'Age unavailable'
  if (top === null || base === null) return `${top ?? base} Ma`
  return `${base} to ${top} Ma`
}

function simplifyLocation(raw, fallback) {
  return {
    lat: Number.parseFloat(raw.lat ?? fallback.lat),
    lng: Number.parseFloat(raw.lon ?? raw.lng ?? fallback.lng),
    displayName: raw.display_name || `${fallback.lat}, ${fallback.lng}`,
    boundingbox: raw.boundingbox || [],
    category: raw.category || raw.class || 'place',
    type: raw.type || 'location',
    address: raw.address || {},
    sourceMode: raw.sourceMode || fallback.sourceMode || 'search',
  }
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Request failed with status ${response.status}`)
  return response.json()
}

async function geocodeQuery(query) {
  const parsed = parseCoordinateQuery(query)
  if (parsed) {
    const key = `${parsed.lat.toFixed(5)},${parsed.lng.toFixed(5)}`
    const cached = readCachedValue('reverse', key)
    if (cached) return cached
    const url = new URL(`${NOMINATIM_BASE}/reverse`)
    url.searchParams.set('lat', String(parsed.lat))
    url.searchParams.set('lon', String(parsed.lng))
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('addressdetails', '1')
    url.searchParams.set('accept-language', 'en-US,en')
    const raw = await fetchJson(url.toString())
    const location = simplifyLocation({ ...raw, sourceMode: 'reverse' }, { ...parsed, sourceMode: 'reverse' })
    writeCachedValue('reverse', key, location)
    return location
  }

  const normalized = query.trim().toLowerCase()
  const cached = readCachedValue('geocode', normalized)
  if (cached) return cached
  const url = new URL(`${NOMINATIM_BASE}/search`)
  url.searchParams.set('q', query.trim())
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '1')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('accept-language', 'en-US,en')
  const results = await fetchJson(url.toString())
  if (!Array.isArray(results) || results.length === 0) throw new Error('No place match found for that query.')
  const location = simplifyLocation({ ...results[0], sourceMode: 'search' }, {})
  writeCachedValue('geocode', normalized, location)
  return location
}

async function fetchGeology(lat, lng) {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`
  const cached = readCachedValue('geology', key)
  if (cached) return cached
  const url = new URL(`${MACROSTRAT_BASE}/geologic_units/map`)
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lng', String(lng))
  url.searchParams.set('format', 'json')
  const raw = await fetchJson(url.toString())
  const success = raw.success || {}
  const geology = {
    units: (success.data || []).map((unit) => ({
      id: unit.map_id,
      name: unit.name || 'Unnamed geologic unit',
      stratName: unit.strat_name || '',
      lith: unit.lith || 'Lithology unavailable',
      description: unit.descrip || '',
      bestInterval: unit.best_int_name || '',
      topAge: unit.t_age,
      baseAge: unit.b_age,
      color: unit.color || '#B8A8A0',
      sourceId: unit.source_id,
    })),
    refs: success.refs || {},
  }
  writeCachedValue('geology', key, geology)
  return geology
}

function buildRegionalStory(location, geology) {
  const preset = pickPreset(location.lat, location.lng)
  if (!preset) return null
  const state = location.address?.state || location.displayName || ''
  if (!String(state).toLowerCase().includes('utah')) return null
  return { ...preset, liveUnitName: geology.units[0]?.name || null }
}

function buildNarrative(geology, regionalStory) {
  const primary = geology.units[0]
  if (!primary) {
    return 'Macrostrat returned no mapped surface units for this point. That usually means the point falls outside a supported polygon or inside a map-resolution gap.'
  }
  const parts = []
  if (primary.name) parts.push(`${primary.name} is the strongest mapped surface unit at this point.`)
  if (primary.lith && primary.lith !== 'Lithology unavailable') parts.push(`Macrostrat lists the lithology as ${primary.lith.toLowerCase()}.`)
  if (primary.description) parts.push(primary.description)
  if (regionalStory) parts.push(`This point also aligns with the ${regionalStory.name} regional stack.`)
  return parts.join(' ')
}

function LayerBar({ layer, index, total }) {
  const pct = Math.max(18, Math.round(((total - index) / total) * 100))
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 18, alignItems: 'stretch', padding: '14px 0', borderTop: index === 0 ? 'none' : '1px solid rgba(34,27,27,0.08)' }}>
      <div style={{ borderRadius: 16, minHeight: 84, background: `linear-gradient(180deg, ${layer.color}, ${layer.color}CC)`, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 'auto 0 0 0', height: `${pct}%`, background: 'rgba(255,255,255,0.16)' }} />
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'baseline', marginBottom: 8, flexWrap: 'wrap' }}>
          <h3 style={{ fontSize: '1.1rem', color: COLORS.ink }}>{layer.name}</h3>
          <span style={{ fontFamily: 'var(--font-display)', color: COLORS.canyon, fontSize: '0.82rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{layer.age}</span>
        </div>
        <p style={{ color: COLORS.stone, lineHeight: 1.7, marginBottom: 8 }}>{layer.material} | {layer.thickness}</p>
        <p style={{ color: COLORS.ink, lineHeight: 1.75 }}>{layer.note}</p>
      </div>
    </div>
  )
}

function UnitCard({ unit, sourceRef, isPrimary }) {
  return (
    <div style={{ borderRadius: 20, padding: 18, background: isPrimary ? '#F8EFE7' : COLORS.cream, border: `1px solid ${isPrimary ? 'rgba(165,74,42,0.18)' : 'rgba(34,27,27,0.08)'}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: COLORS.ink }}>{unit.name}</div>
          {unit.stratName ? <div style={{ color: COLORS.stone, marginTop: 4 }}>{unit.stratName}</div> : null}
        </div>
        <span style={{ alignSelf: 'flex-start', borderRadius: 999, background: unit.color, minWidth: 42, minHeight: 24, border: '1px solid rgba(34,27,27,0.08)' }} />
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        <div style={metaRowStyle}><strong>Interval:</strong> {unit.bestInterval || 'Unspecified'} ({ageRange(unit)})</div>
        <div style={metaRowStyle}><strong>Lithology:</strong> {unit.lith}</div>
        {unit.description ? <div style={metaRowStyle}><strong>Setting:</strong> {unit.description}</div> : null}
        {sourceRef ? <div style={metaRowStyle}><strong>Source:</strong> {sourceRef}</div> : null}
      </div>
    </div>
  )
}

function FeedbackForm({ defaultLocation }) {
  const [form, setForm] = useState({ name: '', email: '', location: defaultLocation, useCase: '', notes: '' })
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    setForm((current) => ({ ...current, location: defaultLocation || current.location }))
  }, [defaultLocation])

  const onChange = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  const onSubmit = async (event) => {
    event.preventDefault()
    setStatus('loading')
    setMessage('')
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to save feedback.')
      setStatus('success')
      setMessage('Saved. I will use this to prioritize the next build pass.')
      setForm((current) => ({ ...current, notes: '', useCase: '' }))
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Unable to save feedback.')
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="content-grid">
        <input value={form.name} onChange={(event) => onChange('name', event.target.value)} placeholder="Name" style={inputStyle} required />
        <input value={form.email} onChange={(event) => onChange('email', event.target.value)} placeholder="Email" type="email" style={inputStyle} required />
      </div>
      <input value={form.location} onChange={(event) => onChange('location', event.target.value)} placeholder="Location you tested" style={inputStyle} />
      <input value={form.useCase} onChange={(event) => onChange('useCase', event.target.value)} placeholder="What you needed from the tool" style={inputStyle} />
      <textarea value={form.notes} onChange={(event) => onChange('notes', event.target.value)} placeholder="What worked, what failed, what you want next" style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }} required />
      <button type="submit" disabled={status === 'loading'} style={{ ...buttonStyle, opacity: status === 'loading' ? 0.7 : 1 }}>
        {status === 'loading' ? 'Saving...' : 'Send feedback'}
      </button>
      {message ? <p style={{ color: status === 'error' ? '#8F2C2C' : COLORS.stone, lineHeight: 1.7 }}>{message}</p> : null}
    </form>
  )
}

export default function App() {
  const [query, setQuery] = useState('Moab, UT')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const runAnalysis = async (nextQuery = query) => {
    const trimmed = nextQuery.trim()
    if (!trimmed) return
    setLoading(true)
    setError('')
    try {
      const location = await geocodeQuery(trimmed)
      const geology = await fetchGeology(location.lat, location.lng)
      const regionalStory = buildRegionalStory(location, geology)
      setResult({
        location,
        geology,
        regionalStory,
        mapUrl: buildMapUrl(location),
        mapLink: buildMapLink(location),
        narrative: buildNarrative(geology, regionalStory),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong while reading this place.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void runAnalysis('Moab, UT')
  }, [])

  const primaryUnit = useMemo(() => result?.geology.units?.[0] ?? null, [result])
  const additionalUnits = useMemo(() => result?.geology.units?.slice(1, 5) ?? [], [result])

  return (
    <div style={{ background: COLORS.canvas, minHeight: '100vh', color: COLORS.ink }}>
      <section style={{ background: `linear-gradient(160deg, ${COLORS.sky} 0%, ${COLORS.sand} 48%, ${COLORS.clay} 100%)`, padding: '96px 0 72px', borderBottom: '1px solid rgba(34,27,27,0.08)' }}>
        <div style={PAGE}>
          <div className="hero-grid" style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 28, alignItems: 'end' }}>
            <div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.14em', color: COLORS.canyon, marginBottom: 18 }}>
                GeoLayers
              </p>
              <h1 style={{ fontSize: 'clamp(3rem, 7vw, 5.6rem)', lineHeight: 0.95, marginBottom: 20 }}>
                Read the ground.
              </h1>
              <p style={{ fontSize: '1.15rem', lineHeight: 1.8, maxWidth: 650, color: '#3B312F' }}>
                Enter a place or coordinates. GeoLayers resolves the location, reads live geologic units from Macrostrat, and adds Utah stack stories where the point matches a curated region.
              </p>
            </div>
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} style={{ background: 'rgba(255,253,248,0.92)', borderRadius: 24, padding: 24, boxShadow: '0 18px 40px rgba(73,42,26,0.16)' }}>
              <form onSubmit={(event) => { event.preventDefault(); void runAnalysis() }} style={{ display: 'grid', gap: 14 }}>
                <label>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                    Address, place, or lat,lng
                  </div>
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Moab, UT or 38.5733, -109.5498" style={inputStyle} />
                </label>
                <button type="submit" disabled={loading} style={{ ...buttonStyle, opacity: loading ? 0.7 : 1 }}>
                  {loading ? 'Reading place...' : 'Read this place'}
                </button>
                <p style={{ color: COLORS.stone, fontSize: '0.92rem', lineHeight: 1.6 }}>
                  Requests are user-triggered and cached locally in the browser to stay inside public-service limits.
                </p>
                {error ? <p style={{ color: '#9D2F2F', fontSize: '0.95rem', lineHeight: 1.6 }}>{error}</p> : null}
              </form>
            </motion.div>
          </div>
        </div>
      </section>

      <section style={{ padding: '28px 0 0' }}>
        <div style={PAGE}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {PRESETS.map((preset) => (
              <button key={preset.id} type="button" onClick={() => { setQuery(preset.query); void runAnalysis(preset.query) }} style={{ borderRadius: 999, border: '1px solid rgba(34,27,27,0.1)', padding: '10px 16px', background: COLORS.cream, color: COLORS.ink, fontFamily: 'var(--font-display)', cursor: 'pointer' }}>
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      {result ? (
        <section style={{ padding: '28px 0 72px' }}>
          <div style={PAGE}>
            <div className="content-grid" style={{ display: 'grid', gridTemplateColumns: '0.95fr 1.05fr', gap: 22, alignItems: 'start' }}>
              <div style={panelStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'start', flexWrap: 'wrap', marginBottom: 16 }}>
                  <div>
                    <p style={{ color: COLORS.canyon, fontFamily: 'var(--font-display)', fontSize: '0.74rem', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Place fix</p>
                    <h2 style={{ fontSize: '1.85rem', marginBottom: 6 }}>{result.location.displayName}</h2>
                    <p style={{ color: COLORS.stone }}>{result.location.sourceMode === 'reverse' ? 'Reverse-geocoded from coordinates' : 'Geocoded from search input'}</p>
                  </div>
                  <span style={{ borderRadius: 999, background: '#FFF1E5', color: COLORS.canyon, padding: '8px 12px', fontSize: '0.78rem', fontFamily: 'var(--font-display)' }}>Live data</span>
                </div>
                <div style={metaGroupStyle}>
                  <div>
                    <div style={metaLabelStyle}>Coordinates</div>
                    <div style={metaValueStyle}>{result.location.lat.toFixed(5)}, {result.location.lng.toFixed(5)}</div>
                  </div>
                  <div>
                    <div style={metaLabelStyle}>Mapped object</div>
                    <div style={metaValueStyle}>{result.location.category} / {result.location.type}</div>
                  </div>
                </div>
                <div style={{ marginTop: 22 }}>
                  <div style={metaLabelStyle}>Ground read</div>
                  <p style={{ lineHeight: 1.82, marginTop: 10 }}>{result.narrative}</p>
                </div>
                <div style={{ marginTop: 22 }}>
                  <div style={metaLabelStyle}>Sources</div>
                  <p style={{ lineHeight: 1.8, marginTop: 10 }}>
                    OpenStreetMap supplies geocoding and map display. Macrostrat supplies the geologic unit lookup and source references.
                  </p>
                </div>
              </div>
              <div style={panelStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '1.55rem' }}>Location map</h2>
                  <a href={result.mapLink} target="_blank" rel="noreferrer" style={linkStyle}>Open larger map</a>
                </div>
                <div style={{ borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(34,27,27,0.08)', background: COLORS.slate }}>
                  <iframe title="GeoLayers map" src={result.mapUrl} style={{ width: '100%', height: 340, border: 'none' }} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
                </div>
                <p style={{ color: COLORS.stone, fontSize: '0.88rem', lineHeight: 1.6, marginTop: 12 }}>
                  Map data: OpenStreetMap contributors. Geology read: Macrostrat, CC-BY 4.0.
                </p>
              </div>
            </div>

            <div className="content-grid" style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 22, alignItems: 'start', marginTop: 22 }}>
              <div style={panelStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '1.55rem' }}>Live geologic units</h2>
                  <span style={{ color: COLORS.stone, fontSize: '0.92rem' }}>{result.geology.units.length || 0} Macrostrat matches at this point</span>
                </div>
                {primaryUnit ? (
                  <div style={{ display: 'grid', gap: 14 }}>
                    <UnitCard unit={primaryUnit} sourceRef={result.geology.refs[String(primaryUnit.sourceId)]} isPrimary />
                    {additionalUnits.map((unit) => (
                      <UnitCard key={unit.id} unit={unit} sourceRef={result.geology.refs[String(unit.sourceId)]} />
                    ))}
                  </div>
                ) : (
                  <p style={{ color: COLORS.stone, lineHeight: 1.8 }}>
                    No mapped geologic units came back for this point. Try a nearby town, park, or exposed landscape instead of a narrow coordinate slice.
                  </p>
                )}
              </div>
              <div style={panelStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '1.55rem' }}>Regional stack story</h2>
                  <span style={{ color: result.regionalStory ? COLORS.canyon : COLORS.stone, fontSize: '0.88rem' }}>
                    {result.regionalStory ? result.regionalStory.name : 'No Utah demo match'}
                  </span>
                </div>
                {result.regionalStory ? (
                  <>
                    <p style={{ lineHeight: 1.8, marginBottom: 12 }}>{result.regionalStory.summary}</p>
                    <p style={{ lineHeight: 1.8, color: COLORS.stone, marginBottom: 10 }}>{result.regionalStory.story}</p>
                    <div style={{ marginTop: 8 }}>
                      {result.regionalStory.layers.map((layer, index) => (
                        <LayerBar key={layer.name} layer={layer} index={index} total={result.regionalStory.layers.length} />
                      ))}
                    </div>
                  </>
                ) : (
                  <p style={{ color: COLORS.stone, lineHeight: 1.8 }}>
                    The live lookup works across the supported sources. The illustrated stack is still Utah-first and appears only when the point lands in a curated region.
                  </p>
                )}
              </div>
            </div>

            <div className="triple-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, marginTop: 22 }}>
              <div style={noteCardStyle}>
                <p style={noteTitleStyle}>Current product</p>
                <p style={noteBodyStyle}>GeoLayers resolves a place, reads live surface geology, and adds a deeper stack when it can do so honestly.</p>
              </div>
              <div style={noteCardStyle}>
                <p style={noteTitleStyle}>Scope</p>
                <p style={noteBodyStyle}>GeoLayers is a place-reading tool. Engineering, drilling, hazard, and parcel-scale subsurface work require different tools and data.</p>
              </div>
              <div style={noteCardStyle}>
                <p style={noteTitleStyle}>Next build step</p>
                <p style={noteBodyStyle}>The next major expansion is better map layering and regional stack coverage outside the current Utah-first set.</p>
              </div>
            </div>

            <div className="content-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22, marginTop: 22 }}>
              <div style={panelStyle}>
                <h2 style={{ fontSize: '1.45rem', marginBottom: 12 }}>Feedback</h2>
                <p style={{ color: COLORS.stone, lineHeight: 1.75, marginBottom: 18 }}>
                  Send test notes, use cases, and failed queries. This feeds the next round of coverage and map work.
                </p>
                <FeedbackForm defaultLocation={result.location.displayName} />
              </div>
              <div style={panelStyle}>
                <h2 style={{ fontSize: '1.45rem', marginBottom: 12 }}>Why this site exists</h2>
                <p style={{ color: COLORS.stone, lineHeight: 1.82 }}>
                  Most geology tools assume technical fluency. GeoLayers is built for people who want to understand the ground under a place without opening six PDFs and a GIS workstation.
                </p>
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}

const inputStyle = {
  width: '100%',
  border: '1px solid rgba(34,27,27,0.12)',
  borderRadius: 14,
  background: '#fff',
  padding: '14px 16px',
  fontFamily: 'var(--font-body)',
  fontSize: '1rem',
  color: COLORS.ink,
}

const buttonStyle = {
  width: '100%',
  border: 'none',
  borderRadius: 16,
  background: COLORS.ink,
  color: '#fff',
  padding: '14px 18px',
  fontFamily: 'var(--font-display)',
  fontSize: '0.96rem',
  cursor: 'pointer',
}

const panelStyle = {
  background: COLORS.cream,
  borderRadius: 24,
  padding: 24,
  border: '1px solid rgba(34,27,27,0.08)',
  boxShadow: '0 18px 40px rgba(34,27,27,0.04)',
}

const metaGroupStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 14,
}

const metaLabelStyle = {
  fontFamily: 'var(--font-display)',
  fontSize: '0.76rem',
  letterSpacing: '0.09em',
  textTransform: 'uppercase',
  color: COLORS.canyon,
}

const metaValueStyle = {
  marginTop: 8,
  color: COLORS.ink,
  lineHeight: 1.7,
}

const metaRowStyle = {
  color: COLORS.ink,
  lineHeight: 1.75,
}

const noteCardStyle = {
  background: '#F1E6D4',
  borderRadius: 22,
  padding: 20,
}

const noteTitleStyle = {
  fontFamily: 'var(--font-display)',
  fontSize: '0.84rem',
  letterSpacing: '0.09em',
  textTransform: 'uppercase',
  color: COLORS.canyon,
  marginBottom: 10,
}

const noteBodyStyle = {
  lineHeight: 1.8,
  color: COLORS.ink,
}

const linkStyle = {
  color: COLORS.canyon,
  textDecoration: 'none',
  fontFamily: 'var(--font-display)',
  fontSize: '0.9rem',
}
