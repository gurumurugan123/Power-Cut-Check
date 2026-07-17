"""
TANGEDCO / TNPDCL planned power shutdown scraper.

Uses FREE local Tesseract OCR to read CAPTCHAs automatically (no paid API).

Usage:
    py scrape_tangedco.py --circle CBE/NORTH CBE/SOUTH CBE/METRO
    py scrape_tangedco.py --all
    py scrape_tangedco.py --manual          # type CAPTCHA yourself
    py scrape_tangedco.py --list-circles
"""

import argparse
import json
import os
import re
import sys
import time
import warnings
from datetime import datetime

import requests
from bs4 import BeautifulSoup

try:
    from bs4 import XMLParsedAsHTMLWarning
    warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)
except Exception:
    pass

BASE = "https://www.tnebltd.gov.in/outages/"
PAGE_URL = BASE + "viewshutdown.xhtml"
CAPTCHA_URL = BASE + "captcha.jpg"

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_OUT = os.path.normpath(os.path.join(HERE, "..", "public", "shutdowns.json"))
RAW_DUMP = os.path.join(HERE, "last_response.html")
CAPTCHA_FILE = os.path.join(HERE, "captcha.jpg")

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

MAX_CAPTCHA_RETRIES = 5

TESSERACT_CANDIDATES = [
    os.environ.get("TESSERACT_CMD", ""),
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
]


def configure_tesseract():
    import pytesseract

    for path in TESSERACT_CANDIDATES:
        if path and os.path.isfile(path):
            pytesseract.pytesseract.tesseract_cmd = path
            return path
    return "tesseract"


def new_session():
    s = requests.Session()
    s.headers.update({"User-Agent": USER_AGENT, "Accept": "text/html,*/*"})
    return s


def load_form(session):
    resp = session.get(PAGE_URL, timeout=40)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "lxml")

    form = soup.find("form")
    if form is None:
        raise RuntimeError("Could not find the shutdown form on the page.")

    form_id = form.get("id") or form.get("name")

    view_state = soup.find("input", attrs={"name": "javax.faces.ViewState"})
    view_state = view_state["value"] if view_state else ""

    select = None
    for sel in soup.find_all("select"):
        sid = sel.get("id", "") or sel.get("name", "")
        if "appcat_input" in sid or "appcat" in sid:
            select = sel
            break
    if select is None:
        raise RuntimeError("Could not find the circle dropdown.")
    select_name = select.get("name")

    circles = {}
    for opt in select.find_all("option"):
        label = opt.get_text(strip=True)
        value = opt.get("value", "")
        if value and label:
            circles[label] = value

    cap_input = None
    for inp in form.find_all("input"):
        iid = inp.get("id", "") or inp.get("name", "")
        if iid.endswith(":cap") or iid.endswith("cap"):
            if inp.get("type") == "text":
                cap_input = inp
                break
    cap_name = cap_input.get("name") if cap_input else None

    submit_name = None
    for btn in form.find_all("button"):
        name = btn.get("name", "")
        if "submit3" in name or btn.get_text(strip=True).lower() == "submit":
            submit_name = name
            break

    focus_name = None
    focus = form.find("input", attrs={"id": re.compile(r"appcat_focus$")})
    if focus is not None:
        focus_name = focus.get("name")

    return {
        "form_id": form_id,
        "view_state": view_state,
        "select_name": select_name,
        "focus_name": focus_name,
        "cap_name": cap_name,
        "submit_name": submit_name,
        "circles": circles,
    }


def fetch_captcha(session):
    resp = session.get(CAPTCHA_URL, timeout=40)
    resp.raise_for_status()
    with open(CAPTCHA_FILE, "wb") as fh:
        fh.write(resp.content)
    return CAPTCHA_FILE


def clean_captcha_text(raw):
    if not raw:
        return ""
    text = raw.replace("\n", " ").strip()
    text = re.sub(r"[^A-Za-z0-9]", "", text)
    if len(text) > 6:
        text = text[:6]
    return text


def tesseract_ocr(path):
    """Free local OCR via Tesseract. Tries multiple preprocess + psm modes."""
    import pytesseract
    from PIL import Image, ImageFilter, ImageOps

    configure_tesseract()

    img = Image.open(path)
    variants = []

    gray = ImageOps.autocontrast(img.convert("L"))
    variants.append(img.convert("L"))
    variants.append(gray)
    variants.append(gray.point(lambda p: 0 if p < 140 else 255))
    variants.append(gray.point(lambda p: 0 if p < 160 else 255))
    variants.append(ImageOps.invert(gray.point(lambda p: 0 if p < 140 else 255)))
    sharp = gray.filter(ImageFilter.SHARPEN)
    variants.append(sharp.point(lambda p: 0 if p < 150 else 255))
    big = gray.resize((gray.width * 3, gray.height * 3), Image.Resampling.LANCZOS)
    variants.append(big.point(lambda p: 0 if p < 145 else 255))

    configs = [
        "--psm 7 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
        "--psm 8 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
        "--psm 13 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
    ]

    guesses = []
    for variant in variants:
        for cfg in configs:
            try:
                raw = pytesseract.image_to_string(variant, config=cfg)
                cleaned = clean_captcha_text(raw)
                if cleaned:
                    guesses.append(cleaned)
            except Exception:
                continue

    if not guesses:
        return None

    scored = {}
    for g in guesses:
        if len(g) < 3:
            continue
        weight = 2 if 4 <= len(g) <= 6 else 1
        scored[g] = scored.get(g, 0) + weight

    if not scored:
        return clean_captcha_text(guesses[0]) or None

    return sorted(scored.items(), key=lambda kv: (-kv[1], -len(kv[0])))[0][0]


def solve_captcha(session, manual=False):
    path = fetch_captcha(session)
    print(f"  CAPTCHA saved: {path}")

    if not manual:
        try:
            guess = tesseract_ocr(path)
            if guess:
                print(f"  Tesseract OCR -> {guess}")
                return guess
            print("  Tesseract returned empty text.")
        except Exception as exc:
            print(f"  Tesseract OCR failed: {exc}")
            print("  Install Tesseract or re-run with --manual")
        return ""

    try:
        os.startfile(path)
    except Exception:
        pass
    return input("  Enter CAPTCHA text: ").strip()


def captcha_rejected(html):
    lower = html.lower()
    return "captcha" in lower and (
        "invalid" in lower or "incorrect" in lower or "does not match" in lower
    )


def submit_circle(session, form, circle_code, captcha_text):
    fields = {
        form["form_id"]: form["form_id"],
        form["select_name"]: circle_code,
        form["cap_name"]: captcha_text,
        "javax.faces.ViewState": form["view_state"],
    }
    if form["focus_name"]:
        fields[form["focus_name"]] = ""
    if form["submit_name"]:
        fields[form["submit_name"]] = "Submit"

    multipart = {k: (None, v) for k, v in fields.items()}
    resp = session.post(PAGE_URL, files=multipart, timeout=60)
    resp.raise_for_status()
    return resp.text


HEADER_RULES = [
    ("fromTime", ["from date", "from time", "start time", "from"]),
    ("toTime", ["to date", "to time", "end time", "upto", "up to"]),
    ("date", ["date of outage", "shutdown date", "outage date", "date of"]),
    ("reason", ["type of work", "type of", "reason", "purpose", "nature of work", "nature"]),
    ("localities", ["location", "areas affected", "area affected", "locality", "localities", "village"]),
    ("substation", ["substation", "sub station", "sub-station"]),
    ("feeder", ["feeder"]),
    ("town", ["town", "region"]),
    ("circle", ["circle"]),
]


def classify_header(text):
    t = re.sub(r"\s+", " ", (text or "").strip().lower())
    for field, keys in HEADER_RULES:
        for k in keys:
            if k in t:
                return field
    return None


def parse_date(value):
    value = (value or "").strip()
    if re.fullmatch(r"\d{1,2}[:.]\d{2}(\s*[AaPp][Mm])?", value):
        return ""
    for fmt in ("%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d", "%d-%b-%Y", "%d.%m.%Y"):
        try:
            return datetime.strptime(value, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return value


def parse_time(value):
    value = (value or "").strip()
    for fmt in ("%H:%M", "%H.%M", "%I:%M %p", "%I.%M %p", "%I:%M%p", "%H:%M:%S"):
        try:
            return datetime.strptime(value.upper(), fmt).strftime("%H:%M")
        except ValueError:
            continue
    return value


def split_localities(value):
    if not value:
        return []
    parts = re.split(r"[,;/\n]+", value)
    cleaned = []
    for p in parts:
        name = p.strip()
        # Drop truncated scraps like "P" / "M" from cut-off Location cells
        if len(name) < 3:
            continue
        if re.fullmatch(r"[A-Za-z]", name):
            continue
        cleaned.append(name)
    return cleaned


TNPDCL_COLUMNS = [
    "date",
    "town",
    "substation",
    "feeder",
    "localities",
    "reason",
    "fromTime",
    "toTime",
]


def _looks_like_header_row(cells):
    joined = " ".join(c.get_text(" ", strip=True).lower() for c in cells)
    return "date of outage" in joined or ("substation" in joined and "feeder" in joined)


def parse_tables(html, fallback_circle):
    soup = BeautifulSoup(html, "lxml")
    records = []

    for table in soup.find_all("table"):
        header_cells = []
        thead = table.find("thead")
        if thead:
            header_row = thead.find("tr")
            if header_row:
                header_cells = header_row.find_all(["th", "td"])
        else:
            first = table.find("tr")
            if first:
                header_cells = first.find_all(["th", "td"])

        if not header_cells:
            continue

        col_fields = [classify_header(c.get_text(" ", strip=True)) for c in header_cells]
        mapped = sum(1 for f in col_fields if f)

        if mapped < 4 and len(header_cells) >= 8:
            col_fields = list(TNPDCL_COLUMNS)
            if len(header_cells) > 8:
                col_fields.extend([None] * (len(header_cells) - 8))
        elif not any(f in ("substation", "feeder", "localities", "date") for f in col_fields):
            continue

        body = table.find("tbody") or table
        for tr in body.find_all("tr"):
            cells = tr.find_all(["td", "th"])
            if not cells or len(cells) < 4:
                continue
            if _looks_like_header_row(cells):
                continue

            rec = {}
            for idx, cell in enumerate(cells):
                if idx >= len(col_fields):
                    break
                field = col_fields[idx]
                if not field:
                    continue
                rec[field] = cell.get_text(" ", strip=True)

            if not rec:
                continue

            record = {
                "circle": rec.get("circle") or fallback_circle,
                "town": rec.get("town", ""),
                "substation": rec.get("substation", ""),
                "feeder": rec.get("feeder", ""),
                "localities": split_localities(rec.get("localities", "")),
                "date": parse_date(rec.get("date", "")),
                "fromTime": parse_time(rec.get("fromTime", "")),
                "toTime": parse_time(rec.get("toTime", "")),
                "reason": rec.get("reason", ""),
            }
            if record["substation"] or record["feeder"] or record["localities"]:
                records.append(record)

    return records


def scrape_one_circle(session, label, code, manual, save_raw):
    for attempt in range(1, MAX_CAPTCHA_RETRIES + 1):
        print(f"  Attempt {attempt}/{MAX_CAPTCHA_RETRIES}")
        form = load_form(session)
        captcha = solve_captcha(session, manual=manual)
        if not captcha:
            print("  Empty CAPTCHA - retrying with a new image.")
            time.sleep(1)
            continue

        html = submit_circle(session, form, code, captcha)
        if save_raw:
            with open(RAW_DUMP, "w", encoding="utf-8") as fh:
                fh.write(html)
            print(f"  Raw HTML saved to {RAW_DUMP}")

        if captcha_rejected(html):
            print("  CAPTCHA rejected by site - retrying.")
            time.sleep(1)
            continue

        records = parse_tables(html, label)
        soup = BeautifulSoup(html, "lxml")
        has_table = any(
            "date of outage" in (t.get_text(" ", strip=True).lower())
            for t in soup.find_all("table")
        )
        if len(records) == 0 and not has_table and soup.find("input", attrs={"id": re.compile(r"cap$")}):
            print("  Still on form (likely bad CAPTCHA) - retrying.")
            time.sleep(1)
            continue

        print(f"  Parsed {len(records)} shutdown row(s).")
        return records

    print("  Gave up on this circle after CAPTCHA retries.")
    return []


def resolve_circles(requested, available):
    label_by_code = {v: k for k, v in available.items()}
    resolved = []
    for item in requested:
        if item in available:
            resolved.append((item, available[item]))
        elif item in label_by_code:
            resolved.append((label_by_code[item], item))
        else:
            print(f"  ! Unknown circle '{item}' - skipping.")
    return resolved


def main():
    ap = argparse.ArgumentParser(description="Scrape TANGEDCO planned shutdowns (free Tesseract OCR).")
    ap.add_argument("--circle", nargs="+", default=["CBE/NORTH", "CBE/SOUTH", "CBE/METRO"],
                    help="Circle labels (CBE/NORTH) or codes (0430). Default: Coimbatore circles.")
    ap.add_argument("--all", action="store_true", help="Scrape every circle.")
    ap.add_argument("--out", default=DEFAULT_OUT, help="Output JSON path.")
    ap.add_argument("--manual", action="store_true",
                    help="Type CAPTCHA manually instead of Tesseract OCR.")
    ap.add_argument("--list-circles", action="store_true", help="Print available circles and exit.")
    ap.add_argument("--save-raw", action="store_true", help="Save each raw HTML response for debugging.")
    args = ap.parse_args()

    if not args.manual:
        try:
            path = configure_tesseract()
            print(f"CAPTCHA mode: free Tesseract OCR ({path})")
        except Exception as exc:
            print(f"Tesseract not ready: {exc}")
            print("Install from https://github.com/UB-Mannheim/tesseract/wiki or use --manual")
            sys.exit(1)
    else:
        print("CAPTCHA mode: manual terminal input")

    session = new_session()
    print("Loading form + session...")
    form = load_form(session)

    if args.list_circles:
        for label, code in sorted(form["circles"].items()):
            print(f"  {code}  {label}")
        return

    targets = list(form["circles"].items()) if args.all else resolve_circles(args.circle, form["circles"])
    targets = [(label, code) for label, code in targets if code != "A" and "select" not in label.lower()]

    if not targets:
        print("No valid circles to scrape.")
        sys.exit(1)

    all_records = []
    for label, code in targets:
        print(f"\n=== {label} ({code}) ===")
        records = scrape_one_circle(
            session, label, code,
            manual=args.manual,
            save_raw=args.save_raw,
        )
        all_records.extend(records)
        time.sleep(0.8)

    if not all_records:
        print("\nNo records scraped - keeping existing output file untouched.")
        print("Tip: run with --save-raw and open scraper/last_response.html to inspect the response.")
        sys.exit(2)

    for i, rec in enumerate(all_records, start=1):
        rec_with_id = {"id": i}
        rec_with_id.update(rec)
        all_records[i - 1] = rec_with_id

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(all_records, fh, indent=2, ensure_ascii=False)

    print(f"\nWrote {len(all_records)} record(s) to {args.out}")


if __name__ == "__main__":
    main()
