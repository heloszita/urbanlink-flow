(() => {
  'use strict';
  const API = '/api';
  const $ = (selector) => document.querySelector(selector);
  const state = { map: null, deliveries: [], vehicles: [], routes: [], markers: [], routeLayer: null, originMarker: null, planned: null, user: null, selectedIds: new Set(), manualOrigin: null, markersById: new Map(), hasFitted: false };
  const token = () => localStorage.getItem('urbanlink_token') || sessionStorage.getItem('urbanlink_token') || '';
  const storedUser = () => {
    try { return JSON.parse(localStorage.getItem('urbanlink_usuario') || sessionStorage.getItem('urbanlink_usuario') || 'null'); }
    catch (_error) { return null; }
  };
  const feedback = (text) => { const node = $('#map-feedback'); if (node) node.textContent = text; };
  async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (token()) headers.Authorization = `Bearer ${token()}`;
    const init = { ...options, headers };
    if (options.body && typeof options.body !== 'string') {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(options.body);
    }
    const response = await fetch(`${API}${path}`, init);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.mensagem || `Não foi possível concluir a solicitação (${response.status}).`);
    return data;
  }
  async function apiTodasPaginas(path) {
    const divisor = path.includes('?') ? '&' : '?';
    const dados = [];
    let pagina = 1;
    let totalPaginas = 1;
    do {
      const result = await api(`${path}${divisor}limite=100&pagina=${pagina}`);
      dados.push(...(result.dados || []));
      totalPaginas = Number(result.totalPaginas) || 1;
      pagina++;
      if (pagina > 100 && pagina <= totalPaginas) throw new Error('Existem mais de 10.000 registros. Refine a seleção.');
    } while (pagina <= totalPaginas);
    return { dados, total: dados.length };
  }
  function hasCoordinate(value) {
    return value !== null && value !== undefined && String(value).trim() !== '' && Number.isFinite(Number(value));
  }
  function valid(lat, lon) {
    return hasCoordinate(lat) && hasCoordinate(lon) && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lon)) <= 180;
  }
  const point = (lat, lon) => [Number(lat), Number(lon)];
  const isDriver = () => state.user?.perfil === 'Motorista';
  const driverApproved = () => !isDriver() || state.user?.aprovado !== false;
  function pin(kind, label) {
    return L.divIcon({ className: '', html: `<div class="urbanlink-pin pin-${kind}"><span>${label}</span></div>`, iconSize: [31, 31], iconAnchor: [15, 29], popupAnchor: [0, -27] });
  }
  function addMarker(lat, lon, kind, label, popup) {
    const marker = L.marker(point(lat, lon), { icon: pin(kind, label) }).addTo(state.map).bindPopup(popup);
    state.markers.push(marker);
    return marker;
  }
  function clearMarkers() {
    state.markers.forEach(marker => state.map.removeLayer(marker));
    state.markers = [];
    state.markersById.clear();
  }
  function hasDestination(delivery) { return valid(delivery.destino_latitude, delivery.destino_longitude); }
  function filteredDeliveries() {
    const term = ($('#map-search').value || '').trim().toLowerCase();
    const status = $('#map-status').value;
    return state.deliveries.filter(delivery =>
      (!status || delivery.status === status) &&
      (!term || [delivery.codigo, delivery.destino, delivery.bairro, delivery.cidade].some(value => String(value || '').toLowerCase().includes(term)))
    );
  }
  function renderList() {
    const host = $('#map-delivery-list');
    host.replaceChildren();
    const rows = filteredDeliveries();
    if (state.planned?.entrega_ids?.length) {
      const order = new Map(state.planned.entrega_ids.map((id, index) => [Number(id), index]));
      rows.sort((a, b) => (order.get(Number(a.id)) ?? 9999) - (order.get(Number(b.id)) ?? 9999));
    }
    if (!rows.length) {
      const empty = document.createElement('p');
      empty.className = 'mapa-empty';
      empty.textContent = isDriver()
        ? 'Nenhuma entrega atribuída à sua conta neste momento. Quando o gestor atribuir um pedido, ele aparecerá aqui.'
        : 'Nenhuma entrega corresponde aos filtros.';
      host.append(empty);
      return;
    }
    rows.forEach((delivery, index) => {
      const row = document.createElement('div');
      row.className = 'mapa-delivery-row';
      const label = document.createElement('label');
      label.className = 'mapa-delivery-item';
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.value = delivery.id;
      check.checked = state.selectedIds.has(Number(delivery.id));
      check.addEventListener('change', () => {
        if (check.checked) state.selectedIds.add(Number(delivery.id));
        else state.selectedIds.delete(Number(delivery.id));
        row.classList.toggle('is-selected', check.checked);
        $('#map-count-stops').textContent = String(state.selectedIds.size);
        updateEligibleHint();
      });
      row.classList.toggle('is-selected', check.checked);
      check.disabled = !hasDestination(delivery) || !delivery.motorista_id || ['Entregue', 'Cancelada'].includes(delivery.status);
      const info = document.createElement('div');
      const title = document.createElement('strong');
      const routeOrder = state.planned?.entrega_ids?.map(Number).indexOf(Number(delivery.id));
      title.textContent = `${routeOrder >= 0 ? `${routeOrder + 1}. ` : ''}${delivery.codigo} · ${delivery.destino}`;
      const subtitle = document.createElement('small');
      subtitle.textContent = [delivery.bairro, delivery.cidade].filter(Boolean).join(' — ') || 'Endereço sem bairro/cidade';
      const status = document.createElement('small');
      status.className = 'mapa-status';
      status.textContent = `${delivery.status}${hasDestination(delivery) ? '' : ' · sem coordenadas do destino'}${delivery.motorista_id ? '' : ' · sem motorista atribuído'}`;
      info.append(title, subtitle, status);
      label.append(check, info);
      row.append(label);
      if (hasDestination(delivery)) {
        const navigate = document.createElement('a');
        navigate.className = 'mapa-navigate-link';
        navigate.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${delivery.destino_latitude},${delivery.destino_longitude}`)}`;
        navigate.target = '_blank';
        navigate.rel = 'noopener noreferrer';
        navigate.textContent = 'Como chegar';
        navigate.setAttribute('aria-label', `Abrir navegação até ${delivery.destino}`);
        row.append(navigate);
      }
      if (!hasDestination(delivery) && ['Administrador','Gestor'].includes(state.user?.perfil)) {
        const fixButton=document.createElement('button');
        fixButton.className='mapa-repair-button';fixButton.type='button';
        fixButton.textContent='Corrigir localização';
        fixButton.addEventListener('click', () => openLocationFix(delivery));
        row.append(fixButton);
      }
      row.addEventListener('click', event => {
        if (event.target === check || event.target.closest('a') || event.target.closest('label')) return;
        const marker = state.markersById.get(Number(delivery.id));
        if (marker) { state.map.flyTo(marker.getLatLng(), Math.max(state.map.getZoom(), 15)); marker.openPopup(); }
      });
      host.append(row);
    });
    updateEligibleHint();
  }
  function updateEligibleHint() {
    const label=$('#map-eligible-label'); if (!label) return;
    const eligible=filteredDeliveries().filter(d=>hasDestination(d)&&d.motorista_id&&!['Entregue','Cancelada'].includes(d.status));
    label.textContent=`${eligible.length} elegíveis para rota · ${state.selectedIds.size} selecionada(s)`;
  }

  function openLocationFix(delivery) {
    if (!['Administrador', 'Gestor'].includes(state.user?.perfil)) return;
    const dialog=$('#map-fix-location');if(!dialog) return;
    dialog.dataset.deliveryId=String(delivery.id);
    $('#map-fix-description').textContent=`${delivery.codigo} · ${delivery.destino}`;
    $('#map-fix-message').textContent='Primeiro tente localizar automaticamente. Caso não funcione, informe as coordenadas manualmente.';
    $('#map-fix-lat').value='';$('#map-fix-lon').value='';
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open','');
  }
  async function repairLocation(auto) {
    const dialog=$('#map-fix-location');
    const id=Number(dialog?.dataset.deliveryId);
    if(!id) return;
    const btn=auto?$('#map-fix-auto'):$('#map-fix-save');
    btn.disabled=true;
    $('#map-fix-message').textContent=auto?'Consultando o endereço…':'Salvando coordenadas…';
    try{
      let body={};
      if(!auto){
        const latitude=$('#map-fix-lat').value.trim(),longitude=$('#map-fix-lon').value.trim();
        if(!latitude||!longitude||!valid(latitude,longitude)) throw new Error('Preencha uma latitude e longitude válidas.');
        body={ latitude:Number(latitude), longitude:Number(longitude) };
      }
      const r=await api(`/entregas/${id}/localizacao`, {method:'PATCH',body});
      const item=state.deliveries.find(d=>Number(d.id)===id);
      if(item){item.destino_latitude=r.entrega.destino_latitude;item.destino_longitude=r.entrega.destino_longitude;}
      if(dialog.close)dialog.close();else dialog.removeAttribute('open');
      renderList();renderMap(true);
      feedback(`Coordenadas de ${item?.codigo||'entrega'} atualizadas. Agora o destino pode ser selecionado.`);
    }catch(e){$('#map-fix-message').textContent=e.message;}
    finally{btn.disabled=false;}
  }
  function popupSeguro(titulo, linhas = [], url = null) {
    const container = document.createElement('div');
    const heading = document.createElement('strong');
    heading.textContent = titulo || '';
    container.append(heading);
    for (const linha of linhas) {
      container.append(document.createElement('br'), document.createTextNode(String(linha ?? '')));
    }
    if (url) {
      container.append(document.createElement('br'));
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Abrir navegação';
      container.append(link);
    }
    return container;
  }

  function renderMap(fit = false) {
    clearMarkers();
    filteredDeliveries().filter(hasDestination).forEach(delivery => {
      const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${delivery.destino_latitude},${delivery.destino_longitude}`)}`;
      const marker = addMarker(delivery.destino_latitude, delivery.destino_longitude, 'delivery', 'D',
        popupSeguro(delivery.codigo, [delivery.destino, `Status: ${delivery.status}`], mapsUrl));
      state.markersById.set(Number(delivery.id), marker);
    });
    state.vehicles.forEach(vehicle => {
      const position = vehicle.ultima_posicao || null;
      if (position && valid(position.latitude, position.longitude)) {
        const kind = isDriver() ? 'current' : 'vehicle';
        const label = isDriver() ? 'EU' : 'V';
        const popup = isDriver()
          ? popupSeguro('Sua última posição compartilhada', [vehicle.placa || '', position.registrada_em ? new Date(position.registrada_em).toLocaleString('pt-BR') : 'Horário não informado'])
          : popupSeguro(vehicle.placa, [vehicle.modelo || '', vehicle.status || 'Veículo']);
        addMarker(position.latitude, position.longitude, kind, label, popup);
      }
    });
    const points = state.markers.map(marker => marker.getLatLng());
    if (points.length && (fit || !state.hasFitted)) {
      state.map.fitBounds(L.latLngBounds(points).pad(0.18), { maxZoom: 14 });
      state.hasFitted = true;
    }
    $('#map-fit').disabled = !points.length;
  }

  async function loadVehicles() {
    const result = await apiTodasPaginas('/veiculos');
    const vehicles = result.dados || [];
    await Promise.all(vehicles.map(async vehicle => {
      try {
        const positions = await api(`/veiculos/${vehicle.id}/posicoes`);
        const latest = (positions.dados || [])[0];
        if (latest) vehicle.ultima_posicao = latest;
      } catch (_error) { /* Usuário sem permissão para consultar este veículo: mantém sem posição. */ }
    }));
    return vehicles;
  }
  async function loadAll() {
    feedback(isDriver() ? 'Atualizando suas entregas e sua posição compartilhada…' : 'Atualizando entregas e posições dos veículos…');
    const [deliveryResult, vehicles, routes] = await Promise.all([
      apiTodasPaginas('/entregas'),
      loadVehicles(),
      apiTodasPaginas('/rotas').catch(() => ({ dados: [] }))
    ]);
    state.deliveries = deliveryResult.dados || [];
    state.vehicles = vehicles;
    state.routes = routes.dados || [];
    if (isDriver() && !state.planned) {
      state.planned = state.routes.find(route => route.status === 'Em andamento') || state.routes.find(route => route.status === 'Planejada') || null;
    }
    if (state.planned?.entrega_ids?.length && !state.selectedIds.size) {
      state.planned.entrega_ids.forEach(id => state.selectedIds.add(Number(id)));
    }
    const openDeliveries = state.deliveries.filter(item => !['Entregue', 'Cancelada'].includes(item.status));
    const vehicleWithPosition = vehicles.find(item => item.ultima_posicao);
    $('#map-count-deliveries').textContent = openDeliveries.length;
    $('#map-count-vehicles').textContent = isDriver()
      ? (vehicleWithPosition ? 'Ativo' : (vehicles.length ? 'Sem posição' : 'Não vinculado'))
      : vehicles.filter(item => item.ultima_posicao).length;
    $('#map-count-stops').textContent = String(state.selectedIds.size);
    if (isDriver()) {
      const positionStatus = $('#driver-position-status');
      if (positionStatus) {
        positionStatus.hidden = false;
        positionStatus.textContent = vehicleWithPosition
          ? `Posição compartilhada: ${vehicleWithPosition.ultima_posicao.registrada_em ? new Date(vehicleWithPosition.ultima_posicao.registrada_em).toLocaleString('pt-BR') : 'registrada'}. Toque em “Compartilhar posição” para atualizar.`
          : (vehicles.length ? 'Sua posição ainda não foi compartilhada. Toque em “Compartilhar posição” para aparecer no mapa.' : 'Não há veículo vinculado à sua conta. Solicite ao gestor a vinculação de um veículo.');
      }
      if (state.planned) {
        $('#map-state-title').textContent = state.planned.status === 'Em andamento' ? 'Sua rota está em andamento' : 'Sua rota planejada';
        $('#map-state-subtitle').textContent = `${Number(state.planned.distancia_total_km || 0).toFixed(1)} km estimados · ${state.planned.tempo_estimado_min || 0} min`;
        $('#map-start').disabled = !driverApproved() || state.planned.status !== 'Planejada';
        $('#map-start').textContent = state.planned.status === 'Em andamento' ? 'Rota em andamento' : 'Iniciar rota';
      }
    }
    renderList();
    renderMap();
    await restorePlannedRoute();
    const withoutCoordinates = state.deliveries.filter(item => !['Entregue', 'Cancelada'].includes(item.status) && !hasDestination(item)).length;
    feedback(isDriver()
      ? `${state.deliveries.length} entrega(s) atribuída(s) à sua conta · ${vehicles.length ? 'veículo vinculado' : 'sem veículo vinculado'}.${withoutCoordinates ? ` ${withoutCoordinates} entrega(s) sem coordenadas não podem entrar na rota.` : ''}`
      : `${state.deliveries.length} entregas consultadas · ${vehicles.length} veículos cadastrados.${withoutCoordinates ? ` ${withoutCoordinates} entrega(s) sem coordenadas não podem entrar na rota.` : ''}`);
  }

  async function restorePlannedRoute() {
    if (!isDriver() || !state.planned || state.routeLayer) return;
    const route = state.planned;
    const ids = (route.entrega_ids || []).map(Number);
    const byId = new Map(state.deliveries.map(delivery => [Number(delivery.id), delivery]));
    const stops = ids.map(id => byId.get(id)).filter(hasDestination);
    const coordinates = [];
    if (valid(route.origem_latitude, route.origem_longitude)) coordinates.push(point(route.origem_latitude, route.origem_longitude));
    stops.forEach(delivery => coordinates.push(point(delivery.destino_latitude, delivery.destino_longitude)));
    if (coordinates.length > 1) await drawRoadRoute(coordinates);
  }

  function selectedIds() {
    return [...state.selectedIds];
  }
  function locate() {
    if (!navigator.geolocation) return Promise.reject(new Error('Este navegador não oferece geolocalização.'));
    return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(
      position => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, velocidade_kmh: position.coords.speed == null ? null : position.coords.speed * 3.6 }),
      () => reject(new Error('Não foi possível obter sua localização. Autorize o acesso e use uma conexão HTTPS.')),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 }
    ));
  }
  async function shareDriverPosition(position) {
    const vehicles = await apiTodasPaginas('/veiculos');
    const vehicle = (vehicles.dados || [])[0];
    if (!vehicle) throw new Error('Não há veículo vinculado ao seu cadastro. Solicite ao administrador a vinculação de um veículo.');
    await api(`/veiculos/${vehicle.id}/posicoes`, {
      method: 'POST',
      body: { latitude: position.latitude, longitude: position.longitude, velocidade_kmh: position.velocidade_kmh }
    });
    feedback('Sua posição foi compartilhada com a operação. Ela ficará disponível no mapa até uma nova atualização.');
    await loadAll();
  }
  async function drawRoadRoute(coords) {
    if (coords.length < 2) return;
    try {
      const joined = coords.map(coordsPair => `${coordsPair[1]},${coordsPair[0]}`).join(';');
      const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${joined}?overview=full&geometries=geojson`);
      if (!response.ok) throw new Error('Serviço de rota indisponível.');
      const data = await response.json();
      if (data.code !== 'Ok' || !data.routes?.length) throw new Error('Traçado viário não encontrado.');
      const line = data.routes[0].geometry.coordinates.map(coordsPair => [coordsPair[1], coordsPair[0]]);
      state.routeLayer = L.polyline(line, { color: '#f35b3f', weight: 5, opacity: 0.86 }).addTo(state.map);
    } catch (_error) {
      state.routeLayer = L.polyline(coords, { color: '#f35b3f', weight: 4, dashArray: '8 8' }).addTo(state.map);
      feedback('O serviço de traçado viário está indisponível; exibindo uma ligação aproximada entre os pontos.');
    }
    state.map.fitBounds(state.routeLayer.getBounds().pad(0.15));
  }
  async function optimizeRoute() {
    if (!driverApproved()) throw new Error('Seu cadastro ainda está em análise. A otimização de rotas será liberada após a aprovação.');
    const ids = selectedIds();
    if (!ids.length) throw new Error('Selecione ao menos uma entrega com coordenadas de destino.');
    const selected = state.deliveries.filter(delivery => ids.includes(Number(delivery.id)));
    if (selected.some(delivery => !hasDestination(delivery))) throw new Error('Uma das entregas selecionadas não possui coordenadas de destino.');
    if (selected.some(delivery => !delivery.motorista_id)) throw new Error('Atribua um motorista às entregas antes de planejar uma rota.');
    const motoristas = [...new Set(selected.map(item => Number(item.motorista_id)))];
    if (motoristas.length !== 1) throw new Error('Selecione entregas de um mesmo motorista para otimizar uma rota.');
    const mode = $('#map-origin-mode').value;
    let origin;
    if (mode === 'mapa') {
      origin = state.manualOrigin;
      if (!origin) throw new Error('Clique no mapa para escolher o ponto de partida.');
    } else if (mode === 'localizacao') {
      origin = await locate();
    } else if (mode === 'motorista') {
      const vehicle = state.vehicles.find(item => Number(item.motorista_id) === motoristas[0] && item.ultima_posicao);
      const pos = vehicle?.ultima_posicao;
      if (!pos || !valid(pos.latitude, pos.longitude)) throw new Error('O motorista ainda não compartilhou uma posição válida. Selecione a origem da coleta ou sua localização.');
      origin = { latitude: Number(pos.latitude), longitude: Number(pos.longitude) };
    } else {
      const coleta = selected.find(delivery => valid(delivery.origem_latitude, delivery.origem_longitude));
      if (!coleta) throw new Error('As entregas selecionadas não têm coordenadas de coleta. Escolha outra origem ou clique no mapa.');
      origin = { latitude: Number(coleta.origem_latitude), longitude: Number(coleta.origem_longitude) };
    }
    // Otimizar não implica em publicar a localização do usuário. O compartilhamento exige ação própria.

    const result = await api('/rotas/otimizar', { method: 'POST', body: { entrega_ids: ids, origem: { latitude: origin.latitude, longitude: origin.longitude }, velocidade_media_kmh: 30 } });
    state.planned = result.rota;
    state.selectedIds = new Set((result.rota.entrega_ids || []).map(Number));
    $('#map-count-stops').textContent = String((result.paradas || []).length);
    $('#map-start').disabled = false;
    $('#map-start').textContent = 'Iniciar rota';
    $('#map-state-title').textContent = isDriver() ? 'Sua rota foi otimizada' : 'Rota otimizada';
    $('#map-state-subtitle').textContent = `${Number(result.rota.distancia_total_km).toFixed(1)} km estimados · ${result.rota.tempo_estimado_min} min`;
    if (state.routeLayer) state.map.removeLayer(state.routeLayer);
    if (state.originMarker) state.map.removeLayer(state.originMarker);
    state.originMarker = L.marker(point(origin.latitude, origin.longitude), { icon: pin('origin', 'O') }).addTo(state.map).bindPopup('<strong>Origem da rota</strong>');
    const stops = (result.paradas || []).map(item => item.entrega).filter(hasDestination);
    const coordinates = [point(origin.latitude, origin.longitude), ...stops.map(item => point(item.destino_latitude, item.destino_longitude))];
    await drawRoadRoute(coordinates);
    renderList();
    feedback('Rota otimizada e salva. A distância e o tempo do sistema são estimativas; o traçado viário depende do serviço externo OSRM.');
  }
  async function startRoute() {
    if (!driverApproved()) throw new Error('Seu cadastro ainda está em análise. Aguarde a aprovação para iniciar uma rota.');
    if (!state.planned) throw new Error('Otimize uma rota antes de iniciá-la.');
    await api(`/rotas/${state.planned.id}/status`, { method: 'PATCH', body: { status: 'Em andamento' } });
    state.planned.status = 'Em andamento';
    $('#map-state-title').textContent = isDriver() ? 'Sua rota está em andamento' : 'Rota em andamento';
    $('#map-start').textContent = 'Rota em andamento';
    $('#map-start').disabled = true;
    feedback('Rota iniciada com sucesso. Abra “Como chegar” na próxima entrega para iniciar a navegação.');
  }
  async function init() {
    const host = $('#urbanlink-map');
    if (!host) return;
    if (!window.L) { feedback('Não foi possível carregar a biblioteca do mapa. Verifique sua conexão.'); return; }
    state.user = storedUser();
    try {
      const identity = await api('/auth/me');
      state.user = identity.usuario || state.user;
      if (state.user) {
        localStorage.setItem('urbanlink_usuario', JSON.stringify(state.user));
        sessionStorage.setItem('urbanlink_usuario', JSON.stringify(state.user));
      }
    } catch (_) { /* A proteção da página apresentará o fluxo de autenticação. */ }
    const locateButton = $('#map-locate');
    if (isDriver()) {
      if (locateButton) locateButton.textContent = 'Compartilhar posição';
      $('#map-optimize').textContent = 'Otimizar minha rota';
      $('#map-count-deliveries-label').textContent = 'Minhas entregas';
      $('#map-count-vehicles-label').textContent = 'Meu veículo';
      $('#map-intro-text').textContent = 'Veja somente os pedidos atribuídos a você, organize as paradas e compartilhe sua posição com a operação.';
      $('#map-delivery-list-title').textContent = 'Minhas entregas';
      $('#map-disclaimer').textContent = 'A posição é compartilhada somente quando você toca no botão. O mapa não acompanha seu deslocamento continuamente; atualize a posição quando necessário.';
      const vehicleLegend = $('.mapa-legenda .dot-vehicle');
      if (vehicleLegend?.parentElement) vehicleLegend.parentElement.lastChild.textContent = ' Sua posição';
      if (!driverApproved()) {
        $('#map-optimize').disabled = true;
        $('#map-start').disabled = true;
        if (locateButton) locateButton.textContent = 'Ver minha localização';
        const status = $('#driver-position-status');
        if (status) status.textContent = 'Seu cadastro está em análise. Você pode consultar as entregas no mapa; compartilhar posição e iniciar rotas serão liberados após a aprovação.';
      }
    }
    state.map = L.map(host, { zoomControl: true, scrollWheelZoom: false }).setView([-22.9068, -43.1729], 11);
    const streets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(state.map);
    const detail = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap, HOT' });
    L.control.layers({ 'Mapa de ruas': streets, 'Mapa detalhado': detail }, null, { position: 'topright' }).addTo(state.map);
    L.control.scale({ imperial: false }).addTo(state.map);
    state.map.on('click', event => {
      if ($('#map-origin-mode').value !== 'mapa') return;
      state.manualOrigin = { latitude: event.latlng.lat, longitude: event.latlng.lng };
      if (state.originMarker) state.map.removeLayer(state.originMarker);
      state.originMarker = L.marker(event.latlng, { icon: pin('origin', 'O') }).addTo(state.map)
        .bindPopup(popupSeguro('Origem escolhida no mapa')).openPopup();
      feedback('Ponto de partida definido. Selecione as entregas e clique em Otimizar rota.');
    });

    $('#map-fix-auto')?.addEventListener('click', () => repairLocation(true));
    $('#map-fix-form')?.addEventListener('submit', event=>{event.preventDefault();repairLocation(false);});
    $('#map-fix-close')?.addEventListener('click',()=>$('#map-fix-location').close());
    $('#map-fix-cancel')?.addEventListener('click',()=>$('#map-fix-location').close());
    $('#map-select-eligible')?.addEventListener('click',()=>{
      const eligible=filteredDeliveries().filter(d=>hasDestination(d)&&d.motorista_id&&!['Entregue','Cancelada'].includes(d.status));
      if(!eligible.length){feedback('Não há pedidos elegíveis. Verifique motorista, status e coordenadas.');return;}
      const firstDriver=Number(eligible[0].motorista_id);
      const items=eligible.filter(d=>Number(d.motorista_id)===firstDriver);
      state.selectedIds=new Set(items.map(d=>Number(d.id)));
      $('#map-count-stops').textContent=String(state.selectedIds.size);
      renderList();feedback(`${items.length} entrega(s) do mesmo motorista selecionada(s). Escolha a origem e otimize.`);
    });
    $('#map-search').addEventListener('input', () => { renderList(); renderMap(false); });
    $('#map-status').addEventListener('change', () => { renderList(); renderMap(false); });
    $('#map-refresh').addEventListener('click', () => loadAll().catch(error => feedback(error.message)));
    $('#map-fit').addEventListener('click', () => { const points = state.markers.map(marker => marker.getLatLng()); if (points.length) state.map.fitBounds(L.latLngBounds(points).pad(0.18), { maxZoom: 15 }); });
    $('#map-clear').addEventListener('click', () => {
      state.planned = null; state.selectedIds.clear(); $('#map-count-stops').textContent = '0'; $('#map-start').disabled = true; $('#map-start').textContent = 'Iniciar rota';
      if (state.routeLayer) state.map.removeLayer(state.routeLayer);
      if (state.originMarker) state.map.removeLayer(state.originMarker);
      state.routeLayer = null; state.originMarker = null; state.manualOrigin = null; renderList(); feedback('Seleção de rota limpa.');
    });
    $('#map-fullscreen')?.addEventListener('click', async () => {
      try {
        if (document.fullscreenElement === host) await document.exitFullscreen();
        else if (host.requestFullscreen) await host.requestFullscreen();
        setTimeout(() => state.map.invalidateSize(), 120);
      } catch (error) { feedback('Seu navegador não permitiu abrir o mapa em tela cheia.'); }
    });
    document.addEventListener('fullscreenchange', () => {
      const full = document.fullscreenElement === host;
      const control = $('#map-fullscreen');
      if (control) control.textContent = full ? 'Sair da tela cheia' : 'Tela cheia';
      state.map.invalidateSize();
    });
    $('#map-origin-mode')?.addEventListener('change', () => {
      if ($('#map-origin-mode').value === 'mapa') feedback('Clique em um ponto no mapa para definir a origem da próxima rota.');
    });
    locateButton.addEventListener('click', async () => {
      try {
        const position = await locate();
        if (state.user?.perfil === 'Motorista' && driverApproved()) await shareDriverPosition(position);
        else {
          state.map.setView(point(position.latitude, position.longitude), 15);
          if (state.originMarker) state.map.removeLayer(state.originMarker);
          state.originMarker = L.marker(point(position.latitude, position.longitude), { icon: pin('origin', '•') }).addTo(state.map).bindPopup('<strong>Sua localização</strong>');
          feedback(state.user?.perfil === 'Motorista' ? 'Sua localização foi exibida somente neste navegador. O compartilhamento será liberado após a aprovação.' : 'Sua localização foi exibida no mapa.');
        }
      } catch (error) { feedback(error.message); }
    });
    $('#map-optimize').addEventListener('click', async event => {
      event.currentTarget.disabled = true;
      try { await optimizeRoute(); } catch (error) { feedback(error.message); }
      finally { event.currentTarget.disabled = false; }
    });
    $('#map-start').addEventListener('click', async event => {
      event.currentTarget.disabled = true;
      try { await startRoute(); } catch (error) { feedback(error.message); event.currentTarget.disabled = false; }
    });
    await loadAll();
    setTimeout(() => state.map.invalidateSize(), 250);
  }
  document.addEventListener('DOMContentLoaded', () => init().catch(error => feedback(error.message)));
})();