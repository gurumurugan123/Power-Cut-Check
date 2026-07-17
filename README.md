# Power Cut Check

Power Cut Check is a mobile-first React app that checks whether a user's area has a planned TNPDCL/TANGEDCO power shutdown.

The user does not need to know their electricity circle. The app gets GPS location, reverse-geocodes it to local area names, then matches those names against a scraped shutdown dataset.

## Features

- GPS-based area detection using browser geolocation
- Reverse geocoding with OpenStreetMap Nominatim
- Multi-candidate matching: suburb, neighbourhood, village, road, display-name parts, city/county fallbacks
- Fuzzy search with `fuse.js`
- Manual area search with autocomplete
- Live dataset loading from `public/shutdowns.json`
- Free local Tesseract OCR scraper for TNPDCL CAPTCHA
- Static-site deployable frontend

## Frontend Setup

```powershell
npm install
npm run dev
```

If Node is not installed globally, use the included helper:

```powershell
.\dev.bat
```

Open the URL Vite prints, usually:

```text
http://localhost:5173
```

## Build

```powershell
npm run build
npm run preview
```

Deploy the `dist/` folder to Vercel, Netlify, or any static host.

## Data Flow

```text
TNPDCL website
  -> scraper with free Tesseract OCR
  -> public/shutdowns.json
  -> React app
  -> GPS / manual search match
  -> result card
```

The frontend first fetches:

```text
/shutdowns.json
```

If that file is missing or invalid, it falls back to:

```text
src/data/shutdowns.json
```

## Scraper

The official TNPDCL outage page requires a circle selection and CAPTCHA. The public user never sees this. The scraper handles it before data reaches the app.

One-time setup:

```powershell
winget install --id UB-Mannheim.TesseractOCR -e
cd scraper
py -m pip install -r requirements.txt
```

Run for Coimbatore circles:

```powershell
cd scraper
py scrape_tangedco.py --circle CBE/NORTH CBE/SOUTH CBE/METRO
```

Run for all circles:

```powershell
py scrape_tangedco.py --all
```

Manual CAPTCHA fallback:

```powershell
py scrape_tangedco.py --manual --circle CBE/SOUTH
```

The scraper writes:

```text
public/shutdowns.json
```

## Matching Notes

The app matches upcoming shutdowns only (`date >= today`). Search index includes:

- `localities`
- `substation`
- `feeder`
- `town`

Very short scraped tokens like `P` or `M` are ignored to avoid false matches such as `Gandhipuram` matching single-letter fragments.

## Disclaimer

This is not an official TANGEDCO/TNPDCL product. Data shown is for planned maintenance shutdowns published by TNPDCL/TANGEDCO. For unscheduled faults, contact TANGEDCO directly.
