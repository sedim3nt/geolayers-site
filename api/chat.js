const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = 'anthropic/claude-haiku-4.5'

const FALLBACK_REPLY =
  "The geologist is offline right now (no AI key is configured on this deployment), so I can't answer live questions yet. In the meantime, the panels above show the live Macrostrat surface units, the place fix, and—where it matches a curated region—the regional stack story for the spot you looked up."

function buildContextBlock(context) {
  if (!context || typeof context !== 'object') return 'No location is currently loaded.'

  const lines = []
  const loc = context.location || {}
  if (loc.displayName) lines.push(`Looked-up place: ${loc.displayName}`)
  if (Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) {
    lines.push(`Coordinates: ${Number(loc.lat).toFixed(5)}, ${Number(loc.lng).toFixed(5)}`)
  }

  const units = Array.isArray(context.units) ? context.units : []
  if (units.length) {
    lines.push('')
    lines.push('Mapped surface geologic units (from Macrostrat, strongest first):')
    units.slice(0, 5).forEach((unit, index) => {
      const parts = [`${index + 1}. ${unit.name || 'Unnamed unit'}`]
      if (unit.stratName) parts.push(`(${unit.stratName})`)
      if (unit.lith && unit.lith !== 'Lithology unavailable') parts.push(`- lithology: ${unit.lith}`)
      if (unit.bestInterval) parts.push(`- interval: ${unit.bestInterval}`)
      if (unit.ageRange) parts.push(`- age: ${unit.ageRange}`)
      lines.push(`   ${parts.join(' ')}`)
      if (unit.description) lines.push(`      setting: ${unit.description}`)
    })
  } else {
    lines.push('Macrostrat returned no mapped surface units for this point.')
  }

  if (context.narrative) {
    lines.push('')
    lines.push(`Ground read summary: ${context.narrative}`)
  }

  if (context.regionalStory) {
    const story = context.regionalStory
    lines.push('')
    lines.push(`Regional stack story (${story.name || 'curated region'}):`)
    if (story.summary) lines.push(`   ${story.summary}`)
    if (story.story) lines.push(`   ${story.story}`)
    if (Array.isArray(story.layers) && story.layers.length) {
      lines.push('   Layers (top to bottom):')
      story.layers.forEach((layer) => {
        const bits = [layer.name]
        if (layer.age) bits.push(layer.age)
        if (layer.material) bits.push(layer.material)
        lines.push(`     - ${bits.filter(Boolean).join(' | ')}`)
      })
    }
  }

  return lines.join('\n')
}

const SYSTEM_PROMPT = [
  'You are a friendly, accurate field geologist embedded in the GeoLayers app, which helps everyday people understand "what is the geology under me".',
  'Answer questions about rocks, minerals, formations, geologic time, landscapes, and especially the geology of the place the user is currently looking at.',
  'You are given the app\'s current geology context: the looked-up location, the live Macrostrat surface units, the ground-read summary, and (when available) a regional stack story. Ground your answers in that context whenever the question is about "here", "this place", "under me", or the named location.',
  'Be accurate. If the provided context does not contain the answer, say what is and is not known rather than inventing specifics. Macrostrat is a map-resolution dataset, so be honest about uncertainty.',
  'Keep answers concise and in plain language a curious non-geologist can follow. Avoid jargon, or define it briefly when you must use it. Do not use markdown headers or long bulleted essays; a few short sentences is usually right.',
].join(' ')

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { messages, context } = req.body || {}
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'Missing messages' })
    return
  }

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
  if (!OPENROUTER_API_KEY) {
    res.status(200).json({ reply: FALLBACK_REPLY, fallback: true })
    return
  }

  const chatMessages = messages
    .filter((message) => message && (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string')
    .slice(-12)
    .map((message) => ({ role: message.role, content: message.content }))

  if (chatMessages.length === 0) {
    res.status(400).json({ error: 'No valid messages' })
    return
  }

  const systemContent = `${SYSTEM_PROMPT}\n\nCurrent geology context:\n${buildContextBlock(context)}`

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://geolayers.app',
        'X-Title': 'GeoLayers',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 700,
        messages: [{ role: 'system', content: systemContent }, ...chatMessages],
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error(error)
      res.status(502).json({ error: 'The geologist could not be reached just now. Try again in a moment.' })
      return
    }

    const data = await response.json()
    const reply = data?.choices?.[0]?.message?.content?.trim()
    if (!reply) {
      res.status(502).json({ error: 'The geologist returned an empty answer. Try rephrasing your question.' })
      return
    }

    res.status(200).json({ reply })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Unable to reach the geologist right now.' })
  }
}
