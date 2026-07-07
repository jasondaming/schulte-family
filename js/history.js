const HISTORY_POSTER_IMAGE = 'Caporee%20History.jpg';

const CAMPOREE_HISTORY = [
  {
    year: '1995',
    location: 'Lincoln State Park',
    album: 'https://photos.app.goo.gl/3DDPC7PNuhH6YiR96',
    image: 'https://lh3.googleusercontent.com/pw/AP1GczMrpwimaWh67JENePKEN8pXesXkp5mfFevUDf6xPP9CiCqBi-b19dzb-smB3WODp8I3ydb3_ZvUBTnApnfuYMpXsxHB2BPnPfqUTmAD9c5eiVy2aJ3ZiSe4iAcj2CAqcsBwufmcEUsxU56dRpNNPF85Zw=w1428-h1067-s-no?authuser=0',
    note: 'First listed Schulte Camporee album.',
  },
  {
    year: '1999',
    location: 'Patoka Lake',
    album: 'https://photos.app.goo.gl/JfX71znCw9gF4Qh97',
    image: 'https://lh3.googleusercontent.com/pw/AP1GczNm4kE7u84SEQwrhYaKbbM7698lAy9-7OTZb6Fm2JqcDXfaS5wmrCKTxYLipPQic08jSTFX35dndzZK3N2-YCHawoFF6HSi53RqWkQfzjhl8pmK7Z6IIEeC32ajjJOGawCNKRvAiN5RMrPZVxNLhMSDxQ=w1557-h1067-s-no?authuser=0',
  },
  {
    year: '2002',
    location: 'Wilstem Ranch',
    album: 'https://photos.app.goo.gl/RyEASBUvdZ4HTcLu9',
    image: 'https://lh3.googleusercontent.com/pw/AP1GczPlNivOcs4_KXQah0aXp4dH8HbuFD04iprOhNRbcD_hER59_drqUldkf71SkoYeGtnGHJ-Li0qiANAO_FuvYtFmCtb9z2PsVc2JnXMjnDRmiApnPyzPTCxzhKlfdBanZsA_hG_N5s2MloFr94kR-IjD3Q=w1423-h1067-s-no?authuser=0',
  },
  {
    year: '2005',
    location: 'Wilstem Ranch',
    album: 'https://photos.app.goo.gl/Rp5bza2XwqMuzhrZ9',
    image: 'https://lh3.googleusercontent.com/pw/AP1GczOT8691U3YoU4EE5K3s1HY_2NJmJUX5fNihcZ_0T2YVmlotSgdlysCzYp2fRCO2Wlddih6a35JO374jZ08huUPlMifhljBirQkzjYc1b3aXnprKueKR6_MUg16MfgehE74mBfqAyy2dY1MERDN9Zwm8tg=w1423-h1067-s-no?authuser=0',
  },
  {
    year: '2008',
    location: 'Wilstem Ranch',
    album: 'https://photos.app.goo.gl/aBShADfbfAAhZLQj8',
    image: 'https://lh3.googleusercontent.com/pw/AP1GczP5HzBKV1P7xlHhDH4cCKmDZNnBnDsULtdWCBuo1B7ePPW_fEaIf5NvpRcHlAXYTxYmYULW2eUJPL9WbUAuthruUQN8hHYlSWRZkUIt6TX-swMV60k1qmJSJoksdZP55-kNBKoy-l-IPgDn8X2yh3PN2w=w1600-h1067-s-no?authuser=0',
  },
  {
    year: '2011',
    location: 'Rough River',
    album: 'https://photos.app.goo.gl/kzK319maumxGoEEw9',
    image: 'https://lh3.googleusercontent.com/pw/AP1GczNzJldLuocADqyQF6pOHNVrWBIlYmigg8piytev7vqNeCZQ4L-fxIM1rnslBQGb2WlidOqnhwoV-Y6ap3hGbZ26YI0pyd71fubHZpRoVuBTHJRrv05kQ6DyoMZQlX2d6tNqlYBM0qJg61JqYYVuvZNs_Q=w1600-h1067-s-no?authuser=0',
  },
  {
    year: '2014',
    location: 'Patoka Four Seasons',
    album: 'https://photos.app.goo.gl/UWH4dpTZXSXjLNMXA',
    image: 'https://lh3.googleusercontent.com/pw/AP1GczPGeDTrIIMzwWAdaj-PALoTtSeWN3pfZf40w88jISlKqzhHLijzMdGRpBB4eQgzJb3nq4eH45yZ8JKE5T2Z-YJRXXZ4xX5quK-p7U5diDh1_pOjUP_HT97DiOk6JucHID6NexBI9tAMVTFL5PIohUJ4sg=w1920-h908-s-no?authuser=0',
  },
  {
    year: '2017',
    location: "Santa's Cottages",
    album: 'https://photos.app.goo.gl/Sboj2ZLiXjoDPt5P8',
    image: 'https://lh3.googleusercontent.com/pw/AP1GczO3yNxevW6Hu_6Z3XqngkKlrvLCEVFTYmMJpmbGY0rnxfU2-2Zp38-yiPSshpvEBXeXXj3J2hhFy41_rQwfpiL3lRdehZlqErwo-Zzt-T0QTJ0me9K4Ewrtt5Br3XzBBZZGsaXKPOYYdqqTyunTZgCjOg=w1920-h929-s-no?authuser=0',
  },
  {
    year: '2021',
    location: "Santa's Cottages",
    album: 'https://photos.app.goo.gl/PP4JkzWPyPUJUdzS9',
    image: 'https://lh3.googleusercontent.com/pw/AP1GczMngDNqVD90jJ532vY1SxdXiLQdF8rJUTd1RhChjPcSnEShwMDdsc7UFxBWwWzgS0fx8wntIMTp1NokdLCoEA7sY-LpVtqBh6M2auC9t8zaXKE0LFJWw_p43JyO4cwwGw8mRZHo8Ar5aYjazSqjLwA2=w1024-h683-s-no?authuser=0',
    note: 'Shared album currently has only a few photos beyond the group pictures.',
  },
  {
    year: '2023',
    location: "Santa's Cottages",
    album: 'https://photos.app.goo.gl/AQ7RcEDnGqYjoTeD8',
    image: 'https://lh3.googleusercontent.com/pw/AP1GczMIMkNTkzNLDjkiOesqVQfyG-JgQaM8bsiiap-0n4UXPMQOZEhfyswVUrKjEEJYDA4hK-kCZJsz7bnJY-X8MjZw6omjMNU7L9Q5ZOlV6mE6m7rQLXTJcbNAKkAmix2YfGdtnXv_nMHBEK6oP0iEd1MVPA=w1920-h933-s-no?authuser=0',
    note: 'Shared album currently has only a few photos beyond the group pictures.',
  },
  {
    year: '2026',
    location: "Santa's Cottages",
    album: 'https://photos.app.goo.gl/weTwT12vNXbTxPAm7',
    image: 'https://lh3.googleusercontent.com/pw/AP1GczPm--EOhFjcfDro4CevC8CTG2nUGiNCUhUJ4SXjkbnKsYEIoBoEF2-YwFC3_I28rk8tE23a9_8maH2_F7Gx3t-AWIQf9KUCthxhLZbv-l869l1rCkZzEYPnX640hDayJkJ5BOqx0cccWXh4FayNZ1mLGg=w1895-h1067-s-no?authuser=0',
    imageHref: 'https://photos.google.com/share/AF1QipPwJzYm2UW6s1uFt_6hLO5ljeK2-jCWJ0l7DrRqJ3KR-Iygyjtay2DJoNgY1Cw9cg/photo/AF1QipPmqLWJwkpNVoW1QD0vkdqaX31Jb0qXpsDpt0qZ?key=Q3FQR0xLNGIzV2FGZURxNlVvVVdxTUtJQTRsX0hn',
    links: [
      { label: 'Open GroupMe photo album', href: 'https://photos.app.goo.gl/vagV8rqdRtCwWt9H6' },
    ],
  },
];

export function initHistory() {
  renderHistory();
}

function renderHistory() {
  const container = document.getElementById('history-view');
  if (!container) return;

  container.innerHTML = `
    <div class="history-page">
      <section class="history-hero">
        <div>
          <p class="history-kicker">Schulte Family Camporee</p>
          <h2>Camporee History</h2>
          <p class="history-lede">A running record of Camporee locations and shared photo albums from 1995 through 2026.</p>
        </div>
        <div class="history-stats" aria-label="Camporee summary">
          <div><strong>${CAMPOREE_HISTORY.length}</strong><span>Camporees listed</span></div>
          <div><strong>${CAMPOREE_HISTORY.filter(item => item.album).length}</strong><span>Photo albums</span></div>
          <div><strong>${new Set(CAMPOREE_HISTORY.map(item => item.location)).size}</strong><span>Locations</span></div>
        </div>
      </section>

      <section class="history-poster-section" aria-label="Camporee history poster">
        <a href="${HISTORY_POSTER_IMAGE}" target="_blank" rel="noopener">
          <img src="${HISTORY_POSTER_IMAGE}" alt="Schulte Family Camporee history poster" loading="lazy">
        </a>
      </section>

      <section class="history-section history-callout">
        <strong>Photo help wanted.</strong>
        <span>These shared albums are a starting point. If your branch has a more complete album or another repository, send the link so it can be added here.</span>
      </section>

      <section class="history-layout">
        <div class="history-timeline" aria-label="Camporee timeline">
          ${CAMPOREE_HISTORY.map(renderTimelineItem).join('')}
        </div>
      </section>
    </div>`;

  container.querySelectorAll('.history-photo img').forEach(img => {
    img.addEventListener('error', () => {
      const wrap = img.closest('.history-photo');
      if (wrap) wrap.classList.add('history-photo-missing');
      img.remove();
    });
  });
}

function renderTimelineItem(item) {
  return `
    <article class="history-item">
      <div class="history-year">${esc(item.year)}</div>
      ${renderPhoto(item)}
      <div class="history-item-body">
        <h3>${esc(item.location)}</h3>
        ${item.note ? `<p>${esc(item.note)}</p>` : ''}
        <div class="history-item-actions">
          ${renderHistoryLinks(item)}
        </div>
      </div>
    </article>`;
}

function renderHistoryLinks(item) {
  const links = [];
  if (item.album) links.push({ label: 'Open photo album', href: item.album });
  if (item.links) links.push(...item.links);

  if (!links.length) return '<span class="history-no-album">Photo album pending</span>';

  return links.map(link => `<a href="${esc(link.href)}" target="_blank" rel="noopener">${esc(link.label)}</a>`).join('');
}
function renderPhoto(item) {
  if (!item.image) {
    if (item.album) {
      return `<a class="history-photo history-photo-pending" href="${esc(item.album)}" target="_blank" rel="noopener"><span>Open album</span></a>`;
    }
    return '<div class="history-photo history-photo-pending"><span>Photo pending</span></div>';
  }

  const label = `${item.year} Schulte Camporee at ${item.location}`;
  return `
    <a class="history-photo" href="${esc(item.imageHref || item.album || item.image)}" target="_blank" rel="noopener" aria-label="Open ${esc(label)} photo album">
      <img src="${esc(item.image)}" alt="${esc(label)}" loading="lazy">
      <span>Open photo</span>
    </a>`;
}

function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}