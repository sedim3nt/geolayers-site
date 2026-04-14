# GeoLayers

GeoLayers reads a place through geology. Enter a place or coordinates and the site resolves the location, pulls live geologic units from Macrostrat, and adds Utah-first stack stories where a point matches a curated region.

## Local development

```bash
npm install
npm run dev
```

## Environment

See `.env.example`.

## Data sources

- Nominatim for geocoding and reverse geocoding
- OpenStreetMap for map display
- Macrostrat for geologic unit lookup
- Airtable for feedback capture
