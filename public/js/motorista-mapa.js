(() => {
  'use strict';
  const host = document.getElementById('driver-dashboard-map');
  if (!host) return;

  const status = document.getElementById('driver-map-status');
  const footnote = document.getElementById('driver-map-footnote');
  const refreshButton = document.getElementById('driver-map-refresh');
  const shareButton = document.getElementById('driver-map-share');
  const fitButton = document.getElementById('driver-map-fit');
  const token = () => localStorage.getItem('urbanlink_token') || sessionStorage.getItem('urbanlink_token') || '';
  const storedUser = () => {
    try { return JSON.parse(localStorage.getItem('urbanlink_usuario') || sessionStorage.getItem('urbanlink_usuario') || 'null'); }
    catch (_) { return null; }
  };
  const setStatus = text => { if (status) status.textContent = text; };
  const valid = (lat, lon) => lat !== null && lat !== undefined && lon !== null && lon !== undefined &&
    String(lat).trim() !== '' && String(lon).trim() !== '' && Number.isFinite(Number(lat)) &&
    Number.isFinite(Number(lon)) && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lon)) <= 180;

  let map = null;
  let markersLayer = null;
  let lastPosition = null;
  let loading = false;
  let lastBounds = null;

  async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (token()) headers.Authorization = `Bearer ${token()}`;
    if (options.body) headers['Content-Type'] = 'application/json';
    const response = await fetch(`/api${path}`, {
      ...options,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.mensagem || `Falha ao consultar os dados (${response.status}).`);
    return data;
  }

  function pin(label) {
    return L.divIcon({
      className: '',
      html: `<div class="driver-map-pin"><span>${label}</span></div>`,
      iconSize: [30, 30], iconAnchor: [15, 28], popupAnchor: [0, -26]
    });
  }

  function deliveryPopup(delivery, index) {
    const content = document.createElement('div');
    content.className = 'driver-map-popup';
    const title = document.createElement('strong');
    title.textContent = `${index + 1}. ${delivery.codigo || 'Entrega'}`;
    const address = document.createElement('p');
    address.textContent = delivery.destino || 'Destino não informado';
    const state = document.createElement('p');
    state.textContent = `Status: ${delivery.status || 'Não informado'}`;
    const navigate = document.createElement('a');
    navigate.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${delivery.destino_latitude},${delivery.destino_longitude}`)}`;
    navigate.target = '_blank';
    navigate.rel = 'noopener noreferrer';
    navigate.textContent = 'Abrir navegação';
    content.append(title, address, state, navigate);
    return content;
  }

  function setBusy(isBusy) {
    loading = isBusy;
    if (refreshButton) {
      refreshButton.disabled = isBusy;
      refreshButton.textContent = isBusy ? 'Atualizando…' : 'Atualizar mapa';
    }
  }

  function getBrowserPosition() {
    if (!navigator.geolocation) return Promise.reject(new Error('Este navegador não oferece geolocalização.'));
    return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(
      position => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        velocidade_kmh: position.coords.speed == null ? null : position.coords.speed * 3.6
      }),
      () => reject(new Error('Não foi possível obter sua posição. Autorize a localização no navegador e use uma conexão segura (HTTPS ou localhost).')),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 }
    ));
  }

  async function drawMap() {
    if (markersLayer) markersLayer.clearLayers();
    const bounds = [];
    const deliveryResult = await api('/entregas?limite=100');
    const vehicleResult = await api('/veiculos?limite=100');
    const deliveries = (deliveryResult.dados || []).filter(item =>
      !['Entregue', 'Cancelada'].includes(item.status) && valid(item.destino_latitude, item.destino_longitude)
    );
    const vehicles = vehicleResult.dados || [];
    let hasSharedPosition = false;

    deliveries.forEach((delivery, index) => {
      const coords = [Number(delivery.destino_latitude), Number(delivery.destino_longitude)];
      L.marker(coords, { icon: pin(String(index + 1)) })
        .bindPopup(deliveryPopup(delivery, index))
        .addTo(markersLayer);
      bounds.push(coords);
    });

    for (const vehicle of vehicles) {
      try {
        const history = await api(`/veiculos/${vehicle.id}/posicoes`);
        const latest = (history.dados || [])[0];
        if (latest && valid(latest.latitude, latest.longitude)) {
          const coords = [Number(latest.latitude), Number(latest.longitude)];
          const when = latest.registrada_em ? new Date(latest.registrada_em).toLocaleString('pt-BR') : 'Horário não informado';
          L.circleMarker(coords, {
            radius: 9, color: '#fff', weight: 3, fillColor: '#1b1642', fillOpacity: 1
          }).bindPopup(` <strong>Sua última posição compartilhada</strong><br>${when} `).addTo(markersLayer);
          bounds.push(coords);
          hasSharedPosition = true;
          lastPosition = latest;
        }
      } catch (_) {
        // O mapa continua mostrando os destinos mesmo se o histórico estiver indisponível.
      }
    }

    lastBounds = bounds.length ? L.latLngBounds(bounds) : null;
    if (lastBounds) map.fitBounds(lastBounds, { padding: [26, 26], maxZoom: 14 });
    else map.setView([-22.9068, -43.1729], 11);

    const count = (deliveryResult.dados || []).filter(item => !['Entregue', 'Cancelada'].includes(item.status)).length;
    const withoutCoordinates = count - deliveries.length;
    setStatus(`${count} entrega(s) ativa(s) atribuída(s) a você${hasSharedPosition ? ' · posição compartilhada exibida' : ''}${withoutCoordinates ? ` · ${withoutCoordinates} sem coordenadas` : ''}.`);
    if (!count) setStatus('Você ainda não possui entregas atribuídas. Quando o gestor atribuir um pedido, ele aparecerá aqui.');
    if (footnote) {
      footnote.textContent = hasSharedPosition
        ? `Última posição registrada: ${lastPosition?.registrada_em ? new Date(lastPosition.registrada_em).toLocaleString('pt-BR') : 'data não informada'}. Toque em um destino para navegar.`
        : 'A posição só aparece depois que você a compartilha. Toque em um destino para navegar.';
    }
    map.invalidateSize();
  }

  async function refresh() {
    if (loading) return;
    setBusy(true);
    setStatus('Atualizando suas entregas e a última posição compartilhada…');
    try { await drawMap(); }
    catch (error) { setStatus(error.message); }
    finally { setBusy(false); }
  }

  async function sharePosition() {
    if (loading) return;
    const user = storedUser();
    if (user?.aprovado === false) {
      setStatus('Seu cadastro ainda está em análise. O compartilhamento da posição será liberado após a aprovação.');
      return;
    }
    if (shareButton) { shareButton.disabled = true; shareButton.textContent = 'Obtendo posição…'; }
    try {
      const position = await getBrowserPosition();
      const vehicleResult = await api('/veiculos?limite=100');
      const vehicle = (vehicleResult.dados || [])[0];
      if (!vehicle) throw new Error('Não há veículo vinculado à sua conta. Solicite a vinculação ao administrador.');
      await api(`/veiculos/${vehicle.id}/posicoes`, {
        method: 'POST',
        body: position
      });
      setStatus('Posição compartilhada com a operação. Atualizando o mapa…');
      await refresh();
    } catch (error) {
      setStatus(error.message);
    } finally {
      if (shareButton) {
        shareButton.disabled = false;
        shareButton.textContent = 'Compartilhar posição';
      }
    }
  }

  async function init() {
    if (!window.L) { setStatus('Não foi possível carregar o mapa. Verifique sua conexão.'); return; }
    map = L.map(host, { scrollWheelZoom: false }).setView([-22.9068, -43.1729], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    markersLayer = L.layerGroup().addTo(map);
    L.control.scale({ imperial: false }).addTo(map);
    fitButton?.addEventListener('click', () => { if (lastBounds) map.fitBounds(lastBounds, { padding: [28, 28], maxZoom: 15 }); else setStatus('Ainda não há pontos geográficos para centralizar.'); });

    const user = storedUser();
    if (user?.aprovado === false && shareButton) {
      shareButton.disabled = true;
      shareButton.textContent = 'Disponível após aprovação';
      shareButton.title = 'O compartilhamento de posição será liberado após a aprovação do cadastro.';
    } else {
      shareButton?.addEventListener('click', sharePosition);
    }
    refreshButton?.addEventListener('click', refresh);

    await refresh();
    window.setTimeout(() => map.invalidateSize(), 220);
  }

  document.addEventListener('DOMContentLoaded', () => init().catch(error => setStatus(error.message)));
})();
