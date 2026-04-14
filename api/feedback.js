export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { name, email, location, useCase, notes } = req.body || {}
  if (!name || !email || !notes) {
    res.status(400).json({ error: 'Missing required fields' })
    return
  }

  const AIRTABLE_PAT = process.env.AIRTABLE_PAT
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID
  const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || 'Table 1'

  if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
    res.status(500).json({ error: 'Airtable is not configured' })
    return
  }

  try {
    const payload = {
      records: [
        {
          fields: {
            Name: `${name} | GeoLayers`,
            Notes: [
              `Email: ${email}`,
              `Location: ${location || ''}`,
              `Use case: ${useCase || ''}`,
              '',
              notes,
            ].join('\n'),
          },
        },
      ],
    }

    const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error(error)
      res.status(502).json({ error: 'Airtable write failed' })
      return
    }

    res.status(200).json({ ok: true })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Unable to save feedback' })
  }
}
