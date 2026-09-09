#!/usr/bin/env python3
"""
Sync ALL active listings from The Beverly Hills Estates' brokerage-wide
/properties/ search — not just Brandon Meneses's own, per explicit user
request (the homepage "Available For Sale" carousel is meant to showcase
brokerage inventory broadly, distinct from listings.json which stays scoped
to Brandon's own agent page for the Listings page's sale history).

Output: site/assets/data/brokerage-listings.json — fetched at runtime by
js/for-sale-render.js, same "publish JSON, no rebuild needed" pattern as
scripts/sync-listings.py.

Politeness: robots.txt at thebeverlyhillsestates.com sets Crawl-delay: 5 and
does not disallow /properties/. MAX_PAGES caps this run to a handful of
requests with a 5+ second delay between each.
"""
import json
import re
import sys
import time
from datetime import datetime, timezone
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

from bs4 import BeautifulSoup

BASE = "https://thebeverlyhillsestates.com/properties/"
UA = "Mozilla/5.0 (compatible; MenesesGroupListingsSync/1.0; +https://menesesgroup.com)"
CRAWL_DELAY_SEC = 5
MAX_PAGES = 3  # ~90 listings max — plenty for a homepage carousel


def fetch(url):
    req = Request(url, headers={"User-Agent": UA})
    with urlopen(req, timeout=20) as resp:
        return resp.read().decode("utf-8", errors="replace")


def parse_page(html):
    soup = BeautifulSoup(html, "html.parser")
    out = []
    for el in soup.select(".ip-cl-item"):
        item = parse_item(el)
        if item:
            out.append(item)
    return out


def parse_item(el):
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
    price_value = None
    if price_text:
        m = re.search(r"\$([\d,]+)", price_text)
        if m:
            price_value = int(m.group(1).replace(",", ""))

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

    return {
        "status": "active",
        "address": address,
        "city": city,
        "price_text": price_text,
        "price_value": price_value,
        "represented": None,
        "beds": beds,
        "baths": baths,
        "sqft": sqft,
        "source_url": url,
        "image_url": image,
        "agent": None,
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
            break
        seen_urls_per_page.append(item_urls)
        all_items.extend(items)

        page += 1
        if page <= MAX_PAGES:
            time.sleep(CRAWL_DELAY_SEC)

    dedup = {}
    for it in all_items:
        key = it["source_url"] or (it["address"], it["price_text"])
        dedup[key] = it
    return list(dedup.values())


def main():
    items = scrape_all()
    if not items:
        print("sync-brokerage-listings: got 0 items — refusing to overwrite existing data", file=sys.stderr)
        sys.exit(1)

    data = {
        "source": BASE,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "counts": {"active": len(items)},
        "listings": items,
    }

    out_path = sys.argv[1] if len(sys.argv) > 1 else "site/assets/data/brokerage-listings.json"
    with open(out_path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"sync-brokerage-listings: wrote {len(items)} listings to {out_path}")


if __name__ == "__main__":
    main()
