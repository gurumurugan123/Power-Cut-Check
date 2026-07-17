# TANGEDCO shutdown scraper (FREE Tesseract OCR)

Pulls planned power-shutdown data from TNPDCL and writes `public/shutdowns.json`.

CAPTCHAs are solved with **local Tesseract OCR** — no paid API, no Google billing.

## One-time setup

1. Install Tesseract OCR (Windows):

```powershell
winget install --id UB-Mannheim.TesseractOCR -e
```

Or download: https://github.com/UB-Mannheim/tesseract/wiki

2. Install Python packages:

```powershell
cd scraper
py -m pip install -r requirements.txt
```

## Run (automatic CAPTCHA)

```powershell
cd scraper

# Coimbatore circles (default)
py scrape_tangedco.py

# Specific circles
py scrape_tangedco.py --circle CBE/NORTH CBE/SOUTH CBE/METRO

# Every circle in Tamil Nadu
py scrape_tangedco.py --all
```

You should see:

```text
Tesseract OCR → xxxxx
Parsed N shutdown row(s).
```

If OCR is wrong, the script retries (up to 5 times per circle) with a new CAPTCHA.

## Manual fallback

```powershell
py scrape_tangedco.py --manual --circle CBE/SOUTH
```

## Notes

- Free OCR is not 100% accurate on noisy CAPTCHAs — retries help.
- Empty scrapes do **not** overwrite `public/shutdowns.json`.
- Successful runs also write `public/shutdowns.meta.json` with `lastFetchedAt`.
- Works on Windows and Linux (GitHub Actions). Set `TESSERACT_CMD` if needed.
- No API key required.
- Daily automation: see `.github/workflows/scrape.yml` (06:00 IST).
