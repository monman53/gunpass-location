(function () {
  'use strict';

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
  const MARKER_RING  = 'hsl(4, 92%, 38%)';

  // 外側の白リング（常に表示・非インタラクティブ）
  function markerOuterStyle() {
    return {
      radius: 9,
      fillColor: '#fff',
      fillOpacity: 1,
      color: '#fff',
      weight: 2.5,
      opacity: 1,
      interactive: false,
      bubblingMouseEvents: false,
    };
  }

  // 内側の緑リング／塗りつぶし
  function markerStyle(isStamped, isOptional) {
    return {
      radius: 7,
      fillColor: MARKER_FILL,
      fillOpacity: isStamped ? 0.9 : 0,
      color: MARKER_RING,
      weight: 2.5,
      opacity: 1,
      dashArray: isOptional ? '4 3' : null,
    };
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



  function attachStampBtn(popup, stamped, locId, circleEntry, geojsonLayer, updateProgress) {
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
      circleEntry.circle.setStyle(markerStyle(stamped.has(String(locId)), circleEntry.optional));
      if (geojsonLayer) geojsonLayer.resetStyle();
      updateProgress();
    });
  }

  Promise.all([
    fetch('data.json').then(r => r.json()),
    fetch('municipalities.geojson').then(r => r.json()),
    fetch('gunma_mask.geojson').then(r => r.json()),
  ]).then(([{ regions, locations }, geoData, maskData]) => {
    const stamped = loadStamped();

    function isAnyStamped(municipality) {
      return locations.some(l => !l.optional && l.municipality === municipality && stamped.has(String(l.id)));
    }

    function stampedMuniCount() {
      const munis = new Set();
      for (const loc of locations) {
        if (!loc.optional && stamped.has(String(loc.id))) munis.add(loc.municipality);
      }
      return munis.size;
    }

    const allMunicipalities = [...new Set(locations.map(l => l.municipality))];
    const circleByLocId = {};
    let geojsonLayer = null;

    function updateProgress() {
      document.getElementById('progress').innerHTML =
        `収集済み: <strong>${stampedMuniCount()}&thinsp;/&thinsp;${allMunicipalities.length} 自治体</strong>`;
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

    // GitHub リンク（右上コントロール）
    const githubControl = L.control({ position: 'topright' });
    githubControl.onAdd = function () {
      const el = L.DomUtil.create('a', 'leaflet-control-github');
      el.href = 'https://github.com/monman53/gunpass-location';
      el.target = '_blank';
      el.rel = 'noopener';
      el.title = 'GitHub';
      el.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 98 96" width="16" height="16" aria-label="GitHub"><path fill-rule="evenodd" clip-rule="evenodd" d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z" fill="currentColor"/></svg>';
      L.DomEvent.disableClickPropagation(el);
      return el;
    };
    githubControl.addTo(map);

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
      style: feature => polygonStyle(isAnyStamped(feature.properties.name)),
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
      // 外側の白リング（装飾用・非インタラクティブ）
      L.circleMarker([loc.lat, loc.lng], markerOuterStyle()).addTo(map);

      // 内側の緑リング／塗りつぶし（インタラクティブ）
      const circle = L.circleMarker(
        [loc.lat, loc.lng],
        markerStyle(stamped.has(String(loc.id)), loc.optional)
      ).addTo(map);

      circle.on('click', () => { markerClicked = true; });
      circle.bindTooltip(loc.name, { permanent: true, direction: 'top', offset: [0, -10], className: 'marker-label' });
      circle.bindPopup(
        () => makeMarkerPopupContent(loc, regions, stamped),
        { maxWidth: 250, minWidth: 210 }
      );
      circleByLocId[loc.id] = { circle, optional: loc.optional };
      circle.on('popupopen', () => {
        attachStampBtn(circle.getPopup(), stamped, loc.id, circleByLocId[loc.id], geojsonLayer, updateProgress);
        const copyBtn = circle.getPopup().getElement().querySelector('.copy-btn');
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
      Object.values(circleByLocId).forEach(({ circle }) => {
        show ? circle.openTooltip() : circle.closeTooltip();
      });
    }
    map.on('zoomend', updateMarkerLabels);
    updateMarkerLabels();

    document.getElementById('btn-reset').addEventListener('click', () => {
      if (!confirm('全ての記録をリセットしますか?')) return;
      stamped.clear();
      saveStamped(stamped);
      Object.values(circleByLocId).forEach(({ circle, optional }) => {
        circle.setStyle(markerStyle(false, optional));
      });
      if (geojsonLayer) geojsonLayer.resetStyle();
      updateProgress();
    });

    updateProgress();
  });
})();
