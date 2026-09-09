#!/usr/bin/env python3
"""
Sync Meneses Group's listings data from Brandon Meneses's own agent page on
The Beverly Hills Estates' site.

Scope, deliberately: brandon-meneses's individual agent page, NOT the
brokerage-wide /properties/ search (which lists hundreds of other agents'
listings). Pulling from the wide page would misrepresent other agents'
clients' listings as Meneses Group's own.

Output: site/assets/data/listings.json — the site's listings.html /
index.html fetch this at runtime and render from it, so publishing an
updated JSON is enough to update the live site; no rebuild of the HTML is
required.

Politeness: robots.txt at thebeverlyhillsestates.com sets Crawl-delay: 5 and
does not disallow /agents/. This script fetches only the small, fixed set of
paginated agent-bio pages (typically 2-4 requests total per run) with a
5+ second delay between requests, and is meant to run on a schedule of
hours (see .github/workflows/sync-listings.yml), not continuously.
"""
import json
import re
import sys
import time
from datetime import datetime, timezone
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

from bs4 import BeautifulSoup

BASE = "https://thebeverlyhillsestates.com/agents/brandon-meneses/"
UA = "Mozilla/5.0 (compatible; MenesesGroupListingsSync/1.0; +https://menesesgroup.com)"
CRAWL_DELAY_SEC = 5
MAX_PAGES = 8  # hard safety cap; the bio page has had 3 pages historically

STATUS_SECTIONS = {
    "Active Listings": "active",
    "Sold Listings": "sold",
    "Leased Listings": "leased",
}


def fetch(url):
    req = Request(url, headers={"User-Agent": UA})
    with urlopen(req, timeout=20) as resp:
        return resp.read().decode("utf-8", errors="replace")


def parse_page(html):
    """Returns list of {section, address, city, price_text, represented, url, image, beds, baths, sqft}."""
    soup = BeautifulSoup(html, "html.parser")
    out = []

    # Walk the document in order, tracking which "<h2>...Listings</h2>" section
    # each .ip-cl-item falls under (the site doesn't nest items inside a
    # per-section wrapper, so section membership is positional).
    current_section = None
    for el in soup.find_all(["h2", "div"]):
        if el.name == "h2":
            text = el.get_text(strip=True)
            if text in STATUS_SECTIONS:
                current_section = STATUS_SECTIONS[text]
            continue
        if el.name == "div" and "ip-cl-item" in (el.get("class") or []):
            if current_section is None:
                continue  # skip anything before the first recognized section heading
            item = parse_item(el, current_section)
            if item:
                out.append(item)
    return out


def parse_item(el, section):
    link = el.find("a", href=True)
    url = link["href"] if link else None

    h2 = el.select_one(".ip-cl-details h2")
    address = h2.get_text(strip=True) if h2 else None
    if not address:
        return None

    city_span = el.select_one(".ip-cl-details span")
    city = city_span.get_text(strip=True) if city_span else None

    price_span = el.select_one(".ip-cl-price span")
    price_text = price_span.get_text(strip=True) if price_span else None

    rep_span = el.select_one(".ip-cl-represent span")
    represented = rep_span.get_text(strip=True) if rep_span else None
    represented = represented or None  # normalize empty string to None

    img = el.select_one(".ip-cl-img-holder img")
    image = img.get("data-src") or img.get("src") if img else None
    if image and image.startswith("data:"):
        image = None

    specs = [s.get_text(strip=True) for s in el.select(".ip-cl-info span")]
    beds = baths = sqft = None
    for s in specs:
        m = re.match(r"([\d,]+)\s*Beds?", s, re.I)
        if m:
            beds = int(m.group(1).replace(",", ""))
        m = re.match(r"([\d,]+)\s*Baths?", s, re.I)
        if m:
            baths = int(m.group(1).replace(",", ""))
        m = re.match(r"([\d,]+)\s*SQFT", s, re.I)
        if m:
            sqft = int(m.group(1).replace(",", ""))

    # Normalize price: source uses "SOLD $X", "LEASED $X", or plain "$X" (active).
    status = section
    price_value = None
    if price_text:
        m = re.search(r"\$([\d,]+)", price_text)
        if m:
            price_value = int(m.group(1).replace(",", ""))
        if re.match(r"^SOLD\b", price_text, re.I):
            status = "sold"
        elif re.match(r"^LEASED\b", price_text, re.I):
            status = "leased"

    return {
        "status": status,
        "address": address,
        "city": city,
        "price_text": price_text,
        "price_value": price_value,
        "represented": represented,
        "beds": beds,
        "baths": baths,
        "sqft": sqft,
        "source_url": url,
        "image_url": image,
        "agent": "Brandon Meneses",
        "brokerage": "The Beverly Hills Estates",
    }


def scrape_all():
    all_items = []
    seen_urls_per_page = []
    page = 1
    while page <= MAX_PAGES:
        url = BASE if page == 1 else f"{BASE}page/{page}/"
        try:
            html = fetch(url)
        except HTTPError as e:
            if e.code == 404:
                break
            raise
        except URLError:
            break

        items = parse_page(html)
        item_urls = tuple(sorted(i["source_url"] for i in items if i["source_url"]))
        if not items or item_urls in seen_urls_per_page:
            # empty page, or WP looped back to page 1 content (common when you
            # walk past the last real page) — stop.
            break
        seen_urls_per_page.append(item_urls)
        all_items.extend(items)

        page += 1
        if page <= MAX_PAGES:
            time.sleep(CRAWL_DELAY_SEC)

    # De-dupe by (address, price_text, source_url) — the bio page can repeat
    # an item (e.g. a lease renewed) with distinct rows; keep them distinct
    # only when price/represented actually differ.
    dedup = {}
    for it in all_items:
        key = (it["address"], it["price_text"], it["source_url"])
        dedup[key] = it
    return list(dedup.values())


def main():
    items = scrape_all()
    if not items:
        print("sync-listings: got 0 items — refusing to overwrite existing data", file=sys.stderr)
        sys.exit(1)

    data = {
        "source": BASE,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "counts": {
            s: sum(1 for i in items if i["status"] == s)
            for s in ("active", "sold", "leased")
        },
        "listings": items,
    }

    out_path = sys.argv[1] if len(sys.argv) > 1 else "site/assets/data/listings.json"
    with open(out_path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"sync-listings: wrote {len(items)} listings to {out_path}")
    print(f"  active={data['counts']['active']} sold={data['counts']['sold']} leased={data['counts']['leased']}")


if __name__ == "__main__":
    main()
