/**
 * Renders the Listings page from assets/data/listings.json, which
 * scripts/sync-listings.py regenerates on a schedule (see
 * .github/workflows/sync-listings.yml) from Brandon Meneses's own agent
 * page at thebeverlyhillsestates.com — not the brokerage-wide /properties/
 * page, so this only ever shows Meneses Group's own listings.
 *
 * Every page load re-fetches the JSON, so an addition or removal on the
 * source page shows up here on the sync's next run + this page's next
 * load — no rebuild of this HTML file needed.
 */
(function () {
  const DATA_URL = 'assets/data/listings.json';

  function fmtPrice(item) {
    if (item.status === 'active' && item.price_value) return '$' + item.price_value.toLocaleString();
    if (item.status === 'sold' && item.price_value) return '$' + item.price_value.toLocaleString();
    if (item.price_text) return item.price_text.replace(/^SOLD\s*/i, '').replace(/^LEASED\s*/i, '');
    return 'Contact for Pricing';
  }

  function fmtSpecs(item) {
    const parts = [];
    if (item.beds) parts.push(item.beds + ' Beds');
    if (item.baths) parts.push(item.baths + ' Baths');
    if (item.sqft) parts.push(item.sqft.toLocaleString() + ' Sqft');
    if (parts.length) return parts.join(' &middot; ');
    return (item.represented || '').replace(/^REPRESENTED:\s*/i, 'Represented: ') || '&nbsp;';
  }

  function activeCard(item) {
    const img = item.image_url || 'assets/img/kempinski-miami.jpg'; // neutral fallback, never a mismatched real photo
    return `
      <div class="listing-card">
        <div class="photo">
          <img src="${img}" alt="${item.address}" loading="lazy">
        </div>
        <div class="body">
          <div class="price">${fmtPrice(item)}</div>
          <div class="addr">${item.address}</div>
          <div class="city">${(item.city || '').toUpperCase()}</div>
          <div class="specs">${fmtSpecs(item)}</div>
        </div>
      </div>`;
  }

  function saleRow(item) {
    const rep = (item.represented || '').replace(/^REPRESENTED:\s*/i, 'Represented: ');
    return `
      <div class="sale-row">
        <div><div class="addr">${item.address}</div><div class="city">${(item.city || '').toUpperCase()}</div></div>
        <div class="rep">${rep}</div>
        <div class="deal"><div class="price">${fmtPrice(item)}</div></div>
      </div>`;
  }

  async function render() {
    // "Active Listings" is curated by hand directly in listings.html right
    // now (specific properties + specific asking prices the user set, some
    // of which — Kempinski, Shoma Bay — aren't MLS listings the sync can see
    // at all), so this script no longer touches it. Only Sold stays synced.
    const soldFeaturedEl = document.getElementById('syncedSoldFeatured');
    const soldListEl = document.getElementById('syncedSoldList');
    const statusEl = document.getElementById('syncStatus');
    if (!soldFeaturedEl && !soldListEl) return;

    let data;
    try {
      const res = await fetch(DATA_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      data = await res.json();
    } catch (e) {
      if (statusEl) statusEl.textContent = 'Live sync unavailable right now — showing the site’s last saved listings.';
      return; // leave any statically-authored fallback content in place
    }

    const sold = data.listings.filter(l => l.status === 'sold')
      .sort((a, b) => (b.price_value || 0) - (a.price_value || 0));

    if (sold.length) {
      soldFeaturedEl.innerHTML = sold.slice(0, 3).map(activeCard.bind(null)).map((html, i) => html).join('');
      // featured cards get a "Sold" ribbon
      soldFeaturedEl.querySelectorAll('.photo').forEach(p => p.insertAdjacentHTML('afterbegin', '<span class="status">Sold</span>'));
      soldListEl.innerHTML = sold.slice(3).map(saleRow).join('');
    }

    if (statusEl) {
      const d = new Date(data.generated_at);
      statusEl.textContent = `Recent sales synced from thebeverlyhillsestates.com — last updated ${d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}`;
    }
  }

  document.addEventListener('DOMContentLoaded', render);
})();
