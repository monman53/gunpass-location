(function () {
  'use strict';

  if (typeof navigator.share !== 'function') {
    const el = document.getElementById('btn-share-label');
    if (el) el.textContent = '画像をコピー';
  }

  // v2: location ID ベースに変更（旧: 自治体名ベース）
  const STORAGE_KEY = 'gunpass_stamps_v2';

  function loadStamped() {
    try {
      return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]').map(String));
    } catch {
      return new Set();
    }
  }

  function saveStamped(set) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  }

  const GREEN_RING   = 'hsl(142, 72%, 28%)';
  const GREEN_POLY_STAMPED  = 'hsl(142, 72%, 30%)';
  const GREEN_POLY_UNSTAMPED = '#fff';
  const MARKER_FILL  = 'hsl(4, 92%, 52%)';

  function stampIcon(isStamped, isOptional) {
    const fill = isStamped ? MARKER_FILL : 'white';
    const stroke = isStamped ? 'white' : MARKER_FILL;
    const fillOpacity = isStamped ? '0.92' : '0.9';
    const dash = isOptional ? 'stroke-dasharray="4 3"' : '';
    const d = 'M8.5,15 A7,7,0,1,1,15.5,15 L15.5,22 L22,22 L24,29 L0,29 L2,22 L8.5,22 Z';
    // 丸い持ち手(cx=12,cy=9,r=7)の左右接線点: x=8.5 or 15.5 → y=9+sqrt(49-12.25)≈15
    const svg = `<svg width="24" height="30" viewBox="0 0 24 30" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 0 2px rgba(0,0,0,0.3))">
      <path d="${d}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="1.5" stroke-linejoin="round" ${dash}/>
    </svg>`;
    return L.divIcon({
      html: svg,
      className: '',
      iconSize: [24, 30],
      iconAnchor: [12, 29],
      tooltipAnchor: [0, -30],
      popupAnchor: [0, -15],
    });
  }

  function polygonStyle(isStamped) {
    return {
      fillColor: isStamped ? GREEN_POLY_STAMPED : GREEN_POLY_UNSTAMPED,
      fillOpacity: isStamped ? 0.45 : 0.30,
      color: GREEN_RING,
      weight: 2.5,
      opacity: 0.90,
    };
  }

  function makeMarkerPopupContent(loc, regions, stamped) {
    const regionName = regions[loc.region];
    const isStamped = stamped.has(String(loc.id));
    const mapsUrl =
      'https://www.google.com/maps/search/?api=1&query=' +
      encodeURIComponent(loc.name + ' ' + loc.address);
    return `<div class="location-popup">
      <h3>${loc.name}<span class="muni-inline">（${loc.municipality}・${regionName}地区）</span></h3>
      ${loc.optional ? '<p class="optional-notice">コンプリート対象外</p>' : ''}
      <div class="popup-actions">
        <a class="action-btn maps-btn" href="${mapsUrl}" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor"/></svg>
          <span>Google Maps</span>
        </a>
        <button class="action-btn stamp-btn${isStamped ? ' stamped' : ''}" data-location-id="${loc.id}">
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor"/></svg>
          <span class="btn-label">${isStamped ? '記録済み' : '記録する'}</span>
        </button>
      </div>
      <p class="detail-address">
        <span>${loc.address}</span>
        <button class="copy-btn" data-copy="${loc.address}" title="住所をコピー">
          <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" fill="currentColor"/></svg>
        </button>
      </p>
      <p class="popup-notice">情報は2026年5月時点です。最新情報は<a href="https://gunpass.pref.gunma.jp/location/" target="_blank" rel="noopener">公式ページ</a>をご確認ください。</p>
    </div>`;
  }



  function attachStampBtn(popup, stamped, locId, circleEntry, geojsonLayer, refreshMunis, updateProgress) {
    const btn = popup.getElement().querySelector('.stamp-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const label = btn.querySelector('.btn-label');
      if (stamped.has(String(locId))) {
        stamped.delete(String(locId));
        if (label) label.textContent = '記録する';
        btn.classList.remove('stamped');
      } else {
        stamped.add(String(locId));
        if (label) label.textContent = '記録済み';
        btn.classList.add('stamped');
      }
      saveStamped(stamped);
      circleEntry.marker.setIcon(stampIcon(stamped.has(String(locId)), circleEntry.optional));
      refreshMunis();
      if (geojsonLayer) geojsonLayer.resetStyle();
      updateProgress();
    });
  }

  // === Share ===

  function getBBox(features) {
    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
    function visit(c) {
      if (typeof c[0] === 'number') {
        if (c[0] < minLon) minLon = c[0];
        if (c[0] > maxLon) maxLon = c[0];
        if (c[1] < minLat) minLat = c[1];
        if (c[1] > maxLat) maxLat = c[1];
      } else { c.forEach(visit); }
    }
    features.forEach(f => visit(f.geometry.coordinates));
    return { minLon, maxLon, minLat, maxLat };
  }

  function makeTransform(bbox, W, H, padT, padB, padL, padR) {
    const { minLon, maxLon, minLat, maxLat } = bbox;
    const midLat = (minLat + maxLat) / 2;
    const cos = Math.cos(midLat * Math.PI / 180);
    const lonSpan = (maxLon - minLon) * cos;
    const latSpan = maxLat - minLat;
    const areaW = W - padL - padR, areaH = H - padT - padB;
    const scale = Math.min(areaW / lonSpan, areaH / latSpan);
    const midLon = (minLon + maxLon) / 2;
    const cx = padL + areaW / 2, cy = padT + areaH / 2;
    return (lon, lat) => [cx + (lon - midLon) * cos * scale, cy - (lat - midLat) * scale];
  }

  function addGrain(ctx, W, H) {
    const imageData = ctx.getImageData(0, 0, W, H);
    const data = imageData.data;
    const pixelCount = W * H;
    const rnd = new Uint8Array(pixelCount);
    const chunkSize = 65536;
    for (let off = 0; off < pixelCount; off += chunkSize) {
      crypto.getRandomValues(rnd.subarray(off, Math.min(off + chunkSize, pixelCount)));
    }
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      const g = (rnd[j] - 128) / 128 * 14;
      data[i]   = Math.max(0, Math.min(255, data[i]   + g));
      data[i+1] = Math.max(0, Math.min(255, data[i+1] + g));
      data[i+2] = Math.max(0, Math.min(255, data[i+2] + g));
    }
    ctx.putImageData(imageData, 0, 0);
  }

  function getFeatureCentroid(feature) {
    const geom = feature.geometry;
    let ring;
    if (geom.type === 'Polygon') {
      ring = geom.coordinates[0];
    } else {
      ring = geom.coordinates[0][0];
      geom.coordinates.forEach(poly => {
        if (poly[0].length > ring.length) ring = poly[0];
      });
    }
    const [sumLon, sumLat] = ring.reduce(([a, b], [lon, lat]) => [a + lon, b + lat], [0, 0]);
    return [sumLon / ring.length, sumLat / ring.length];
  }

  function generateShareCanvas(geoData, locations, stamped) {
    const W = 1080, H = 1080;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(0, 0, W, H);

    const transform = makeTransform(getBBox(geoData.features), W, H, 90, 80, 60, 60);

    // 自治体ポリゴン
    const stampedMuniSet = new Set(
      locations.filter(l => !l.optional && stamped.has(String(l.id))).map(l => l.municipality)
    );
    geoData.features.forEach(feature => {
      const name = feature.properties.name;
      const isStamped = stampedMuniSet.has(name);
      const geom = feature.geometry;
      const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
      ctx.beginPath();
      polys.forEach(poly => poly.forEach(ring => {
        ring.forEach(([lon, lat], i) => {
          const [x, y] = transform(lon, lat);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.closePath();
      }));
      ctx.fillStyle = isStamped ? 'hsl(142, 60%, 38%)' : '#f0f0f0';
      ctx.fill('evenodd');
      ctx.strokeStyle = GREEN_RING;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // スタンプアイコン
    const SCALE = 0.95;
    const stampPath = new Path2D('M8.5,15 A7,7,0,1,1,15.5,15 L15.5,22 L22,22 L24,29 L0,29 L2,22 L8.5,22 Z');
    locations.forEach(loc => {
      const [x, y] = transform(loc.lng, loc.lat);
      const isStamped = stamped.has(String(loc.id));
      ctx.save();
      ctx.translate(x - 12 * SCALE, y - 29 * SCALE);
      ctx.scale(SCALE, SCALE);
      ctx.lineJoin = 'round';
      // 塗り（スタンプ済み=赤、未=白）
      ctx.fillStyle = isStamped ? MARKER_FILL : 'white';
      ctx.fill(stampPath);
      // 枠線（スタンプ済み=白、未=赤）
      ctx.strokeStyle = isStamped ? 'white' : MARKER_FILL;
      ctx.lineWidth = 1.8 / SCALE;
      if (loc.optional) ctx.setLineDash([4, 3]);
      ctx.stroke(stampPath);
      ctx.setLineDash([]);
      ctx.restore();
    });

    // 市区町村名ラベル（スタンプより手前）
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    geoData.features.forEach(feature => {
      const [lon, lat] = getFeatureCentroid(feature);
      const [x, y] = transform(lon, lat);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 4;
      ctx.strokeText(feature.properties.name, x, y);
      ctx.fillStyle = '#222';
      ctx.fillText(feature.properties.name, x, y);
    });

    // テキスト
    const count = new Set(locations.filter(l => !l.optional && stamped.has(String(l.id))).map(l => l.municipality)).size;
    const total = new Set(locations.filter(l => !l.optional).map(l => l.municipality)).size;
    const completed = count === total;

    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#111';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('GUNMA PASSPORT スタンプマップ', 36, 44);
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#777';
    ctx.fillText('（非公式）', 36, 68);

    ctx.font = 'bold 28px sans-serif';
    ctx.fillStyle = completed ? GREEN_RING : '#333';
    ctx.textAlign = 'right';
    ctx.fillText(
      completed ? `${count}/${total} 自治体コンプリート！` : `${count}/${total} 自治体収集中`,
      W - 36, 44
    );

    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#888';
    ctx.textBaseline = 'bottom';
    ctx.fillText('https://monman53.github.io/gunpass-location/', W - 24, H - 16);

    addGrain(ctx, W, H);

    return { canvas, count, total };
  }

  function showToast(msg) {
    const existing = document.querySelector('.share-toast');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.className = 'share-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  async function handleShare(geoData, locations, stamped) {
    const btn = document.getElementById('btn-share');
    btn.disabled = true;
    const origHTML = btn.innerHTML;
    btn.textContent = '生成中...';
    try {
      const { canvas, count, total } = generateShareCanvas(geoData, locations, stamped);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const file = new File([blob], 'gunpass.png', { type: 'image/png' });
      const completed = count === total;
      const text = completed
        ? `GUNMA PASSPORT スタンプラリー ${count}/${total} 自治体コンプリート！ #GUNMAPASSPORT #群馬パスポート`
        : `GUNMA PASSPORT スタンプラリー ${count}/${total} 自治体収集中 #GUNMAPASSPORT #群馬パスポート`;
      const shareUrl = 'https://monman53.github.io/gunpass-location/';

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text, url: shareUrl });
          return;
        } catch (e) {
          if (e.name === 'AbortError') return;
        }
      }

      // フォールバック: クリップボードにコピー
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        showToast('画像をクリップボードにコピーしました。');
      } catch {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'gunpass.png';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        showToast('画像をダウンロードしました。');
      }
    } finally {
      btn.disabled = false;
      btn.innerHTML = origHTML;
    }
  }

  Promise.all([
    fetch('data.json').then(r => r.json()),
    fetch('municipalities.geojson').then(r => r.json()),
    fetch('gunma_mask.geojson').then(r => r.json()),
  ]).then(([{ regions, locations }, geoData, maskData]) => {
    const stamped = loadStamped();

    const totalMuniCount = new Set(locations.map(l => l.municipality)).size;
    let stampedMunis = new Set();
    const circleByLocId = {};
    let geojsonLayer = null;

    function refreshStampedMunis() {
      stampedMunis = new Set(
        locations.filter(l => !l.optional && stamped.has(String(l.id))).map(l => l.municipality)
      );
    }

    function updateProgress() {
      document.getElementById('progress').innerHTML =
        `収集済み: <strong>${stampedMunis.size}&thinsp;/&thinsp;${totalMuniCount} 自治体</strong>`;
    }

    const map = L.map('map', { wheelPxPerZoomLevel: 120, minZoom: 8 }).setView([36.52, 139.0], 9);

    const GSI = 'https://cyberjapandata.gsi.go.jp/xyz';
    const CARTO_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
    const GSI_ATTR = '&copy; <a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>';

    const baseLayers = {
      'Voyager（色付き）': L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19, attribution: CARTO_ATTR,
      }),
      'Positron（薄色）': L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19, attribution: CARTO_ATTR,
      }),
      'Dark Matter（暗色）': L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19, attribution: CARTO_ATTR,
      }),
      'OpenStreetMap': L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }),
      '地形図（OpenTopo）': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
      }),
      '国土地理院 標準': L.tileLayer(`${GSI}/std/{z}/{x}/{y}.png`, {
        maxZoom: 18, attribution: GSI_ATTR,
      }),
      '国土地理院 淡色': L.tileLayer(`${GSI}/pale/{z}/{x}/{y}.png`, {
        maxZoom: 18, attribution: GSI_ATTR,
      }),
      '国土地理院 写真': L.tileLayer(`${GSI}/seamlessphoto/{z}/{x}/{y}.jpg`, {
        maxZoom: 18, attribution: GSI_ATTR,
      }),
    };

    baseLayers['国土地理院 淡色'].addTo(map);
    L.control.layers(baseLayers, null, { position: 'topright', collapsed: true }).addTo(map);

    // ポップアップが閉じた直後に別のポップアップが開くのを防ぐ
    let suppressNextPopup = false;
    let weClosingPopup = false;
    let suppressTimer = null;
    let markerClicked = false;

    map.on('popupclose', () => {
      if (weClosingPopup) return;
      suppressNextPopup = true;
      markerClicked = false;
      clearTimeout(suppressTimer);
      suppressTimer = setTimeout(() => { suppressNextPopup = false; }, 300);
    });

    map.on('popupopen', () => {
      clearTimeout(suppressTimer);
      if (suppressNextPopup && !markerClicked) {
        suppressNextPopup = false;
        weClosingPopup = true;
        map.closePopup();
        weClosingPopup = false;
        return;
      }
      suppressNextPopup = false;
      markerClicked = false;
    });

    // 国土数値情報 CC-BY 表示
    map.attributionControl.addAttribution(
      '行政区域: 「<a href="https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2026.html" target="_blank">国土数値情報（行政区域データ）</a>」（国土交通省）をもとに加工して作成'
    );

    // 自治体境界ポリゴン
    geojsonLayer = L.geoJSON(geoData, {
      style: feature => polygonStyle(stampedMunis.has(feature.properties.name)),
      onEachFeature: (feature, layer) => {
        const name = feature.properties.name;
        layer.bindTooltip(name, {
          permanent: true,
          direction: 'center',
          className: 'muni-label',
        });
        layer.on('mouseover', e => e.target.setStyle({ weight: 4 }));
        layer.on('mouseout', () => geojsonLayer.resetStyle(layer));
      },
    }).addTo(map);

    // 群馬県外マスク
    L.geoJSON(maskData, {
      style: { fillColor: '#888', fillOpacity: 0.45, color: 'none', weight: 0 },
      interactive: false,
    }).addTo(map);

    // スタンプ設置場所マーカー（ポリゴンより前面）
    locations.forEach(loc => {
      const marker = L.marker(
        [loc.lat, loc.lng],
        { icon: stampIcon(stamped.has(String(loc.id)), loc.optional) }
      ).addTo(map);

      marker.on('click', () => { markerClicked = true; });
      marker.bindTooltip(loc.name, { permanent: true, direction: 'top', className: 'marker-label' });
      marker.bindPopup(
        () => makeMarkerPopupContent(loc, regions, stamped),
        { maxWidth: 250, minWidth: 210 }
      );
      circleByLocId[loc.id] = { marker, optional: loc.optional };
      marker.on('popupopen', () => {
        attachStampBtn(marker.getPopup(), stamped, loc.id, circleByLocId[loc.id], geojsonLayer, refreshStampedMunis, updateProgress);
        const copyBtn = marker.getPopup().getElement().querySelector('.copy-btn');
        if (copyBtn) {
          copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(copyBtn.dataset.copy).then(() => {
              copyBtn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor"/></svg>';
              setTimeout(() => {
                copyBtn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" fill="currentColor"/></svg>';
              }, 2000);
            });
          });
        }
      });
    });

    const LABEL_ZOOM = 11;
    function updateMarkerLabels() {
      const show = map.getZoom() >= LABEL_ZOOM;
      Object.values(circleByLocId).forEach(({ marker }) => {
        show ? marker.openTooltip() : marker.closeTooltip();
      });
    }
    map.on('zoomend', updateMarkerLabels);
    updateMarkerLabels();

    document.getElementById('btn-reset').addEventListener('click', () => {
      if (!confirm('全ての記録をリセットしますか?')) return;
      stamped.clear();
      saveStamped(stamped);
      Object.values(circleByLocId).forEach(({ marker, optional }) => {
        marker.setIcon(stampIcon(false, optional));
      });
      refreshStampedMunis();
      if (geojsonLayer) geojsonLayer.resetStyle();
      updateProgress();
    });

    document.getElementById('btn-share').addEventListener('click', () => {
      handleShare(geoData, locations, stamped);
    });

    refreshStampedMunis();
    updateProgress();
  });
})();
