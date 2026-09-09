/**
 * Renders the homepage "Available For Sale" carousel from four sources:
 *
 *  - assets/data/listings.json — Brandon Meneses's own active listings from
 *    The Beverly Hills Estates, kept current by scripts/sync-listings.py.
 *  - assets/data/brokerage-listings.json — ALL active listings from The
 *    Beverly Hills Estates' brokerage-wide /properties/ search (other
 *    agents' listings included, per explicit request), kept current by
 *    scripts/sync-brokerage-listings.py. LA-only — the brokerage has no
 *    Miami inventory.
 *  - assets/data/agency-listings.json — ALL active listings from The
 *    Agency's Miami/Ft Lauderdale region (other agents' listings included,
 *    mirroring brokerage-listings.json — Janelle's own go here too whenever
 *    she has any). Maintained BY HAND: theagencyre.com/robots.txt disallows
 *    crawling '*.ashx' (the endpoint that actually returns listing data on
 *    every page of that site) and '/listing/' pages, so there is no
 *    automated scraper for it.
 *  - assets/data/miami-listings.json — Meneses Group's own Miami
 *    new-development projects (Kempinski, Shoma Bay). Pre-construction, not
 *    resale MLS listings, so there is no brokerage search to scrape;
 *    maintained by hand.
 *
 * Selection: every active California listing and every active Florida
 * (Miami) one — no cap, no sampling (a stray out-of-state brokerage
 * listing, e.g. Algarve, Southampton NY, is the only thing dropped). The
 * combined set is sorted by price ascending, which naturally interleaves
 * the two markets card to card as prices happen to land.
 *
 * Every page load re-fetches all four, so an update to any of them shows
 * up here on next load — no rebuild of this HTML file needed.
 */
(function () {
  const LISTINGS_URL = 'assets/data/listings.json';
  const BROKERAGE_URL = 'assets/data/brokerage-listings.json';
  const AGENCY_URL = 'assets/data/agency-listings.json';
  const MIAMI_URL = 'assets/data/miami-listings.json';

  // Addresses to keep out of the carousel regardless of which source they
  // come from — matched loosely (case/whitespace-insensitive) since the
  // same property can be spelled slightly differently across sources.
  const EXCLUDED_ADDRESSES = [
    '3736 mississippi st',
    '10443 corfu ln',
    '10443 corfu lane',
    '1401 bel air rd',
    '1111 bel air rd',
  ];

  function normalizeAddress(address) {
    return (address || '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function isExcluded(item) {
    return EXCLUDED_ADDRESSES.includes(normalizeAddress(item.address));
  }

  function isCalifornia(item) {
    return /california/i.test(item.city || '');
  }

  function isFlorida(item) {
    return /florida/i.test(item.city || '');
  }

  function fmtPrice(item) {
    if (item.price_value) return '$' + item.price_value.toLocaleString();
    if (item.price_text) return item.price_text;
    return 'Contact for Pricing';
  }

  function fmtSpecs(item) {
    const parts = [];
    if (item.beds) parts.push(item.beds + ' Beds');
    if (item.baths) parts.push(item.baths + ' Baths');
    if (item.sqft) parts.push(item.sqft.toLocaleString() + ' Sqft');
    return parts.length ? parts.join(' &middot; ') : '&nbsp;';
  }

  function card(item) {
    const img = item.image_url || 'assets/img/kempinski-miami.jpg';
    const badge = item.agent ? item.agent.split(' ')[0] : item.brokerage;
    const body = `
      <div class="listing-card for-sale-card">
        <div class="photo">
          <img src="${img}" alt="${item.address}" loading="lazy">
          ${badge ? `<span class="status">${badge}</span>` : ''}
        </div>
        <div class="body">
          <div class="price">${fmtPrice(item)}</div>
          <div class="addr">${item.address}</div>
          <div class="city">${(item.city || '').toUpperCase()}</div>
          <div class="specs">${fmtSpecs(item)}</div>
        </div>
      </div>`;
    return item.source_url
      ? `<a href="${item.source_url}" target="_blank" rel="noopener" class="for-sale-card-link">${body}</a>`
      : body;
  }

  async function loadJSON(url) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  async function render() {
    const trackEl = document.getElementById('forSaleTrack');
    const statusEl = document.getElementById('forSaleStatus');
    if (!trackEl) return;

    const [brandonData, brokerageData, agencyData, miamiData] = await Promise.all([
      loadJSON(LISTINGS_URL),
      loadJSON(BROKERAGE_URL),
      loadJSON(AGENCY_URL),
      loadJSON(MIAMI_URL),
    ]);

    if (!brandonData && !brokerageData && !agencyData && !miamiData) {
      if (statusEl) statusEl.textContent = 'Live listings are unavailable right now — please check back shortly.';
      return;
    }

    const brandonActive = (brandonData ? brandonData.listings : []).filter(l => l.status === 'active');
    const agencyActive = (agencyData ? agencyData.listings : []);
    const brokerageActive = (brokerageData ? brokerageData.listings : []);
    const miamiActive = (miamiData ? miamiData.listings : []);

    // Brandon's own tagged copy wins over the generic brokerage-wide entry
    // for the same property (same source_url).
    const bySourceUrl = new Map();
    brokerageActive.forEach(l => bySourceUrl.set(l.source_url, l));
    brandonActive.forEach(l => bySourceUrl.set(l.source_url, l));

    const caPool = Array.from(bySourceUrl.values()).filter(isCalifornia);

    // Janelle's Agency listings are Florida-based, so they join the Miami
    // side, not the CA one.
    const miamiPool = miamiActive.concat(agencyActive.filter(isFlorida));

    const combined = miamiPool.concat(caPool)
      .filter(item => !isExcluded(item))
      .sort((a, b) => (a.price_value || 0) - (b.price_value || 0));

    if (!combined.length) {
      trackEl.innerHTML = '<p style="padding:0 24px; color:var(--grey-dark);">No active listings at the moment — check back soon.</p>';
    } else {
      trackEl.innerHTML = combined.map(card).join('');
    }

    if (statusEl) {
      const d = brokerageData && brokerageData.generated_at ? new Date(brokerageData.generated_at) : new Date();
      statusEl.textContent = `Synced from The Beverly Hills Estates & The Agency · last updated ${d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}`;
    }
  }

  function initCarouselControls() {
    const track = document.getElementById('forSaleTrack');
    const prev = document.getElementById('forSalePrev');
    const next = document.getElementById('forSaleNext');
    if (!track || !prev || !next) return;
    function scrollByCard(dir) {
      const card = track.querySelector('.for-sale-card-link, .listing-card');
      const step = card ? card.getBoundingClientRect().width + 20 : 340;
      track.scrollBy({ left: dir * step, behavior: 'smooth' });
    }
    prev.addEventListener('click', () => scrollByCard(-1));
    next.addEventListener('click', () => scrollByCard(1));
  }

  document.addEventListener('DOMContentLoaded', () => {
    render();
    initCarouselControls();
  });
})();
