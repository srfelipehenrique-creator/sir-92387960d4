/* ══════════════════════════════════════════════════════════════
   Indicador sutil de cidade e clima atual (v101)
   - Solicita autorização de localização ao navegador (Geolocation API).
   - Consulta Open-Meteo (sem chave de API) + BigDataCloud reverse geocode
     (cidade/UF em português) com cache local de 20 min.
   - Renderiza pílula discreta no topo do banner principal (#nf-hero).
   ══════════════════════════════════════════════════════════════ */
'use strict';

(function (root) {
  const LS_CACHE = 'sir_clima_cache_v1';
  const LS_ASKED = 'sir_clima_asked_v1';
  const CACHE_MS = 20 * 60000;   /* 20 minutos */

  const st = {
    status: 'idle',   /* 'idle' | 'loading' | 'ready' | 'denied' | 'error' | 'unsupported' */
    data: null,       /* { temp, code, isDay, desc, city, uf, at, lat, lon } */
    timer: null
  };

  function esc(s) {
    return typeof escapeHtml === 'function'
      ? escapeHtml(String(s ?? ''))
      : String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  /* Códigos WMO (Open-Meteo) → descrição pt-BR + grupo visual */
  function classificarWMO(code, isDay) {
    const c = Number(code);
    if (c === 0) return { desc: isDay ? 'Céu limpo' : 'Noite limpa', kind: isDay ? 'sun' : 'moon' };
    if (c === 1 || c === 2) return { desc: isDay ? 'Parcialmente nublado' : 'Poucas nuvens', kind: isDay ? 'partly' : 'moon' };
    if (c === 3) return { desc: 'Nublado', kind: 'cloud' };
    if (c === 45 || c === 48) return { desc: 'Neblina', kind: 'fog' };
    if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return { desc: c >= 63 || c >= 81 ? 'Chuva forte' : 'Chuva', kind: 'rain' };
    if (c >= 71 && c <= 77) return { desc: 'Neve / granizo', kind: 'cloud' };
    if (c >= 95 && c <= 99) return { desc: 'Tempestade', kind: 'storm' };
    return { desc: 'Clima atual', kind: isDay ? 'sun' : 'moon' };
  }

  function svgIcon(kind) {
    const base = 'viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
    switch (kind) {
      case 'sun':
        return `<svg ${base}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`;
      case 'moon':
        return `<svg ${base}><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
      case 'partly':
        return `<svg ${base}><path d="M12 2v2M4.93 4.93l1.41 1.41M20 12h2M19.07 4.93l-1.41 1.41M15.947 12.65a4 4 0 0 0-5.925-4.128"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/></svg>`;
      case 'rain':
        return `<svg ${base}><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M8 19v2M12 17v4M16 19v2"/></svg>`;
      case 'storm':
        return `<svg ${base}><path d="M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973"/><path d="m13 12-3 5h4l-3 5"/></svg>`;
      case 'fog':
        return `<svg ${base}><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 17H7M17 21H9"/></svg>`;
      case 'pin':
        return `<svg ${base}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;
      case 'cloud':
      default:
        return `<svg ${base}><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>`;
    }
  }

  function loadCache() {
    try {
      const raw = localStorage.getItem(LS_CACHE);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.temp === 'number' && parsed.at) return parsed;
    } catch (e) {}
    return null;
  }

  function saveCache(data) {
    try { localStorage.setItem(LS_CACHE, JSON.stringify(data)); } catch (e) {}
  }

  function notify() {
    document.dispatchEvent(new CustomEvent('sir:clima-updated', { detail: { status: st.status, data: st.data } }));
    const slot = document.getElementById('nf-clima-slot');
    if (slot) slot.innerHTML = renderPillHTML();
  }

  async function fetchJsonTimeout(url, ms) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms || 10000);
    try {
      const r = await fetch(url, { signal: ac.signal, cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally {
      clearTimeout(t);
    }
  }

  async function fetchWeatherForCoords(lat, lon) {
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat.toFixed(4))}&longitude=${encodeURIComponent(lon.toFixed(4))}&current=temperature_2m,weather_code,is_day&timezone=auto`;
    const geoUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(lat.toFixed(4))}&longitude=${encodeURIComponent(lon.toFixed(4))}&localityLanguage=pt`;

    const [wRes, gRes] = await Promise.allSettled([
      fetchJsonTimeout(weatherUrl, 10000),
      fetchJsonTimeout(geoUrl, 8000)
    ]);

    if (wRes.status !== 'fulfilled' || !wRes.value || !wRes.value.current) {
      throw new Error('clima_indisponivel');
    }

    const cur = wRes.value.current;
    const temp = Math.round(Number(cur.temperature_2m));
    const code = Number(cur.weather_code);
    const isDay = cur.is_day !== 0;
    const info = classificarWMO(code, isDay);

    let city = '';
    let uf = '';
    if (gRes.status === 'fulfilled' && gRes.value) {
      const g = gRes.value;
      city = String(g.city || g.locality || g.principalSubdivision || '').trim();
      const subCode = String(g.principalSubdivisionCode || '');
      const mUf = subCode.match(/^[A-Z]{2}-([A-Z]{2})$/);
      if (mUf) uf = mUf[1];
    }
    if (!city) city = 'Local atual';

    const data = { temp, code, isDay, desc: info.desc, kind: info.kind, city, uf, lat, lon, at: Date.now() };
    st.data = data;
    st.status = 'ready';
    saveCache(data);
    scheduleRefresh();
    notify();
  }

  function scheduleRefresh() {
    if (st.timer) clearTimeout(st.timer);
    st.timer = setTimeout(() => {
      if (st.data && typeof st.data.lat === 'number' && typeof st.data.lon === 'number') {
        fetchWeatherForCoords(st.data.lat, st.data.lon).catch(() => {});
      }
    }, CACHE_MS);
  }

  function solicitarLocalizacao(manual) {
    if (!('geolocation' in navigator)) {
      st.status = 'unsupported';
      notify();
      return;
    }
    if (st.status === 'loading') return;
    if (!manual) {
      try { sessionStorage.setItem(LS_ASKED, '1'); } catch (e) {}
    }
    st.status = 'loading';
    notify();

    navigator.geolocation.getCurrentPosition(
      pos => {
        fetchWeatherForCoords(pos.coords.latitude, pos.coords.longitude).catch(() => {
          st.status = st.data ? 'ready' : 'error';
          notify();
        });
      },
      err => {
        if (err && err.code === 1) {
          st.status = 'denied';
          if (manual && typeof showActionToast === 'function') {
            showActionToast('Permita a localização nas configurações do navegador para exibir o clima local.');
          }
        } else {
          st.status = st.data ? 'ready' : 'error';
        }
        notify();
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 10 * 60000 }
    );
  }

  function renderPillHTML() {
    if (st.status === 'unsupported') return '';
    if (st.data && (st.status === 'ready' || st.status === 'loading')) {
      const d = st.data;
      const localTxt = d.uf ? `${d.city}, ${d.uf}` : d.city;
      const tip = `${localTxt} · ${d.desc} · ${d.temp}°C · clique para atualizar`;
      const cls = `nf-clima is-${esc(d.kind || 'cloud')}${st.status === 'loading' ? ' is-loading' : ''}`;
      return `<button type="button" class="${cls}" data-nf-act="clima" title="${esc(tip)}" aria-label="${esc(`Clima em ${localTxt}: ${d.temp} graus, ${d.desc}. Clique para atualizar`)}">`
        + `<span class="nf-clima-ico">${svgIcon(d.kind)}</span>`
        + `<span class="nf-clima-temp">${d.temp}°C</span>`
        + `<span class="nf-clima-sep" aria-hidden="true">·</span>`
        + `<span class="nf-clima-city">${esc(d.city)}</span>`
        + `</button>`;
    }
    if (st.status === 'loading') {
      return `<span class="nf-clima is-loading" aria-live="polite"><span class="nf-clima-ico">${svgIcon('pin')}</span><span>Localizando…</span></span>`;
    }
    const label = st.status === 'denied' ? 'Ativar localização' : 'Clima local';
    const tip = st.status === 'denied'
      ? 'Autorize o acesso à localização no navegador para mostrar sua cidade e o clima atual'
      : 'Autorizar localização para exibir cidade e clima atual';
    return `<button type="button" class="nf-clima is-prompt" data-nf-act="clima" title="${esc(tip)}" aria-label="${esc(tip)}">`
      + `<span class="nf-clima-ico">${svgIcon('pin')}</span>`
      + `<span>${esc(label)}</span>`
      + `</button>`;
  }

  function init() {
    if (!('geolocation' in navigator)) { st.status = 'unsupported'; return; }
    const cached = loadCache();
    if (cached) {
      st.data = cached;
      st.status = 'ready';
      notify();
      if (Date.now() - cached.at < CACHE_MS) {
        scheduleRefresh();
        return;
      }
      if (typeof cached.lat === 'number' && typeof cached.lon === 'number') {
        fetchWeatherForCoords(cached.lat, cached.lon).catch(() => {});
        return;
      }
    }

    const jaPediu = (() => { try { return sessionStorage.getItem(LS_ASKED) === '1'; } catch (e) { return false; } })();

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then(p => {
        if (p.state === 'granted') {
          solicitarLocalizacao(false);
        } else if (p.state === 'denied') {
          st.status = 'denied';
          notify();
        } else if (!jaPediu) {
          /* Pede autorização sutilmente na 1ª entrada da sessão */
          setTimeout(() => solicitarLocalizacao(false), 900);
        }
        p.onchange = () => {
          if (p.state === 'granted') solicitarLocalizacao(false);
          else if (p.state === 'denied') { st.status = 'denied'; notify(); }
        };
      }).catch(() => {
        if (!jaPediu) setTimeout(() => solicitarLocalizacao(false), 900);
      });
    } else if (!jaPediu) {
      setTimeout(() => solicitarLocalizacao(false), 900);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  root.SirClima = {
    renderPillHTML,
    atualizar: () => solicitarLocalizacao(true),
    getState: () => ({ status: st.status, data: st.data })
  };
})(window);
