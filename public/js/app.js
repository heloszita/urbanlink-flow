(() => {
  'use strict';

  const API = '/api';
  const TOKEN_KEY = 'urbanlink_token';
  const USER_KEY = 'urbanlink_usuario';
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  function token() { return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || ''; }
  function storedUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY) || 'null'); }
    catch { return null; }
  }
  function saveSession(payload, remember) {
    const store = remember ? localStorage : sessionStorage;
    const other = remember ? sessionStorage : localStorage;
    store.setItem(TOKEN_KEY, payload.token);
    store.setItem(USER_KEY, JSON.stringify(payload.usuario));
    other.removeItem(TOKEN_KEY);
    other.removeItem(USER_KEY);
  }
  function clearSession() {
    [localStorage, sessionStorage].forEach(s => { s.removeItem(TOKEN_KEY); s.removeItem(USER_KEY); });
  }

  async function request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    if (token() && options.auth !== false) headers.Authorization = `Bearer ${token()}`;
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers,
      body: options.body && !(options.body instanceof FormData) ? JSON.stringify(options.body) : options.body
    });
    const type = response.headers.get('content-type') || '';
    const result = type.includes('application/json') ? await response.json() : await response.text();
    if (!response.ok) {
      const message = result && result.mensagem ? result.mensagem : `Não foi possível concluir a solicitação (${response.status}).`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    return result;
  }

  async function requestTodasPaginas(path) {
    const divisor = path.includes('?') ? '&' : '?';
    const dados = [];
    let pagina = 1;
    let totalPaginas = 1;
    do {
      const resultado = await request(`${path}${divisor}limite=100&pagina=${pagina}`);
      dados.push(...(resultado.dados || []));
      totalPaginas = Number(resultado.totalPaginas) || 1;
      pagina++;
      if (pagina > 100 && pagina <= totalPaginas) {
        throw new Error('A listagem ultrapassa 10.000 registros. Refine a consulta ou implemente paginação visual.');
      }
    } while (pagina <= totalPaginas);
    return { dados, total: dados.length };
  }

  function message(text, kind = 'info', target) {
    const node = document.createElement('div');
    node.className = `mensagem-app ${kind}`;
    node.setAttribute('role', kind === 'erro' ? 'alert' : 'status');
    node.textContent = text;
    const host = target || $('main') || $('form') || document.body;
    host.prepend(node);
    return node;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }
  function safeDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR');
  }
  function val(id) { return $(`#${id}`)?.value?.trim() || ''; }
  function num(id) {
    const v = val(id);
    return v === '' ? null : Number(v);
  }
  function statusBadge(status) {
    const badge = el('span', 'badge-status', status || '—');
    badge.dataset.status = status || '';
    return badge;
  }
  function gotoProfile(profile) {
    const map = { Cliente: 'inicial-cliente.html', Motorista: 'inicial-motorista.html', Administrador: 'inicial-admin.html', Gestor: 'inicial-admin.html' };
    window.location.href = map[profile] || 'index.html';
  }
  function isManager(profile) { return profile === 'Administrador' || profile === 'Gestor'; }

  async function protectPage() {
    const page = document.body.dataset.page || '';
    const required = (document.body.dataset.role || '').split(',').filter(Boolean);
    if (!required.length) return null;
    if (!token()) {
      window.location.replace(page.includes('dashboard') || page.includes('delivery') || page.includes('support') || page.includes('route') || page.includes('admin') || page === 'tracking'
        ? (required[0] === 'Motorista' ? 'login-motorista.html' : required[0] === 'Administrador' ? 'login-adm.html' : 'login.html')
        : 'index.html');
      return null;
    }
    try {
      const data = await request('/auth/me');
      const user = data.usuario;
      if (!required.includes(user.perfil) && !(required.includes('Administrador') && user.perfil === 'Gestor')) {
        message('Seu perfil não tem permissão para acessar esta tela. Você será direcionado ao painel correto.', 'erro');
        setTimeout(() => gotoProfile(user.perfil), 1200);
        return null;
      }
      if (user.perfil === 'Motorista' && user.aprovado === false &&
          !['vehicle-registration', 'driver-dashboard', 'support', 'manage-deliveries', 'driver-route'].includes(page)) {
        message('Seu cadastro de motorista ainda aguarda aprovação do gestor.', 'info');
        setTimeout(() => gotoProfile(user.perfil), 1200);
        return null;
      }
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      sessionStorage.setItem(USER_KEY, JSON.stringify(user));
      $$('.perfil-usuario span').forEach(s => { s.textContent = `Bem-vindo(a), ${user.nome}`; });
      adjustNavigation(user);
      updateFooterSupportLink(user);
      return user;
    } catch (error) {
      clearSession();
      if (error.status === 401) {
        window.location.replace('login.html');
        return null;
      }
      message(error.message, 'erro');
      return null;
    }
  }


  function adjustNavigation(user) {
    if (!user) return;
    const manager = isManager(user.perfil);
    const menus = {
      gestor: [
        ['Início', 'inicial-admin.html'],
        ['Gestão de entregas', 'entrega-motorista.html'],
        ['Mapa e rotas', 'mapa-rotas.html'],
        ['Simulações', 'simulacoes.html'],
        ['Mensagens', 'admin-mensagens.html'],
      ],
      motorista: [
        ['Início', 'inicial-motorista.html'],
        ['Entregas', 'entrega-motorista.html'],
        ['Mapa e rotas', 'mapa-rotas.html'],
        ['Atendimento', 'atendimento-motorista.html']
      ],
      cliente: [
        ['Início', 'inicial-cliente.html'],
        ['Acompanhamento', 'acompanhamento.html'],
        ['Atendimento', 'atendimento-cliente.html'],
        ['Patrocinadores', 'patrocinadores.html']
      ]
    };
    const menu = manager ? menus.gestor : user.perfil === 'Motorista' ? menus.motorista : menus.cliente;
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    $$('.navegacao-topo').forEach(nav => {
      nav.replaceChildren();
      menu.forEach(([label, href]) => {
        const link = document.createElement('a');
        link.href = href;
        link.textContent = label;
        if (currentPage === href) {
          link.classList.add('ativo');
          link.setAttribute('aria-current', 'page');
        }
        nav.append(link);
      });
    });
  }

  // Remove a preferência obsoleta do navegador; o site usa somente o tema claro.
  function clearLegacyThemePreference() {
    try { localStorage.removeItem('urbanlink_tema'); sessionStorage.removeItem('urbanlink_tema'); document.documentElement.removeAttribute('data-theme'); } catch (_) { /* Armazenamento indisponível. */ }
  }

  function setupProfileLogout() {
    $$('.perfil-usuario').forEach(profile => {
      if (profile.dataset.logoutReady === 'true') return;
      profile.dataset.logoutReady = 'true';
      const holder = el('div', 'perfil-conta');
      profile.parentNode.insertBefore(holder, profile);
      holder.append(profile);
      profile.setAttribute('role', 'button');
      profile.setAttribute('tabindex', '0');
      profile.setAttribute('title', 'Abrir opções da conta');
      profile.setAttribute('aria-label', 'Abrir opções da conta');
      profile.setAttribute('aria-haspopup', 'true');
      profile.setAttribute('aria-expanded', 'false');
      const menu = el('div', 'menu-perfil');
      menu.hidden = true;
      menu.id = `menu-perfil-${Math.random().toString(36).slice(2, 9)}`;
      profile.setAttribute('aria-controls', menu.id);
      const logout = el('button', 'menu-logout', '↪  Sair da conta');
      logout.type = 'button';
      logout.addEventListener('click', event => {
        event.stopPropagation();
        clearSession();
        window.location.replace('index.html');
      });
      menu.append(logout); holder.append(menu);
      const open = value => { menu.hidden = !value; profile.setAttribute('aria-expanded', String(value)); if (value) logout.focus(); };
      profile.addEventListener('click', () => open(menu.hidden));
      profile.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(menu.hidden); }
        if (event.key === 'Escape') open(false);
      });
      document.addEventListener('click', event => { if (!holder.contains(event.target)) open(false); });
      document.addEventListener('keydown', event => { if (event.key === 'Escape' && !menu.hidden) { open(false); profile.focus(); } });
    });
  }

  function supportHrefFor(profile) {
    if (profile === 'Motorista') return 'atendimento-motorista.html';
    if (profile === 'Administrador' || profile === 'Gestor') return 'admin-mensagens.html';
    return 'atendimento-cliente.html';
  }

  function updateFooterSupportLink(user) {
    const support = document.querySelector('.urbanlink-footer [data-footer-support], .rodape-global [data-footer-support]');
    if (!support) return;
    support.href = supportHrefFor(user?.perfil || storedUser()?.perfil);
  }

  function ensureGlobalFooter() {
    if (document.querySelector('.rodape, .rodape-global, .urbanlink-footer')) return;
    const footer = el('footer', 'rodape-global');
    footer.innerHTML = `
      <div class="rodape-global__brand">
        <strong>UrbanLink Systems</strong>
        <span>Plataforma de logística urbana, monitoramento e simulação de entregas.</span>
      </div>
      <div class="rodape-global__links">
        <a href="https://www.instagram.com/urban.linkflow?lqvp=MWJ2cnIydzhmMDBlNw==" target="_blank" rel="noopener noreferrer">Instagram</a>
        <a href="#" data-aviso="A política de privacidade ainda não está publicada nesta versão demonstrativa.">Privacidade</a>
        <a href="#" data-aviso="Os termos de uso ainda não estão publicados nesta versão demonstrativa.">Termos de uso</a>
        <a href="${supportHrefFor(storedUser()?.perfil)}" data-footer-support>Suporte</a>
      </div>
    `;
    (document.querySelector('main')?.after(footer)) || document.body.append(footer);
  }

  function driverRegistrationConfirmation() {
    const dialog = el('dialog', 'auth-confirm-dialog');
    const content = el('div', 'auth-confirm-content');
    const icon = el('div', 'auth-confirm-icon', '✓'); icon.setAttribute('aria-hidden', 'true');
    const title = el('h2', '', 'Sua conta está em análise!');
    const body = el('p', '', 'Recebemos seus dados e o documento da CNH. O administrador irá avaliar seu cadastro antes de liberar as entregas.');
    const next = el('p', '', 'Próximo passo: cadastre os dados do veículo para concluir sua inscrição. Você poderá acompanhar o status no painel.');
    const button = el('a', 'botao botao-primario', 'Continuar para o cadastro do veículo');
    button.href = 'info-motorista.html';
    content.append(icon, title, body, next, button);
    dialog.append(content); document.body.append(dialog);
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else { dialog.setAttribute('open', ''); dialog.scrollIntoView(); }
  }

  async function visualizarDocumentoCnh(motorista) {
    const response = await fetch(`${API}/usuarios/${motorista.id}/cnh`, {
      headers: { Authorization: `Bearer ${token()}` }, cache: 'no-store'
    });
    if (!response.ok) {
      const erro = await response.json().catch(() => ({}));
      throw new Error(erro.mensagem || 'Não foi possível visualizar a CNH.');
    }
    const contentType = response.headers.get('content-type') || '';
    if (!/^(?:image\/(?:jpeg|png|webp)|application\/pdf)(?:;|$)/i.test(contentType)) throw new Error('Formato de CNH não suportado.');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const dialog = el('dialog', 'cnh-viewer');
    const header = el('div', 'cnh-viewer-header');
    const title = el('strong', '', `CNH • ${motorista.nome}`);
    const close = el('button', '', '×'); close.type = 'button'; close.setAttribute('aria-label', 'Fechar documento');
    header.append(title, close);
    const preview = el('div', 'cnh-viewer-preview');
    const isPdf = contentType.toLowerCase().includes('pdf');
    const viewer = document.createElement(isPdf ? 'iframe' : 'img');
    viewer.src = url;
    if (isPdf) viewer.title = `Documento da CNH de ${motorista.nome}`;
    else viewer.alt = `Documento da CNH de ${motorista.nome}`;
    preview.append(viewer);
    const footer = el('div', 'cnh-viewer-footer');
    const download = el('a', 'botao botao-primario', 'Baixar documento');
    download.href = url;
    download.download = `cnh-motorista-${motorista.id}.${isPdf ? 'pdf' : contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'}`;
    footer.append(download);
    dialog.append(header, preview, footer); document.body.append(dialog);
    const cleanup = () => { URL.revokeObjectURL(url); dialog.remove(); };
    dialog.addEventListener('close', cleanup, { once: true });
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  function formData(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  async function loginPage() {
    const form = $('#form-login');
    if (!form) return;
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const configuredRole = document.body.dataset.role || '';
      const expected = configuredRole && configuredRole !== 'Todos' ? configuredRole : '';
      if (!val('email-login') || !val('senha-login')) return message('Informe e-mail e senha.', 'erro', form);
      const button = $('button[type="submit"]', form);
      if (button) button.disabled = true;
      try {
        const result = await request('/auth/login', {
          method: 'POST',
          auth: false,
          body: { email: val('email-login'), senha: val('senha-login'), ...(expected ? { perfil: expected } : {}) }
        });
        saveSession(result, $('#lembrar')?.checked === true);
        gotoProfile(result.usuario.perfil);
      } catch (error) {
        message(error.message, 'erro', form);
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  async function cadastroPage() {
    const form = $('#form-cadastro');
    if (!form) return;
    const cnhFileInput = $('#upload-cnh');
    const cnhFileName = $('#upload-cnh-nome');
    cnhFileInput?.addEventListener('change', () => {
      const file = cnhFileInput.files?.[0];
      if (cnhFileName) cnhFileName.textContent = file ? `Arquivo selecionado: ${file.name}` : 'Obrigatório para criar a conta. JPG, PNG, WEBP ou PDF, até 1 MB.';
      if (!file) return;
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      if (!allowed.includes(file.type)) {
        cnhFileInput.value = '';
        if (cnhFileName) cnhFileName.textContent = 'Formato inválido. Selecione JPG, PNG, WEBP ou PDF.';
        message('Use um arquivo JPG, PNG, WEBP ou PDF para a CNH.', 'erro', form);
      } else if (file.size > 1024 * 1024) {
        cnhFileInput.value = '';
        if (cnhFileName) cnhFileName.textContent = 'Arquivo acima de 1 MB. Selecione outro documento.';
        message('O arquivo da CNH deve ter até 1 MB.', 'erro', form);
      }
    });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const password = val('senha'), confirmation = val('confirmar-senha');
      if (password !== confirmation) return message('As senhas informadas não coincidem.', 'erro', form);
      if (!$('#termos')?.checked) return message('É necessário aceitar os termos para continuar.', 'erro', form);
      const profile = document.body.dataset.role || 'Cliente';
      const cpf = val('cpf') || val('cpf-cnpj');
      const cnpj = val('cnpj');
      const body = {
        nome: val('nome'),
        email: val('email'),
        senha: password,
        perfil: profile,
        cpf_cnpj: cpf || cnpj,
        telefone: val('celular'),
        cep: val('cep'),
        cnh: val('cnh'),
        codigo_convite: val('codigo-convite')
      };
      if (profile === 'Motorista') {
        const file = cnhFileInput?.files?.[0];
        if (!file) return message('Anexe a foto ou o PDF da CNH antes de criar sua conta.', 'erro', form);
        if (file.size > 1024 * 1024) return message('O arquivo da CNH deve ter até 1 MB.', 'erro', form);
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (!allowed.includes(file.type)) return message('Use um arquivo JPG, PNG, WEBP ou PDF para a CNH.', 'erro', form);
        try {
          body.documento_cnh = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Não foi possível ler o arquivo da CNH. Selecione-o novamente.'));
            reader.readAsDataURL(file);
          });
        } catch (error) {
          return message(error.message, 'erro', form);
        }
      }
      const button = $('button[type="submit"]', form);
      if (button) button.disabled = true;
      try {
        const result = await request('/auth/cadastro', { method: 'POST', auth: false, body });
        saveSession(result, true);
        if (profile === 'Motorista') driverRegistrationConfirmation();
        else gotoProfile(result.usuario.perfil);
      } catch (error) {
        message(error.message, 'erro', form);
      } finally { if (button) button.disabled = false; }
    });
  }

  async function vehicleRegistrationPage(user) {
    const form = $('#form-veiculo');
    if (!form) return;
    if (user?.aprovado === false) {
      message('Sua CNH já foi anexada ao criar a conta. Informe os dados do veículo para concluir a inscrição. Seu perfil ficará pendente até a análise do administrador.', 'info', form);
    }
    form.addEventListener('submit', async event => {
      event.preventDefault();
      // Limpa mensagens de falhas anteriores sem ocultar o aviso de análise da CNH.
      $$('.mensagem-app.erro', form).forEach(aviso => aviso.remove());
      const tipo = val('tipo-veiculo');
      if (!['Moto', 'Carro', 'Van', 'Caminhão', 'Elétrico'].includes(tipo)) {
        return message('Tipo de veículo inválido. Selecione uma das opções disponíveis.', 'erro', form);
      }
      const button = $('button[type="submit"]', form);
      if (button) button.disabled = true;
      try {
        const body = {
          modelo: val('modelo'), placa: val('placa'), cor: val('cor'), ano: num('ano'),
          tipo, capacidade_kg: num('capacidade') ?? 0,
          capacidade_tanque_l: num('tanque'), volume_m3: num('volume-m3')
        };
        const result = await request('/veiculos/me', { method: 'POST', body });
        message(`${result.mensagem || 'Veículo cadastrado.'} Seu cadastro continuará pendente até a análise do administrador.`, 'sucesso', form);
        setTimeout(() => { window.location.href = 'inicial-motorista.html'; }, 1800);
      } catch (error) {
        message(error.message, 'erro', form);
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  async function carregarPerfil() {
    try {
      const { usuario } = await request('/usuarios/me');
      $$('.perfil-usuario span').forEach(s => { s.textContent = `Bem-vindo(a), ${usuario.nome}`; });
      return usuario;
    } catch { return storedUser(); }
  }

  async function carregarDashboardCliente() {
    const [summary, deliveries] = await Promise.all([request('/dashboard/resumo'), request('/entregas')]);
    const rows = deliveries.dados || [];
    const metricCards = $$('.cartao-info');
    if (metricCards[0]) {
      const p = $('.numero-cartao', metricCards[0]) || $('.numero-metrica', metricCards[0]);
      if (p) p.textContent = String(summary.em_andamento);
    }
    if (metricCards[1]) {
      const p = $('.numero-cartao', metricCards[1]) || $('.numero-metrica', metricCards[1]);
      if (p) p.textContent = String(summary.entregues);
    }
    const tbody = $('.tabela-pedidos tbody');
    if (tbody) {
      tbody.replaceChildren();
      rows.slice(0, 8).forEach(item => {
        const tr = document.createElement('tr');
        [item.codigo, item.destinatario_nome, item.destino].forEach(value => tr.append(el('td','',value)));
        const statusCell = el('td'); statusCell.append(statusBadge(item.status)); tr.append(statusCell);
        const actionCell = el('td');
        const link = el('a','link-acao','Acompanhar');
        link.href = `acompanhamento.html?codigo=${encodeURIComponent(item.codigo)}`;
        actionCell.append(link); tr.append(actionCell);
        tbody.append(tr);
      });
      if (!rows.length) {
        const tr = el('tr'); const td = el('td','estado-vazio','Você ainda não tem entregas cadastradas.');
        td.colSpan = 5; tr.append(td); tbody.append(tr);
      }
    }
    const next = rows.find(item => !['Entregue','Cancelada'].includes(item.status));
    const nextCard = $('.cartao-proxima-entrega');
    if (nextCard) {
      const heading = $('.destaque-hora', nextCard);
      const sub = $('.subtexto-cartao', nextCard);
      const code = $('.codigo-rota', nextCard);
      const badge = $('.cabecalho-rota .badge', nextCard);
      const driver = $('.nome-motorista', nextCard);
      const vehicle = $('.veiculo-motorista', nextCard);
      const details = $('.detalhes-em-rota h3', nextCard);
      const progress = $('.progresso-preenchido', nextCard);
      const track = $('#cliente-ver-rastreamento');
      if (next) {
        if (heading) heading.textContent = next.janela_fim ? `Até ${next.janela_fim}` : next.status;
        if (sub) sub.textContent = `Pedido ${next.codigo}`;
        if (code) code.textContent = next.codigo;
        if (badge) { badge.textContent = next.status; badge.dataset.status = next.status; }
        if (driver) driver.textContent = next.motorista?.nome || 'Motorista ainda não atribuído';
        if (vehicle) vehicle.textContent = next.veiculo ? `${next.veiculo.tipo} • ${next.veiculo.placa}` : 'Veículo não atribuído';
        if (details) details.textContent = next.destino;
        if (progress) progress.style.width = next.status === 'Entregue' ? '100%' : '0%';
        if (track) {
          track.disabled = false;
          track.onclick = () => { window.location.href = `acompanhamento.html?codigo=${encodeURIComponent(next.codigo)}`; };
        }
      } else {
        if (heading) heading.textContent = 'Nenhuma entrega ativa';
        if (sub) sub.textContent = 'Crie uma nova solicitação para acompanhar uma entrega.';
        if (code) code.textContent = '—';
        if (badge) { badge.textContent = 'Sem entrega ativa'; badge.dataset.status = ''; }
        if (driver) driver.textContent = 'Não atribuído';
        if (vehicle) vehicle.textContent = 'Não atribuído';
        if (details) details.textContent = 'Aguardando nova solicitação';
        if (progress) progress.style.width = '0%';
        if (track) track.disabled = true;
      }
    }
    const supportButton = $('[data-action="suporte"]');
    if (supportButton) supportButton.addEventListener('click', () => window.location.href = 'atendimento-cliente.html');
    const searchForm = $('#form-rastreio-painel');
    if (searchForm) searchForm.addEventListener('submit', e => {
      e.preventDefault();
      const code = val('codigo-rastreio-painel');
      if (code) window.location.href = `acompanhamento.html?codigo=${encodeURIComponent(code)}`;
    });
    const latestLink = $('.link-ver-todos');
    if (latestLink) {
      if (rows[0]) {
        latestLink.href = `acompanhamento.html?codigo=${encodeURIComponent(rows[0].codigo)}`;
        latestLink.textContent = 'Acompanhar última entrega →';
      } else {
        latestLink.href = 'entrega-cliente.html';
        latestLink.textContent = 'Criar sua primeira entrega →';
      }
    }
  }


  /** Consulta opcional para verificar o endereço; criação geocodifica no servidor mesmo sem clicar. */
  function configurarLocalizacaoDestino(form, campos) {
    const botao = $(`#${campos.botao}`, form);
    const aviso = $(`#${campos.aviso}`, form);
    const mapa = $(`#${campos.mapa}`, form);
    const latitude = $(`#${campos.latitude}`, form);
    const longitude = $(`#${campos.longitude}`, form);
    let preenchidoAutomaticamente = false;
    const enderecoAtual = () => ({
      destino: val(campos.destino),
      bairro: campos.bairro ? val(campos.bairro) : '',
      cidade: campos.cidade ? val(campos.cidade) : '',
      uf: campos.uf ? val(campos.uf) : '',
      cep_entrega: campos.cep ? val(campos.cep) : ''
    });
    const avisar = (mensagem, estado = 'aguardando') => {
      if (aviso) {
        aviso.textContent = mensagem;
        aviso.dataset.estado = estado;
      }
    };
    [campos.destino, campos.bairro, campos.cidade, campos.uf, campos.cep].filter(Boolean).forEach(id => {
      $(`#${id}`, form)?.addEventListener('input', () => {
        if (preenchidoAutomaticamente) {
          if (latitude) latitude.value = '';
          if (longitude) longitude.value = '';
          preenchidoAutomaticamente = false;
        }
        if (mapa) mapa.hidden = true;
        avisar('O endereço foi alterado. A localização será atualizada ao enviar a entrega.');
      });
    });
    [latitude, longitude].forEach(input => input?.addEventListener('input', () => {
      preenchidoAutomaticamente = false;
      if (mapa) mapa.hidden = true;
      avisar('Coordenadas manuais: confira se latitude e longitude correspondem ao endereço.', 'aguardando');
    }));
    botao?.addEventListener('click', async () => {
      botao.disabled = true;
      botao.textContent = 'Localizando…';
      avisar('Pesquisando endereço no mapa…', 'aguardando');
      try {
        const { localizacao } = await request('/geocodificar', { method: 'POST', body: enderecoAtual() });
        if (localizacao && Number.isFinite(Number(localizacao.latitude)) &&
            Number.isFinite(Number(localizacao.longitude)) && localizacao.latitude !== undefined && localizacao.longitude !== undefined) {
          if (latitude) latitude.value = String(localizacao.latitude);
          if (longitude) longitude.value = String(localizacao.longitude);
          preenchidoAutomaticamente = true;
          if (mapa) {
            const lat = Number(localizacao.latitude);
            const lon = Number(localizacao.longitude);
            mapa.href = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`;
            mapa.hidden = false;
          }
          avisar(localizacao.mensagem || 'Endereço localizado.', localizacao.status);
        } else {
          if (preenchidoAutomaticamente) {
            if (latitude) latitude.value = '';
            if (longitude) longitude.value = '';
          }
          preenchidoAutomaticamente = false;
          if (mapa) mapa.hidden = true;
          avisar(localizacao?.mensagem || 'Não foi possível localizar o endereço.', 'erro');
        }
      } catch (error) {
        avisar(error.message || 'Não foi possível consultar o serviço de localização.', 'erro');
      } finally {
        botao.disabled = false;
        botao.textContent = 'Localizar endereço';
      }
    });
  }

  async function customerDeliveryPage(user) {
    const form = $('#form-nova-entrega');
    if (!form) return;
    configurarLocalizacaoDestino(form, { botao: 'cliente-verificar-endereco', aviso: 'cliente-geo-feedback', mapa: 'cliente-geo-preview', destino: 'destino', bairro: 'bairro', cidade: 'cidade', uf: 'uf', cep: 'cep_entrega', latitude: 'destino-latitude', longitude: 'destino-longitude' });
    const vehicleButtons = $$('.botao-seletor', form);
    let chosenVehicle = $('.botao-seletor.ativo', form)?.dataset.veiculo || 'Moto';
    vehicleButtons.forEach(button => {
      button.addEventListener('click', () => {
        vehicleButtons.forEach(b => b.classList.toggle('ativo', b === button));
        chosenVehicle = button.dataset.veiculo || button.textContent.trim();
      });
    });
    const radios = $$('input[name="coleta"]', form);
    const otherOrigin = $('#coleta-outro-campo');
    radios.forEach(radio => radio.addEventListener('change', () => {
      if (otherOrigin) otherOrigin.hidden = !($('#coleta-outro')?.checked);
    }));
    $('#coleta-outro-campo')?.querySelector('input')?.addEventListener('input', e => {
      e.target.required = $('#coleta-outro')?.checked === true;
    });
    const profile = user || await carregarPerfil();
    const defaultPickup = profile?.endereco_coleta || 'Centro de distribuição';
    const summary = $('.area-resumo');
    const pickupText = $('.opcoes-radio .caixa-radio:first-child p');
    if (pickupText) pickupText.textContent = defaultPickup;
    const summaryLines = summary ? $$('.item-resumo p', summary) : [];
    if (summaryLines[0]) summaryLines[0].textContent = defaultPickup;
    if (summaryLines[1]) summaryLines[1].textContent = 'Endereço de entrega';
    if (summaryLines[2]) summaryLines[2].textContent = chosenVehicle;
    vehicleButtons.forEach(button => button.addEventListener('click', () => {
      if (summaryLines[2]) summaryLines[2].textContent = chosenVehicle;
    }));
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const other = $('#coleta-outro')?.checked === true;
      const origin = other ? val('origem') : defaultPickup;
      const body = {
        origem: origin,
        destinatario_nome: val('destinatario_nome') || profile?.nome,
        destinatario_telefone: val('destinatario_telefone'),
        cep_entrega: val('cep_entrega'),
        destino: val('destino'),
        bairro: val('bairro'),
        cidade: val('cidade'),
        uf: val('uf'),
        tipo_veiculo: chosenVehicle,
        tipo_carga: val('tipo-carga'),
        quantidade_volumes: num('quantidade-volumes') || 1,
        peso_kg: num('peso-kg'),
        volume_m3: num('volume-m3'),
        destino_latitude: num('destino-latitude'),
        destino_longitude: num('destino-longitude')
      };
      try {
        if ((body.destino_latitude === null) !== (body.destino_longitude === null)) {
          throw new Error('Preencha latitude e longitude juntas ou deixe os dois campos vazios.');
        }
        const result = await request('/entregas', { method: 'POST', body });
        const localizado = result.entrega.destino_latitude !== null && result.entrega.destino_latitude !== undefined &&
          result.entrega.destino_longitude !== null && result.entrega.destino_longitude !== undefined;
        const nota = localizado
          ? (result.localizacao?.status === 'aproximado' ? ' Destino localizado aproximadamente: confira o ponto antes de realizar a entrega.' : ' O destino já está disponível no mapa.')
          : ` O pedido foi salvo, mas ainda está sem ponto no mapa. ${result.localizacao?.mensagem || 'Confirme o endereço com a equipe de atendimento.'}`;
        const aviso = message(`${result.mensagem} Código: ${result.entrega.codigo}.${nota}`, localizado ? 'sucesso' : 'info', form);
        const link = el('a', 'geo-abrir-entrega', 'Acompanhar esta entrega');
        link.href = `acompanhamento.html?codigo=${encodeURIComponent(result.entrega.codigo)}`;
        aviso.append(link);
        if (localizado) setTimeout(() => { window.location.href = link.href; }, 2500);
      } catch (error) { message(error.message, 'erro', form); }
    });
    $('[data-action="cancelar"]',form)?.addEventListener('click', () => { window.location.href='inicial-cliente.html'; });
    if (summary) {
      const p = $('.item-resumo p',summary);
      if (p) p.textContent = defaultPickup;
    }
  }

  function renderTimeline(delivery) {
    const host = $('#eventos-rastreamento') || $('.lista-eventos') || $('.corpo-rastreamento');
    if (!host) return;
    host.replaceChildren();
    const events = delivery.eventos || [];
    if (!events.length) {
      const p = el('p','estado-vazio','Ainda não há atualizações registradas.');
      host.append(p); return;
    }
    const list = el('ul','lista-eventos');
    events.forEach(event => {
      const li = document.createElement('li');
      li.append(el('strong','',event.status), el('div','',event.descricao), el('small','',safeDate(event.createdAt)));
      list.append(li);
    });
    host.append(list);
  }

  async function trackingPage(user) {
    const form = $('#form-rastreamento');
    const input = $('#codigo-rastreamento');
    let clientMap = null;
    let clientMarkers = null;
    let clientRoute = null;
    let currentDelivery = null;

    const validMapPoint = (lat, lon) => lat !== null && lat !== undefined && lon !== null && lon !== undefined &&
      String(lat).trim() !== '' && String(lon).trim() !== '' && Number.isFinite(Number(lat)) && Number.isFinite(Number(lon)) &&
      Math.abs(Number(lat)) <= 90 && Math.abs(Number(lon)) <= 180;

    async function updateClientMap(delivery) {
      const host = $('#mapa-cliente');
      const status = $('#cliente-mapa-status');
      const refresh = $('#cliente-mapa-atualizar');
      const fitButton = $('#cliente-mapa-ajustar');
      const navigateButton = $('#cliente-mapa-navegar');
      if (!host) return;
      if (!window.L) {
        if (status) status.textContent = 'Não foi possível carregar o mapa. Verifique sua conexão com a internet.';
        return;
      }
      if (!clientMap) {
        clientMap = L.map(host, { scrollWheelZoom: false }).setView([-22.9068, -43.1729], 11);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19, attribution: '&copy; OpenStreetMap'
        }).addTo(clientMap);
        clientMarkers = L.layerGroup().addTo(clientMap);
        L.control.scale({ imperial: false }).addTo(clientMap);
        clientMap.getContainer().setAttribute('title', 'Use os controles de zoom ou o botão Ver trajeto para navegar pelo mapa');
      }
      if (refresh) refresh.disabled = true;
      if (fitButton) fitButton.disabled = true;
      if (status) status.textContent = 'Atualizando os pontos da entrega…';
      clientMarkers.clearLayers();
      if (clientRoute) { clientMap.removeLayer(clientRoute); clientRoute = null; }

      const points = [];
      const addClientMarker = (lat, lon, type, label, title, detail) => {
        const icon = L.divIcon({
          className: '', html: `<div class="marcador-cliente ${type}"><span>${label}</span></div>`,
          iconSize: [30, 30], iconAnchor: [15, 28], popupAnchor: [0, -25]
        });
        const popup = document.createElement('div');
        const strong = document.createElement('strong'); strong.textContent = title;
        const paragraph = document.createElement('p'); paragraph.textContent = detail;
        popup.append(strong, paragraph);
        L.marker([Number(lat), Number(lon)], { icon }).bindPopup(popup).addTo(clientMarkers);
        points.push([Number(lat), Number(lon)]);
      };

      if (validMapPoint(delivery.origem_latitude, delivery.origem_longitude)) {
        addClientMarker(delivery.origem_latitude, delivery.origem_longitude, 'origem', 'O', 'Origem', delivery.origem || 'Ponto de coleta');
      }
      if (validMapPoint(delivery.destino_latitude, delivery.destino_longitude)) {
        addClientMarker(delivery.destino_latitude, delivery.destino_longitude, 'destino', 'D', 'Destino da entrega', delivery.destino || 'Destino');
      }

      let vehiclePosition = null;
      if (delivery.veiculo?.id) {
        try {
          const positions = await request(`/veiculos/${delivery.veiculo.id}/posicoes`);
          vehiclePosition = (positions.dados || []).find(position => validMapPoint(position.latitude, position.longitude)) || null;
          if (vehiclePosition) {
            const when = vehiclePosition.registrada_em ? safeDate(vehiclePosition.registrada_em) : 'Horário não informado';
            addClientMarker(vehiclePosition.latitude, vehiclePosition.longitude, 'motorista', 'M', 'Última posição compartilhada', `Registrada em ${when}. Não representa rastreamento contínuo.`);
          }
        } catch (_) {
          // O mapa continua mostrando origem e destino mesmo sem acesso ao histórico de posições.
        }
      }

      const destination = validMapPoint(delivery.destino_latitude, delivery.destino_longitude)
        ? [Number(delivery.destino_latitude), Number(delivery.destino_longitude)] : null;
      const routeOrigin = vehiclePosition && destination
        ? [Number(vehiclePosition.latitude), Number(vehiclePosition.longitude)]
        : validMapPoint(delivery.origem_latitude, delivery.origem_longitude) && destination
          ? [Number(delivery.origem_latitude), Number(delivery.origem_longitude)] : null;
      if (routeOrigin && destination) {
        try {
          const url = `https://router.project-osrm.org/route/v1/driving/${routeOrigin[1]},${routeOrigin[0]};${destination[1]},${destination[0]}?overview=full&geometries=geojson`;
          const response = await fetch(url);
          const data = await response.json();
          if (response.ok && data.code === 'Ok' && data.routes?.length) {
            const line = data.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon]);
            clientRoute = L.polyline(line, { color: '#f35b3f', weight: 5, opacity: .85 }).addTo(clientMap);
          }
        } catch (_) {
          // A ligação pontilhada abaixo mantém a referência visual caso o serviço externo falhe.
        }
        if (!clientRoute) clientRoute = L.polyline([routeOrigin, destination], { color: '#f35b3f', weight: 4, dashArray: '7 8', opacity: .8 }).addTo(clientMap);
      }

      if (navigateButton) {
        const hasDestination = Boolean(destination);
        navigateButton.hidden = !hasDestination;
        if (hasDestination) navigateButton.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${destination[0]},${destination[1]}`)}`;
      }
      if (fitButton) {
        fitButton.disabled = !points.length;
        fitButton.onclick = () => {
          if (points.length > 1) clientMap.fitBounds(L.latLngBounds(points).pad(.2), { maxZoom: 15 });
          else if (points.length) clientMap.setView(points[0], 15);
        };
      }
      if (points.length > 1) clientMap.fitBounds(L.latLngBounds(points).pad(.18), { maxZoom: 14 });
      else if (points.length === 1) clientMap.setView(points[0], 14);
      else clientMap.setView([-22.9068, -43.1729], 11);
      setTimeout(() => clientMap?.invalidateSize(), 100);
      if (status) {
        if (!destination) status.textContent = 'O destino desta entrega ainda não possui coordenadas cadastradas. O status e o histórico continuam disponíveis, mas o ponto não pode ser exibido no mapa.';
        else if (vehiclePosition) status.textContent = 'Mapa atualizado. O marcador azul mostra a última posição compartilhada pelo motorista, não a localização em tempo real.';
        else status.textContent = 'Origem e destino exibidos. A posição do motorista aparecerá quando ele compartilhar sua localização.';
      }
      if (refresh) refresh.disabled = false;
    }
    $('#cliente-mapa-atualizar')?.addEventListener('click', () => {
      if (currentDelivery) updateClientMap(currentDelivery).catch(error => {
        const status = $('#cliente-mapa-status'); if (status) status.textContent = error.message;
        const refresh = $('#cliente-mapa-atualizar'); if (refresh) refresh.disabled = false;
      });
    });
    const query = new URLSearchParams(window.location.search).get('codigo');
    if (query && input) input.value = query;
    const render = async code => {
      if (!code) throw new Error('Informe o código da entrega.');
      const email = user?.email || storedUser()?.email;
      if (!email) throw new Error('Não foi possível identificar o e-mail da conta.');
      const { entrega } = await request(`/rastreamento/${encodeURIComponent(code)}?email=${encodeURIComponent(email)}`, { auth: false });
      currentDelivery = entrega;
      renderTimeline(entrega);
      await updateClientMap(entrega);
      const statusCard = $('.cartao-status-escuro');
      if (statusCard) {
        const title = $('p', statusCard); if (title) title.textContent = 'Status da entrega';
        const value = $('h2', statusCard); if (value) value.textContent = entrega.status;
        const note = $('.rodape-progresso', statusCard);
        if (note) note.textContent = `Código ${entrega.codigo} • atualizado em ${safeDate(entrega.updatedAt)}`;
        const fill = $('.preenchimento', statusCard);
        const progress = { Pendente: 5, 'Aguardando coleta': 20, 'Em trânsito': 50, 'Saiu para entrega': 80, Entregue: 100, Problema: 50, Cancelada: 0 };
        if (fill) fill.style.width = `${progress[entrega.status] ?? 0}%`;
      }
      const balloon = $('.balao-flutuante');
      if (balloon) { const strong = $('strong', balloon); if (strong) strong.textContent = entrega.status; }
      const detailValues = $$('.item-detalhe p');
      if (detailValues[0]) detailValues[0].textContent = entrega.destino || '—';
      if (detailValues[1]) detailValues[1].textContent = entrega.destinatario_nome || '—';
      if (detailValues[2]) detailValues[2].textContent = `${entrega.quantidade_volumes} volume(s) • ${entrega.tipo_carga || 'Carga geral'}`;
      const driverName = $('.cartao-info-lateral .nome-motorista');
      if (driverName) driverName.textContent = entrega.motorista?.nome || 'Motorista não atribuído';
      const vehicleName = $('.cartao-info-lateral .veiculo-motorista');
      if (vehicleName) vehicleName.textContent = entrega.veiculo ? `${entrega.veiculo.tipo} • ${entrega.veiculo.placa}` : 'Veículo não atribuído';
      const callButton = $('#rastrear-ligar');
      const messageButton = $('#rastrear-mensagem');
      if (callButton) {
        const phone = String(entrega.motorista?.telefone || '').replace(/[^0-9+]/g, '');
        callButton.disabled = !phone;
        callButton.title = phone ? 'Ligar para o motorista' : 'O motorista ainda não possui telefone cadastrado ou não foi atribuído.';
        callButton.onclick = () => { if (phone) window.location.href = `tel:${phone}`; };
      }
      if (messageButton) {
        messageButton.disabled = false;
        messageButton.onclick = () => {
          const assunto = `Ajuda com a entrega ${entrega.codigo}`;
          const texto = `Olá, preciso de ajuda com a entrega ${entrega.codigo}. Status atual: ${entrega.status}.`;
          window.location.href = `atendimento-cliente.html?codigo=${encodeURIComponent(entrega.codigo)}&assunto=${encodeURIComponent(assunto)}&mensagem=${encodeURIComponent(texto)}`;
        };
      }
      const headings = $$('h2');
      headings.forEach(h => {
        if (/0,0 km|restantes/i.test(h.textContent)) h.textContent = entrega.destino;
      });
      const address = $('.endereco-parada');
      if (address) address.textContent = entrega.destino;
      message(`Entrega ${entrega.codigo}: ${entrega.status}. Última atualização: ${safeDate(entrega.updatedAt)}.`, 'sucesso');
    };
    if (form) form.addEventListener('submit', async e => {
      e.preventDefault();
      try { await render(input?.value.trim()); }
      catch (error) { message(error.message, 'erro'); }
    });
    if (query) {
      try { await render(query); } catch (error) { message(error.message,'erro'); }
    }
  }

  async function carregarAdmin() {
    const [summary, deliveries, users] = await Promise.all([
      request('/dashboard/resumo'),
      request('/entregas?limite=10'),
      requestTodasPaginas('/usuarios?perfil=Motorista')
    ]);
    const cards = $$('.cartao-metricas, .cartao-info');
    const values = [summary.total, summary.em_andamento, summary.entregues, summary.motoristas_pendentes ?? summary.veiculos_disponiveis ?? 0];
    const valuesPainel = [summary.total, summary.em_andamento, summary.entregues,
      summary.veiculos_disponiveis ?? 0];
    cards.slice(0,4).forEach((card,i) => {
      const target = $('.numero-metrica',card) || $('strong',card) || $('p',card);
      if (target) target.textContent = String(valuesPainel[i] ?? 0);
    });
    const tbody = $('#admin-entregas-recentes');
    const mostrarEntregas = items => {
      if (!tbody) return;
      tbody.replaceChildren();
      items.forEach(d => {
        const tr = el('tr');
        [d.codigo, d.cliente?.nome || '—', d.destino, d.motorista?.nome || 'Sem motorista'].forEach(v => tr.append(el('td', '', v)));
        const cell = el('td'); cell.append(statusBadge(d.status)); tr.append(cell);
        tbody.append(tr);
      });
      if (!items.length) {
        const tr = el('tr'); const td = el('td', 'estado-vazio', 'Nenhuma entrega encontrada.');
        td.colSpan = 5; tr.append(td); tbody.append(tr);
      }
    };
    mostrarEntregas((deliveries.dados || []).slice(0, 10));
    const pending = $('#lista-motoristas-pendentes');
    const pendingData = (users.dados || []).filter(driver => driver.aprovado === false);
    const pendingCount = $('#admin-pendentes-count');
    if (pendingCount) pendingCount.textContent = String(pendingData.length);
    if (pending) {
      let container = $('#motoristas-pendentes-itens',pending);
      if (!container) { container=el('div'); container.id='motoristas-pendentes-itens'; pending.append(container); }
      container.replaceChildren();
      if (!pendingData.length) container.append(el('p','estado-vazio','Não há motoristas aguardando aprovação.'));
      pendingData.forEach(driver => {
        const line=el('div','motorista-pendente');
        const detail=el('div');detail.append(el('strong','',driver.nome),el('div','texto-secundario',`${driver.email} • CNH: ${driver.cnh || 'não informada'}`));
        const buttons=el('div','acoes-tabela');
        const documentButton=el('button','botao botao-secundario-pequeno','Ver CNH');documentButton.type='button';
        documentButton.addEventListener('click', () => visualizarDocumentoCnh(driver).catch(e => message(e.message, 'erro')));
        const button=el('button','botao botao-primario','Aprovar');button.type='button';
        button.addEventListener('click',async()=>{
          try{await request(`/usuarios/${driver.id}/aprovacao`,{method:'PATCH',body:{aprovado:true}});line.remove();driver.aprovado=true;if(pendingCount)pendingCount.textContent=String(Math.max(0,Number(pendingCount.textContent||0)-1));const docs=$('#admin-motoristas-documentos');if(docs){const rows=Array.from(docs.querySelectorAll('.admin-document-row'));const row=rows.find(r=>r.querySelector('strong')?.textContent===driver.nome);const detail=row?.querySelector('small');if(detail)detail.textContent=`${driver.email} • Aprovado`;}message(`Motorista ${driver.nome} aprovado.`,'sucesso');}
          catch(e){message(e.message,'erro');}
        });
        buttons.append(documentButton,button);
        line.append(detail,buttons);container.append(line);
      });
    }
    const documentos = $('#admin-motoristas-documentos');
    if (documentos) {
      documentos.replaceChildren();
      const motoristas = users.dados || [];
      if (!motoristas.length) documentos.append(el('p', 'estado-vazio', 'Ainda não há motoristas cadastrados.'));
      motoristas.forEach(driver => {
        const row = el('div', 'admin-document-row');
        const info = el('div');
        info.append(el('strong', '', driver.nome), el('small', '', `${driver.email} • ${driver.aprovado ? 'Aprovado' : 'Em análise'}`));
        const view = el('button', 'botao botao-secundario-pequeno', 'Visualizar CNH');
        view.type = 'button';
        view.addEventListener('click', () => visualizarDocumentoCnh(driver).catch(err => message(err.message, 'erro')));
        row.append(info, view); documentos.append(row);
      });
    }
    const dateNode=$('#data-painel-admin');
    if(dateNode) dateNode.textContent=`Resumo operacional • ${new Date().toLocaleDateString('pt-BR')}`;
    const totalNode=$('.info-resumo-estoque p');
    if(totalNode) totalNode.textContent=String(summary.total);
    const search = $('#admin-filtro-entregas');
    let consulta = 0;
    const filtrar = async () => {
      const consultaAtual = ++consulta;
      const termo = (search?.value || '').trim();
      const dados = termo
        ? await requestTodasPaginas(`/entregas?busca=${encodeURIComponent(termo)}`)
        : deliveries;
      if (consultaAtual === consulta) mostrarEntregas(termo ? dados.dados : (dados.dados || []).slice(0, 10));
    };
    let debounce;
    search?.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => filtrar().catch(error => message(error.message, 'erro')), 280);
    });
    $('#admin-aplicar-filtro')?.addEventListener('click', () => filtrar().catch(error => message(error.message, 'erro')));
    const exportBtn=$('#exportar-csv-admin');
    if(exportBtn) exportBtn.addEventListener('click',exportCsv);
  }

  async function exportCsv() {
    try {
      const response=await fetch(`${API}/entregas/exportar.csv`,{headers:{Authorization:`Bearer ${token()}`}});
      if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.mensagem||'Falha ao exportar CSV.');}
      const blob=await response.blob();
      const url=URL.createObjectURL(blob);
      const link=el('a');link.href=url;link.download='urbanlink-entregas.csv';document.body.append(link);link.click();link.remove();URL.revokeObjectURL(url);
    } catch(e){message(e.message,'erro');}
  }

  async function motoristaDeliveriesPage(user) {
    const main = $('main');
    const heading = $('.cabecalho-secao', main);
    if (heading) {
      const crumb = $('.migalhas', heading);
      const title = $('h2', heading);
      const subtitle = $('.subtitulo-bloco', heading);
      if (crumb) crumb.textContent = 'Área do motorista';
      if (title) title.textContent = 'Minhas entregas';
      if (subtitle) subtitle.textContent = 'Consulte os pedidos atribuídos à sua conta e acompanhe cada etapa.';
      const adminActions = $('.botoes-topo', heading);
      if (adminActions) adminActions.hidden = true;
    }
    Array.from(main?.children || []).forEach(child => {
      if (child !== heading) child.hidden = true;
    });

    const section = el('section', 'secao-branca lista-entregas-motorista');
    section.setAttribute('aria-label', 'Entregas atribuídas ao motorista');
    const top = el('div', 'topo-entregas-motorista');
    const intro = el('div');
    intro.append(el('h3', '', 'Pedidos atribuídos'), el('p', 'texto-secundario', 'A lista é atualizada diretamente com as entregas vinculadas ao seu cadastro.'));
    const refresh = el('button', 'botao botao-secundario', 'Atualizar lista');
    refresh.type = 'button';
    top.append(intro, refresh);
    const list = el('div', 'grade-entregas-motorista');
    section.append(top, list);
    if (heading) heading.insertAdjacentElement('afterend', section);
    else main?.append(section);

    const load = async () => {
      refresh.disabled = true;
      refresh.textContent = 'Atualizando…';
      list.replaceChildren(el('p', 'estado-vazio', 'Carregando suas entregas…'));
      try {
        const result = await requestTodasPaginas('/entregas');
        const deliveries = result.dados || [];
        list.replaceChildren();
        deliveries.forEach(delivery => {
          const card = el('article', 'cartao-entrega-motorista');
          const cardTop = el('div', 'topo-cartao-entrega-motorista');
          cardTop.append(el('strong', 'codigo-entrega-motorista', delivery.codigo || 'Entrega'));
          cardTop.append(statusBadge(delivery.status));
          const route = el('div', 'rota-entrega-motorista');
          route.append(el('p', '', `Origem: ${delivery.origem || 'Não informada'}`));
          route.append(el('p', '', `Destino: ${delivery.destino || 'Não informado'}`));
          const details = el('div', 'detalhes-entrega-motorista');
          details.append(el('span', '', `Cliente: ${delivery.cliente?.nome || '—'}`));
          details.append(el('span', '', `Destinatário: ${delivery.destinatario_nome || '—'}`));
          details.append(el('span', '', `Janela: ${delivery.janela_inicio || '—'} às ${delivery.janela_fim || '—'}`));
          const actions = el('div', 'acoes-entrega-motorista');
          const mapLink = el('a', 'botao botao-primario', 'Ver no mapa');
          mapLink.href = 'mapa-rotas.html';
          actions.append(mapLink);
          if (delivery.destino_latitude != null && delivery.destino_longitude != null) {
            const nav = el('a', 'botao botao-secundario', 'Abrir navegação');
            nav.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${delivery.destino_latitude},${delivery.destino_longitude}`)}`;
            nav.target = '_blank';
            nav.rel = 'noopener noreferrer';
            actions.append(nav);
          }
          card.append(cardTop, route, details, actions);
          list.append(card);
        });
        if (!deliveries.length) list.append(el('p', 'estado-vazio', 'Você ainda não possui entregas atribuídas. Quando o administrador ou gestor vincular um pedido à sua conta, ele aparecerá aqui.'));
        $('.aviso-aprovacao-motorista', section)?.remove();
        if (user?.aprovado === false) {
          const note = el('p', 'aviso-aprovacao-motorista', 'Seu cadastro ainda está em análise. Você pode consultar as entregas atribuídas, mas as atualizações operacionais serão liberadas após a aprovação.');
          section.insertBefore(note, list);
        }
      } catch (error) {
        list.replaceChildren(el('p', 'estado-vazio', error.message || 'Não foi possível carregar suas entregas.'));
      } finally {
        refresh.disabled = false;
        refresh.textContent = 'Atualizar lista';
      }
    };
    refresh.addEventListener('click', load);
    await load();
  }

  async function manageDeliveriesPage(user) {
    if (user?.perfil === 'Motorista') {
      await motoristaDeliveriesPage(user);
      return;
    }
    const form=$('#form-admin-entrega');
    const tbody=$('#entregas-admin-body');
    const [deliveryData, clients, drivers, vehicles] = await Promise.all([
      requestTodasPaginas('/entregas'),
      requestTodasPaginas('/usuarios?perfil=Cliente'),
      requestTodasPaginas('/usuarios?perfil=Motorista&aprovado=true'),
      requestTodasPaginas('/veiculos')
    ]);
    const deliveries=deliveryData.dados || [];
    const clientSelect=$('#admin-cliente'), driverSelect=$('#admin-motorista'), vehicleSelect=$('#admin-veiculo');
    fillSelect(clientSelect,clients.dados||[],'Selecione um cliente');
    fillSelect(driverSelect,drivers.dados||[],'Atribuir depois');
    const allAvailableVehicles=(vehicles.dados||[]).filter(v=>v.status==='Disponivel');
    const refreshVehicles=()=>{
      const selectedType=val('admin-tipo-veiculo') || 'Moto';
      fillSelect(vehicleSelect,allAvailableVehicles.filter(v=>v.tipo===selectedType),'Atribuir depois',v=>`${v.placa} • ${v.modelo}`);
    };
    refreshVehicles();
    $('#admin-tipo-veiculo')?.addEventListener('change',refreshVehicles);
    // Atribuição de pedidos recebidos dos clientes: ação visível na linha da entrega.
    const modalAtribuicao=$('#modalAtribuirEntrega');
    const formAtribuicao=$('#form-atribuir-entrega');
    const motoristaAtribuicao=$('#atribuir-motorista');
    const veiculoAtribuicao=$('#atribuir-veiculo');
    const avisoAtribuicao=$('#atribuir-mensagem');
    const ajudaAtribuicao=$('#atribuir-ajuda');
    const confirmarAtribuicao=$('#confirmar-atribuicao');
    let pedidoEmAtribuicao=null;
    let origemFocoAtribuicao=null;

    const veiculosCompativeis = (pedido, motoristaId) => allAvailableVehicles.filter(v=>
      v.tipo === pedido.tipo_veiculo &&
      (!v.motorista_id || Number(v.motorista_id) === Number(motoristaId)) &&
      !(Number(v.capacidade_kg) > 0 && Number(pedido.peso_kg || 0) > Number(v.capacidade_kg)) &&
      !(v.volume_m3 != null && Number(pedido.volume_m3 || 0) > Number(v.volume_m3))
    );
    const atualizarVeiculosAtribuicao=()=>{
      const motoristaId=Number(motoristaAtribuicao?.value);
      const compativeis=pedidoEmAtribuicao && motoristaId ? veiculosCompativeis(pedidoEmAtribuicao,motoristaId) : [];
      const titulo=motoristaId ? 'Selecione um veículo disponível' : 'Selecione primeiro um motorista';
      fillSelect(veiculoAtribuicao,compativeis,titulo,v=>`${v.placa} • ${v.modelo} (${v.tipo})`);
      veiculoAtribuicao.disabled=!compativeis.length;
      if(ajudaAtribuicao){
        ajudaAtribuicao.textContent= !motoristaId
          ? 'Selecione um motorista aprovado para consultar seus veículos disponíveis.'
          : !compativeis.length
          ? 'Não há veículo compatível e disponível para este motorista. Confira o tipo de veículo e a capacidade cadastrada.'
          : `${compativeis.length} veículo(s) compatível(is). Confirme a atribuição para iniciar a coleta.`;
      }
    };
    const fecharModalAtribuicao=()=>{
      if(!modalAtribuicao)return;
      modalAtribuicao.style.display='none';
      modalAtribuicao.setAttribute('aria-hidden','true');
      pedidoEmAtribuicao=null;
      formAtribuicao?.reset();
      if(avisoAtribuicao){avisoAtribuicao.hidden=true;avisoAtribuicao.textContent='';}
      origemFocoAtribuicao?.focus();
      origemFocoAtribuicao=null;
    };
    const abrirModalAtribuicao=(pedido,botao)=>{
      if(!modalAtribuicao||!formAtribuicao)return;
      pedidoEmAtribuicao=pedido;
      origemFocoAtribuicao=botao;
      $('#atribuir-codigo').textContent=pedido.codigo||'—';
      $('#atribuir-tipo').textContent=pedido.tipo_veiculo||'—';
      $('#atribuir-destino').textContent=pedido.destino||'Destino não informado';
      $('#atribuir-carga').textContent=`${pedido.peso_kg ?? 0} kg • ${pedido.volume_m3 ?? 0} m³`;
      fillSelect(motoristaAtribuicao,(drivers.dados||[]).filter(d=>d.ativo!==false&&d.aprovado===true),'Selecione um motorista');
      if(avisoAtribuicao){avisoAtribuicao.hidden=true;avisoAtribuicao.textContent='';}
      formAtribuicao.reset();
      atualizarVeiculosAtribuicao();
      modalAtribuicao.style.display='flex';
      modalAtribuicao.setAttribute('aria-hidden','false');
      motoristaAtribuicao?.focus();
    };
    motoristaAtribuicao?.addEventListener('change',atualizarVeiculosAtribuicao);
    $('#fechar-atribuicao')?.addEventListener('click',fecharModalAtribuicao);
    $('#cancelar-atribuicao')?.addEventListener('click',fecharModalAtribuicao);
    modalAtribuicao?.addEventListener('click',e=>{if(e.target===modalAtribuicao)fecharModalAtribuicao();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modalAtribuicao?.style.display==='flex')fecharModalAtribuicao();});
    formAtribuicao?.addEventListener('submit',async e=>{
      e.preventDefault();
      if(!pedidoEmAtribuicao)return;
      const pedido=pedidoEmAtribuicao;
      const motoristaId=Number(motoristaAtribuicao?.value);
      const veiculoId=Number(veiculoAtribuicao?.value);
      const valido=Number.isInteger(motoristaId)&&motoristaId>0&&veiculosCompativeis(pedido,motoristaId).some(v=>Number(v.id)===veiculoId);
      if(!valido){
        if(avisoAtribuicao){avisoAtribuicao.textContent='Escolha um motorista aprovado e um veículo compatível disponível.';avisoAtribuicao.hidden=false;}
        return;
      }
      confirmarAtribuicao.disabled=true;
      confirmarAtribuicao.textContent='Atribuindo…';
      if(avisoAtribuicao)avisoAtribuicao.hidden=true;
      try{
        const resultado=await request(`/entregas/${pedido.id}/atribuicao`,{
          method:'PATCH',body:{motorista_id:motoristaId,veiculo_id:veiculoId}
        });
        const atualizado=resultado.entrega;
        const i=deliveries.findIndex(d=>Number(d.id)===Number(pedido.id));
        if(i>=0&&atualizado)deliveries[i]=atualizado;
        const indiceVeiculo=allAvailableVehicles.findIndex(v=>Number(v.id)===veiculoId);
        if(indiceVeiculo>=0)allAvailableVehicles.splice(indiceVeiculo,1);
        fecharModalAtribuicao();
        const novaAba=managerFilter.status==='sem-motorista'?'sem-motorista':managerFilter.status;
        updateTabCounts();
        render(novaAba);
        message(`Pedido ${pedido.codigo} atribuído com sucesso. O motorista já pode consultar a entrega.`,'sucesso');
      }catch(error){
        if(avisoAtribuicao){avisoAtribuicao.textContent=error.message;avisoAtribuicao.hidden=false;}
      }finally{
        confirmarAtribuicao.disabled=false;
        confirmarAtribuicao.textContent='Confirmar atribuição';
      }
    });
    const managerFilter = { status: 'todos' };
    const updateTabCounts = () => {
      const counts = {
        todos: deliveries.length,
        'sem-motorista': deliveries.filter(d=>d.status==='Pendente'&&!d.motorista_id&&!d.veiculo_id).length,
        Pendente: deliveries.filter(d=>d.status==='Pendente').length,
        'Em trânsito': deliveries.filter(d=>['Em trânsito','Saiu para entrega'].includes(d.status)).length,
        Entregue: deliveries.filter(d=>d.status==='Entregue').length,
        Cancelada: deliveries.filter(d=>d.status==='Cancelada').length
      };
      const aguardando=counts['sem-motorista'];
      const aviso=$('#contador-sem-motorista');
      if(aviso)aviso.textContent=`${aguardando} aguardando atribuição`;
      $$('.abas-status .aba').forEach(tab=>{
        const counter=$('.contador-aba',tab);
        if(counter)counter.textContent=String(counts[tab.dataset.filtro||'todos']??0);
      });
    };
    const render = filter => {
      if(!tbody)return;
      managerFilter.status=filter;
      tbody.replaceChildren();
      const query=(val('filtro-entregas')||'').toLowerCase();
      const selectedDriver=val('filtro-motorista');
      const statusFilter=val('filtro-status');
      const filtered=deliveries.filter(d=>
        (filter==='todos'||d.status===filter||(filter==='sem-motorista'&&d.status==='Pendente'&&!d.motorista_id&&!d.veiculo_id)||(filter==='Em trânsito'&&d.status==='Saiu para entrega')) &&
        (!statusFilter||d.status===statusFilter) &&
        (!selectedDriver||String(d.motorista_id)===selectedDriver) &&
        (!query||`${d.codigo} ${d.cliente?.nome||''} ${d.destino} ${d.motorista?.nome||''}`.toLowerCase().includes(query))
      );
      filtered.forEach(d=>{
        const tr=el('tr');
        const checkbox=el('td');const cb=el('input');cb.type='checkbox';cb.value=d.id;cb.setAttribute('aria-label',`Selecionar ${d.codigo}`);checkbox.append(cb);tr.append(checkbox);
        [d.codigo,d.cliente?.nome||'—',`${d.origem} → ${d.destino}`,`${d.janela_inicio||'—'} - ${d.janela_fim||'—'}`,d.motorista?.nome||'Sem motorista'].forEach(value=>tr.append(el('td','',value)));
        const st=el('td');st.append(statusBadge(d.status));tr.append(st);
        const action=el('td','acoes-tabela');
        const transicoes = {
          'Pendente':['Aguardando coleta','Cancelada'],
          'Aguardando coleta':['Em trânsito','Cancelada'],
          'Em trânsito':['Saiu para entrega','Problema'],
          'Saiu para entrega':['Entregue','Problema'],
          'Problema':['Em trânsito','Saiu para entrega','Cancelada']
        };
        const semResponsavel=!d.motorista_id&&!d.veiculo_id;
        if(semResponsavel&&['Pendente','Aguardando coleta'].includes(d.status)){
          const atribuir=el('button','botao-atribuir-motorista','Atribuir motorista');
          atribuir.type='button';
          atribuir.setAttribute('aria-label',`Atribuir motorista para o pedido ${d.codigo}`);
          atribuir.addEventListener('click',()=>abrirModalAtribuicao(d,atribuir));
          action.append(atribuir);
        }
        // Sem motorista, é permitido apenas cancelar; demais transições exigem atribuição.
        const proximosStatus=(transicoes[d.status]||[]).filter(status=>!semResponsavel||status==='Cancelada');
        const select=el('select','');
        select.setAttribute('aria-label',`Próximo status do pedido ${d.codigo}`);
        if(proximosStatus.length){
          proximosStatus.forEach(statusName=>{const option=el('option','',statusName);option.value=statusName;select.append(option);});
        }else{
          const option=el('option','',`Status final: ${d.status}`);option.value='';select.append(option);select.disabled=true;
        }
        const update=el('button','botao-pequeno','Atualizar');update.type='button';update.disabled=!proximosStatus.length;
        update.addEventListener('click',async()=>{
          try{
            await request(`/entregas/${d.id}/status`,{method:'PATCH',body:{status:select.value}});
            message(`Status da entrega ${d.codigo} atualizado.`,'sucesso');window.location.reload();
          }catch(e){message(e.message,'erro');}
        });
        const statusRow=el('div','acoes-status-entrega');
        statusRow.append(select,update);
        action.append(statusRow);tr.append(action);tbody.append(tr);
      });
      if(!filtered.length){const tr=el('tr');const td=el('td','estado-vazio','Nenhuma entrega para este filtro.');td.colSpan=8;tr.append(td);tbody.append(tr);}
    };
    render('todos');
    updateTabCounts();
    fillSelect($('#filtro-motorista'),(drivers.dados||[]),'Todos os motoristas');
    $('#aplicar-filtros')?.addEventListener('click',()=>render(managerFilter.status));
    $('#filtro-entregas')?.addEventListener('input',()=>render(managerFilter.status));
    $('#filtro-status')?.addEventListener('change',()=>render(managerFilter.status));
    $('#filtro-motorista')?.addEventListener('change',()=>render(managerFilter.status));
    $$('.abas-status .aba').forEach(tab=>tab.addEventListener('click',()=>{
      $$('.abas-status .aba').forEach(t=>{t.classList.toggle('ativa',t===tab);t.setAttribute('aria-pressed',String(t===tab));});
      render(tab.dataset.filtro||'todos');
    }));
    $('#abrir-nova-entrega')?.addEventListener('click',()=>{const modal=$('.overlay-modal');if(modal)modal.style.display='flex';});
    const closeModal=()=>{const modal=$('.overlay-modal');if(modal)modal.style.display='none';};
    $('.fechar-modal')?.addEventListener('click',closeModal);
    $('button[type="button"]',form)?.addEventListener('click',closeModal);
    if(form){
      configurarLocalizacaoDestino(form, { botao: 'admin-verificar-endereco', aviso: 'admin-geo-feedback', mapa: 'admin-geo-preview', destino: 'admin-destino', cidade: 'admin-cidade', uf: 'admin-uf', cep: 'admin-cep', latitude: 'admin-latitude', longitude: 'admin-longitude' });
      form.addEventListener('submit',async e=>{
        e.preventDefault();
        const body={
          cliente_id:Number(clientSelect?.value),
          destino:val('admin-destino'),
          cidade:val('admin-cidade'),
          uf:val('admin-uf'),
          cep_entrega:val('admin-cep'),
          janela_inicio:val('admin-janela-inicio'),
          janela_fim:val('admin-janela-fim'),
          observacoes:val('admin-observacoes'),
          tipo_veiculo:val('admin-tipo-veiculo'),
          destino_latitude:num('admin-latitude'),
          destino_longitude:num('admin-longitude'),
          tipo_carga:'Volumes gerais'
        };
        if(Boolean(driverSelect?.value)!==Boolean(vehicleSelect?.value)){
          message('Selecione motorista e veículo juntos, ou deixe os dois como “Atribuir depois”.','erro',form);return;
        }
        if ((body.destino_latitude === null) !== (body.destino_longitude === null)) {
          message('Preencha latitude e longitude juntas ou deixe os dois campos vazios.','erro',form);return;
        }
        try{
          const created=await request('/entregas',{method:'POST',body});
          if(driverSelect?.value&&vehicleSelect?.value){
            await request(`/entregas/${created.entrega.id}/atribuicao`,{method:'PATCH',body:{motorista_id:Number(driverSelect.value),veiculo_id:Number(vehicleSelect.value)}});
          }
          const localizada = created.entrega.destino_latitude !== null && created.entrega.destino_latitude !== undefined &&
            created.entrega.destino_longitude !== null && created.entrega.destino_longitude !== undefined;
          const aviso = localizada
            ? (created.localizacao?.status === 'aproximado' ? ' Rua localizada aproximadamente; confirme o número no mapa.' : ' Destino localizado automaticamente no mapa.')
            : ` Entrega salva sem coordenadas. ${created.localizacao?.mensagem || 'Confira o endereço informado.'}`;
          message(`Entrega registrada: ${created.entrega.codigo}.${aviso}`, localizada ? 'sucesso' : 'info', form);
          if (localizada) setTimeout(()=>window.location.reload(),2200);
        }catch(error){message(error.message,'erro',form);}
      });
    }
    $('#exportar-csv')?.addEventListener('click',exportCsv);
  }

  function fillSelect(select, items, placeholder, labelFn = item => item.nome) {
    if(!select)return;
    const first=el('option','',placeholder);first.value='';
    select.replaceChildren(first);
    items.forEach(item=>{const opt=el('option','',labelFn(item));opt.value=item.id;select.append(opt);});
  }

  async function driverDashboardPage(user) {
    const summary=await request('/dashboard/resumo');
    const data=await requestTodasPaginas('/entregas');
    const deliveries=data.dados||[];
    const pendingApproval=user?.aprovado===false;
    if(pendingApproval) message('Seu cadastro está em análise. Você já pode completar as informações, mas só poderá iniciar entregas após a aprovação do gestor.','info');
    const live=deliveries.filter(d=>!['Entregue','Cancelada'].includes(d.status));
    const metricCards=$$('.cartao-info');
    if(metricCards[0]){
      const label=$('small',metricCards[0]), p=$('.numero-metrica',metricCards[0]), sub=$('.subtexto-cartao',metricCards[0]);
      if(label)label.textContent='Entregas ativas'; if(p)p.textContent=String(live.length); if(sub)sub.textContent='atribuídas a você';
    }
    if(metricCards[1]){
      const label=$('small',metricCards[1]), p=$('.numero-metrica',metricCards[1]), sub=$('.subtexto-cartao',metricCards[1]);
      if(label)label.textContent='Entregas concluídas'; if(p)p.textContent=String(summary.entregues || 0); if(sub)sub.textContent='no total';
    }
    const list=$('.lista-sequencia-paradas');
    if(list){
      list.replaceChildren();
      live.forEach((d,i)=>{
        const item=el('div','item-sequencia');
        item.append(el('span','num-circulo azul',String(i+1)));
        const detail=el('div','detalhe');detail.append(el('strong','',d.destino),el('small','',`${d.codigo} • ${d.status}`));
        item.append(detail,statusBadge(d.status));list.append(item);
      });
      if(!live.length)list.append(el('p','estado-vazio','Nenhuma entrega atribuída à sua conta.'));
    }
    let current=live[0];
    if(metricCards[2]){
      const label=$('small',metricCards[2]), p=$('.numero-metrica',metricCards[2]), sub=$('.subtexto-cartao',metricCards[2]);
      if(label)label.textContent='Próxima parada';
      if(p)p.textContent=current?'1 / '+live.length:'—';
      if(sub)sub.textContent=current?current.codigo:'Nenhuma entrega pendente';
    }
    const address=$('.endereco-parada');
    const customer=$('.info-cliente-linha strong');
    if(current){
      if(address)address.textContent=current.destino;
      if(customer)customer.textContent=current.destinatario_nome;
    }else if(address)address.textContent='Nenhuma entrega ativa';
    const first=$('#driver-arrival'), confirm=$('#driver-confirm');
    const updateControls=()=>{
      if(!current)return;
      if(first){
        first.disabled=pendingApproval;
        first.textContent=current.status==='Aguardando coleta'?'Iniciar transporte':current.status==='Em trânsito'?'Cheguei ao destino':'Etapa atualizada';
      }
      if(confirm){confirm.disabled=pendingApproval||current.status!=='Saiu para entrega';}
    };
    updateControls();
    if(!current) {
      if(first){first.disabled=true;first.textContent='Nenhuma entrega ativa';}
      if(confirm)confirm.disabled=true;
    }
    if(first)first.addEventListener('click',async()=>{
      if(!current||pendingApproval)return;
      const next=current.status==='Aguardando coleta'?'Em trânsito':current.status==='Em trânsito'?'Saiu para entrega':null;
      if(!next)return;
      try{
        await request(`/entregas/${current.id}/status`,{method:'PATCH',body:{status:next}});
        current.status=next;updateControls();message(`Entrega ${current.codigo}: ${next}.`,'sucesso');
      }catch(e){message(e.message,'erro');}
    });
    if(confirm)confirm.addEventListener('click',async()=>{
      if(!current||current.status!=='Saiu para entrega'||pendingApproval)return;
      try{
        await request(`/entregas/${current.id}/status`,{method:'PATCH',body:{status:'Entregue'}});
        message(`Entrega ${current.codigo} concluída.`,'sucesso');window.location.reload();
      }catch(e){message(e.message,'erro');}
    });
  }

  async function routePage(user) {
    if ($('#urbanlink-map')) return; // O mapa Leaflet possui inicialização própria em mapa.js.
    const data=await requestTodasPaginas('/entregas');
    const deliveries=(data.dados||[]).filter(d=>!['Entregue','Cancelada'].includes(d.status));
    const list=$('#lista-paradas-rota');
    if(list){
      list.replaceChildren();
      deliveries.forEach((d,i)=>{
        const item=el('div','item-parada');
        item.append(el('span','numero-parada',String(i+1)));
        const info=el('div','info-parada');info.append(el('strong','',d.destino),el('small','',`${d.codigo} • ${d.status}`));
        item.append(info);list.append(item);
      });
      if(!deliveries.length)list.append(el('p','estado-vazio','Não há entregas em aberto para planejar.'));
    }
    const metrics=$$('.item-metrica-rota strong');
    if(metrics[0])metrics[0].textContent='— km';
    if(metrics[1])metrics[1].textContent='— min';
    if(metrics[2])metrics[2].textContent=String(deliveries.length);
    const optimize=$('#otimizar-rota'), start=$('#iniciar-rota');
    let plannedRoute=null;
    const makeRoute=async()=>{
      if(!deliveries.length)throw new Error('Não há entregas em aberto.');
      const coords=deliveries.filter(d=>d.destino_latitude!==null&&d.destino_longitude!==null);
      if(coords.length!==deliveries.length)throw new Error('Algumas entregas não têm coordenadas de destino. Informe latitude e longitude no cadastro da entrega para calcular a rota.');
      let position=null;
      if(navigator.geolocation){
        try{
          position=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(
            p=>resolve({latitude:p.coords.latitude,longitude:p.coords.longitude}),
            ()=>reject(new Error('Geolocalização indisponível')),
            {enableHighAccuracy:true,timeout:10000}
          ));
        }catch(_e){ position=null; }
      }
      if(position && user?.perfil==='Motorista'){
        try{
          const vehicleData=await request('/veiculos');
          const vehicle=(vehicleData.dados||[])[0];
          if(vehicle)await request(`/veiculos/${vehicle.id}/posicoes`,{method:'POST',body:{latitude:position.latitude,longitude:position.longitude,status:'Em Rota'}});
        }catch(_e){ /* O cálculo da rota poderá usar a posição enviada na requisição. */ }
      }
      const result=await request('/rotas/otimizar',{method:'POST',body:{entrega_ids:coords.map(d=>d.id),origem:position,velocidade_media_kmh:30}});
      plannedRoute=result.rota;
      if(metrics[0])metrics[0].textContent=`${Number(result.rota.distancia_total_km).toFixed(1)} km`;
      if(metrics[1])metrics[1].textContent=`${result.rota.tempo_estimado_min} min`;
      if(list){
        list.replaceChildren();
        (result.paradas||[]).forEach(p=>{
          const item=el('div','item-parada');
          item.append(el('span','numero-parada',String(p.ordem)));
          const info=el('div','info-parada');info.append(el('strong','',p.entrega.destino),el('small','',p.entrega.codigo));
          item.append(info);list.append(item);
        });
      }
      message('Rota calculada pelo método do vizinho mais próximo. A distância é em linha reta entre coordenadas e não considera tráfego ou vias.','sucesso');
    };
    optimize?.addEventListener('click',async()=>{try{await makeRoute();}catch(e){message(e.message,'erro');}});
    start?.addEventListener('click',async()=>{
      try{
        if(!plannedRoute)await makeRoute();
        await request(`/rotas/${plannedRoute.id}/status`,{method:'PATCH',body:{status:'Em andamento'}});
        message('Rota iniciada.','sucesso');
      }catch(e){message(e.message,'erro');}
    });
  }

  async function simulationPage() {
    const form = $('#form-simulacao');
    const select = $('#simulacao-entregas');
    const host = $('#simulacoes-salvas');
    const [deliveryData, simulationData] = await Promise.all([
      requestTodasPaginas('/entregas'), requestTodasPaginas('/simulacoes')
    ]);
    const eligible = (deliveryData.dados || []).filter(d =>
      !['Entregue', 'Cancelada'].includes(d.status) &&
      d.destino_latitude !== null && d.destino_latitude !== undefined && d.destino_latitude !== '' &&
      d.destino_longitude !== null && d.destino_longitude !== undefined && d.destino_longitude !== '' &&
      Number.isFinite(Number(d.destino_latitude)) && Number.isFinite(Number(d.destino_longitude))
    );
    const pendentesLocalizacao = (deliveryData.dados || []).filter(d => !['Entregue','Cancelada'].includes(d.status) && !eligible.some(item => Number(item.id) === Number(d.id)));
    const simLocationAlert = $('#sim-location-alert');
    if (simLocationAlert) {
      simLocationAlert.hidden = !pendentesLocalizacao.length;
      simLocationAlert.textContent = `${pendentesLocalizacao.length} entrega(s) ainda não possuem coordenadas válidas. Abra Mapa e rotas → Corrigir localização para utilizá-las nas simulações.`;
    }
    if (select) {
      select.replaceChildren();
      eligible.forEach(d => {
        const option = el('option', '', `${d.codigo} • ${d.destino}`);
        option.value = d.id;
        select.append(option);
      });
      if (!eligible.length) {
        const option = el('option', '', 'Nenhuma entrega pendente com coordenadas cadastradas.');
        option.disabled = true;
        select.append(option);
      }
    }

    let savedItems = [...(simulationData.dados || [])];
    const selectedCount = () => Array.from(select?.selectedOptions || []).filter(option => Number.isInteger(Number(option.value))).length;
    const updateSelectionCount = () => {
      const counter = $('#sim-selecao-contador');
      const count = selectedCount();
      if (counter) counter.textContent = count === 1 ? '1 entrega selecionada' : `${count} entregas selecionadas`;
      if (counter) counter.classList.toggle('sim-count-warning', count > 50);
    };
    select?.addEventListener('change', updateSelectionCount);
    $('#sim-selecionar-todas')?.addEventListener('click', () => {
      Array.from(select.options).forEach((option, index) => { option.selected = !option.disabled && index < 50; });
      updateSelectionCount();
      if (eligible.length > 50) message('Foram selecionadas as primeiras 50 entregas. O limite por simulação é de 50.', 'info', form);
    });
    $('#sim-limpar-selecao')?.addEventListener('click', () => {
      Array.from(select.options).forEach(option => { option.selected = false; });
      updateSelectionCount();
    });
    updateSelectionCount();

    $('#sim-usar-localizacao')?.addEventListener('click', () => {
      if (!navigator.geolocation) return message('Este navegador não oferece geolocalização.', 'erro', form);
      const button = $('#sim-usar-localizacao');
      button.disabled = true;
      button.textContent = 'Obtendo localização…';
      navigator.geolocation.getCurrentPosition(position => {
        $('#simulacao-lat').value = position.coords.latitude.toFixed(6);
        $('#simulacao-lon').value = position.coords.longitude.toFixed(6);
        button.disabled = false;
        button.textContent = 'Usar minha localização';
        message('Ponto de partida preenchido com sua localização atual.', 'sucesso', form);
      }, () => {
        button.disabled = false;
        button.textContent = 'Usar minha localização';
        message('Não foi possível obter sua localização. Autorize o acesso no navegador e tente novamente.', 'erro', form);
      }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 });
    });

    const renderSaved = (items) => {
      if (!host) return;
      host.replaceChildren();
      if (!items.length) {
        const tr = el('tr');
        const td = el('td', 'estado-vazio', 'Ainda não há simulações salvas.');
        td.colSpan = 7;
        tr.append(td);
        host.append(tr);
        return;
      }
      items.forEach(item => {
        const tr = el('tr');
        [item.nome, `${Number(item.distancia_total_km).toFixed(2)} km`,
          `${item.tempo_base_min} min`, `${item.tempo_simulado_min} min`,
          `+${item.acrescimo_min} min`, safeDate(item.createdAt)].forEach(value => tr.append(el('td', '', value)));
        const action = el('td');
        const button = el('button', 'botao-pequeno', 'Excluir');
        button.type = 'button';
        button.addEventListener('click', async () => {
          button.disabled = true;
          try {
            await request(`/simulacoes/${item.id}`, { method: 'DELETE' });
            savedItems = savedItems.filter(saved => Number(saved.id) !== Number(item.id));
            renderSaved(savedItems);
            message('Simulação excluída.', 'sucesso');
          } catch (error) {
            button.disabled = false;
            message(error.message, 'erro');
          }
        });
        action.append(button);
        tr.append(action);
        host.append(tr);
      });
    };
    renderSaved(savedItems);

    if (form) form.addEventListener('submit', async event => {
      event.preventDefault();
      const ids = Array.from(select?.selectedOptions || []).map(option => Number(option.value)).filter(Number.isInteger);
      if (!ids.length || ids.length > 50) return message('Selecione de 1 a 50 entregas com coordenadas cadastradas.', 'erro', form);
      const latitude = num('simulacao-lat');
      const longitude = num('simulacao-lon');
      if (latitude === null || longitude === null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        return message('Informe latitude entre -90 e 90 e longitude entre -180 e 180.', 'erro', form);
      }
      const button = $('button[type="submit"]', form);
      if (button) { button.disabled = true; button.classList.add('is-loading'); }
      try {
        const result = await request('/simulacoes', { method: 'POST', body: {
          nome: val('simulacao-nome'),
          entrega_ids: ids,
          origem: { latitude, longitude },
          velocidade_base_kmh: num('simulacao-velocidade'),
          fator_congestionamento: num('simulacao-congestionamento')
        }});
        const box = $('#resultado-simulacao');
        if (box) {
          box.classList.add('sim-result-ready');
          const eyebrow = el('span', 'sim-result-eyebrow', 'RESULTADO DA SIMULAÇÃO');
          const title = el('h2', '', result.simulacao.nome || 'Cenário calculado');
          const intro = el('p', 'sim-result-intro', `${ids.length} entrega(s) analisada(s) com o nível de congestionamento selecionado.`);
          const grid = el('div', 'sim-result-metrics');
          const addMetric = (label, value, note, highlight = false) => {
            const metric = el('div', `sim-result-metric${highlight ? ' is-highlight' : ''}`);
            metric.append(el('small', '', label), el('strong', '', value), el('span', '', note));
            grid.append(metric);
          };
          addMetric('Distância aproximada', `${Number(result.simulacao.distancia_total_km).toFixed(2)} km`, 'Percurso calculado');
          addMetric('Tempo-base', `${result.simulacao.tempo_base_min} min`, 'Sem fator adicional');
          addMetric('Tempo simulado', `${result.simulacao.tempo_simulado_min} min`, 'Com o trânsito escolhido', true);
          addMetric('Acréscimo estimado', `+${result.simulacao.acrescimo_min} min`, 'Diferença para o tempo-base');
          box.replaceChildren(eyebrow, title, intro, grid, el('p', 'sim-result-note', 'Estimativa matemática, não representa o trânsito em tempo real.'));
        }
        message(result.mensagem || 'Cenário calculado e salvo.', 'sucesso', form);
        savedItems = [result.simulacao, ...savedItems];
        renderSaved(savedItems);
      } catch (error) {
        message(error.message, 'erro', form);
      } finally {
        if (button) { button.disabled = false; button.classList.remove('is-loading'); }
      }
    });
  }

  async function supportPage() {
    const host=$('#historico-chamados');
    const form=$('#form-chamado');
    const contacts=await request('/config/public',{auth:false}).catch(()=>({telefoneAtendimento:'',emailAtendimento:''}));
    $$('[data-contato]').forEach(card=>{
      const tipo=card.dataset.contato;
      const abrir=()=>{
        if(tipo==='telefone'){
          const phone=String(contacts.telefoneAtendimento||'').replace(/[^0-9+]/g,'');
          if(phone) window.location.href=`tel:${phone}`;
          else message('O telefone ainda não foi configurado. Utilize o atendimento por mensagens ou peça ao administrador para preencher SUPPORT_PHONE no arquivo .env.','info');
        }else if(tipo==='email'){
          const email=String(contacts.emailAtendimento||'').trim();
          if(/^\S+@\S+\.\S+$/.test(email)) window.location.href=`mailto:${email}`;
          else message('O e-mail ainda não foi configurado. Utilize o atendimento por mensagens ou peça ao administrador para preencher SUPPORT_EMAIL no arquivo .env.','info');
        }
      };
      card.setAttribute('role','button');
      card.setAttribute('tabindex','0');
      card.addEventListener('click',abrir);
      card.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();abrir();}});
    });
    const params = new URLSearchParams(window.location.search);
    const subjectInput = $('#assunto-chamado');
    const messageInput = $('#mensagem-chamado');
    const requestedSubject = params.get('assunto');
    const requestedMessage = params.get('mensagem');
    const trackingCode = params.get('codigo');
    if (subjectInput && requestedSubject) subjectInput.value = requestedSubject;
    if (messageInput && requestedMessage) messageInput.value = requestedMessage;
    else if (messageInput && trackingCode) messageInput.value = `Olá, preciso de ajuda com a entrega ${trackingCode}.`;
    const load=async()=>{
      const result=await requestTodasPaginas('/chamados');
      if(!host)return;
      host.replaceChildren();
      const items = (result.dados || []).slice().reverse();
      items.forEach(ticket => {
        const group = el('div', 'chat-group');
        group.append(el('span', 'chat-divider', `${ticket.assunto} · ${ticket.status}`));
        const outgoing = el('div', 'balao-chat cliente');
        outgoing.append(el('p', '', ticket.mensagem), el('small', '', `Você · ${safeDate(ticket.createdAt)}`));
        group.append(outgoing);
        if (ticket.resposta) {
          const incoming = el('div', 'balao-chat agente');
          incoming.append(el('p', '', ticket.resposta), el('small', '', `Equipe UrbanLink · ${safeDate(ticket.updatedAt)}`));
          group.append(incoming);
        }
        host.append(group);
      });
      if(!items.length)host.append(el('p','estado-vazio','Ainda não há mensagens. Escreva abaixo para abrir um atendimento.'));
      host.scrollTop=host.scrollHeight;
    };
    $('#atendimento-atualizar')?.addEventListener('click', () => load().catch(error => message(error.message,'erro')));
    if(form)form.addEventListener('submit',async e=>{
      e.preventDefault();
      try{
        await request('/chamados',{method:'POST',body:{assunto:val('assunto-chamado')||'Atendimento geral',mensagem:val('mensagem-chamado')}});
        form.reset();
        if (subjectInput) subjectInput.value = '';
        message('Mensagem enviada. A equipe responderá por esta tela.','sucesso');
        await load();
      }catch(error){message(error.message,'erro');}
    });
    await load();
  }

  async function adminMessagesPage() {
    const list = $('#admin-chamados-lista');
    const search = $('#admin-busca-mensagens');
    const filter = $('#admin-filtro-status-mensagem');
    const refresh = $('#admin-atualizar-mensagens');
    let tickets = [];

    const updateSummary = () => {
      const counts = {
        abertos: tickets.filter(item => item.status === 'Aberto').length,
        andamento: tickets.filter(item => item.status === 'Em atendimento').length,
        resolvidos: tickets.filter(item => item.status === 'Resolvido').length
      };
      $('#mensagens-total') && ($('#mensagens-total').textContent = String(tickets.length));
      $('#mensagens-abertas') && ($('#mensagens-abertas').textContent = String(counts.abertos));
      $('#mensagens-andamento') && ($('#mensagens-andamento').textContent = String(counts.andamento));
      $('#mensagens-resolvidas') && ($('#mensagens-resolvidas').textContent = String(counts.resolvidos));
    };

    const render = () => {
      if (!list) return;
      const query = (search?.value || '').trim().toLocaleLowerCase('pt-BR');
      const selectedStatus = filter?.value || 'Todos';
      const filtered = tickets.filter(ticket => {
        const customer = ticket.usuario || {};
        const haystack = `${customer.nome || ''} ${customer.email || ''} ${ticket.assunto || ''} ${ticket.mensagem || ''} ${ticket.resposta || ''}`.toLocaleLowerCase('pt-BR');
        return (!query || haystack.includes(query)) && (selectedStatus === 'Todos' || ticket.status === selectedStatus);
      });
      list.replaceChildren();
      if (!filtered.length) {
        list.append(el('div', 'admin-messages-empty', tickets.length ? 'Nenhuma mensagem corresponde aos filtros selecionados.' : 'Ainda não há mensagens de clientes. Quando alguém abrir um chamado, ele aparecerá aqui.'));
        return;
      }

      filtered.forEach(ticket => {
        const customer = ticket.usuario || {};
        const card = el('article', 'admin-message-card');
        const top = el('div', 'admin-message-top');
        const sender = el('div', 'admin-message-sender');
        sender.append(el('strong', '', customer.nome || 'Cliente sem identificação'));
        sender.append(el('small', '', customer.email || 'E-mail não informado'));
        const status = el('span', `admin-message-status status-${String(ticket.status || '').toLowerCase().replace(/\s+/g, '-')}`, ticket.status || 'Aberto');
        top.append(sender, status);
        card.append(top);
        card.append(el('h2', 'admin-message-subject', ticket.assunto || 'Atendimento geral'));
        card.append(el('p', 'admin-message-date', `Recebida em ${safeDate(ticket.createdAt)}`));
        const dialogue = el('div', 'admin-message-dialogue');
        const body = el('div', 'chat-bubble is-received');
        body.append(el('p', '', ticket.mensagem || 'Mensagem não disponível.'), el('small', '', `${customer.nome || 'Cliente'} · ${safeDate(ticket.createdAt)}`));
        dialogue.append(body);

        if (ticket.resposta) {
          const previous = el('div', 'chat-bubble is-sent');
          previous.append(el('p', '', ticket.resposta), el('small', '', `Você / equipe UrbanLink · ${safeDate(ticket.updatedAt)}`));
          dialogue.append(previous);
        }

        card.append(dialogue);
        const form = el('form', 'admin-message-reply-form');
        const label = el('label', '', ticket.resposta ? 'Atualizar resposta' : 'Responder ao cliente');
        const textarea = el('textarea', '');
        textarea.name = 'resposta';
        textarea.rows = 3;
        textarea.maxLength = 3000;
        textarea.required = true;
        textarea.placeholder = 'Escreva uma resposta clara para o cliente…';
        textarea.value = '';
        label.append(textarea);
        const controls = el('div', 'admin-message-reply-controls');
        const statusLabel = el('label', 'admin-message-status-field', 'Após responder');
        const statusSelect = el('select', '');
        [['Em atendimento', 'Manter em atendimento'], ['Resolvido', 'Marcar como resolvido']].forEach(([value, text]) => {
          const option = el('option', '', text);
          option.value = value;
          statusSelect.append(option);
        });
        statusSelect.value = ticket.status === 'Resolvido' ? 'Resolvido' : 'Em atendimento';
        statusLabel.append(statusSelect);
        const submit = el('button', 'botao botao-primario admin-message-send', 'Enviar resposta');
        submit.type = 'submit';
        controls.append(statusLabel, submit);
        form.append(label, controls);
        form.addEventListener('submit', async event => {
          event.preventDefault();
          const reply = textarea.value.trim();
          if (reply.length < 2) {
            message('Escreva uma resposta antes de enviar.', 'erro', form);
            textarea.focus();
            return;
          }
          submit.disabled = true;
          submit.textContent = 'Enviando…';
          try {
            await request(`/chamados/${ticket.id}`, {
              method: 'PATCH',
              body: { resposta: reply, status: statusSelect.value }
            });
            message(`Resposta enviada para ${customer.nome || 'o cliente'}.`, 'sucesso');
            await load();
          } catch (error) {
            message(error.message, 'erro', form);
          } finally {
            submit.disabled = false;
            submit.textContent = 'Enviar resposta';
          }
        });
        card.append(form);
        list.append(card);
      });
    };

    const load = async () => {
      if (refresh) { refresh.disabled = true; refresh.textContent = 'Atualizando…'; }
      try {
        const result = await requestTodasPaginas('/chamados?perfil=Cliente');
        tickets = result.dados || [];
        updateSummary();
        render();
      } catch (error) {
        if (list) list.replaceChildren(el('div', 'admin-messages-empty admin-messages-error', error.message));
        throw error;
      } finally {
        if (refresh) { refresh.disabled = false; refresh.textContent = 'Atualizar mensagens'; }
      }
    };

    search?.addEventListener('input', render);
    filter?.addEventListener('change', render);
    refresh?.addEventListener('click', () => load().catch(() => {}));
    await load();
  }

  // Rótulos para tabelas que viram cartões em telas pequenas.
  // Atualiza também as linhas geradas após consultas à API, sem mudar as requisições.
  function enableResponsiveTableLabels() {
    $$('table.tabela-pedidos, table.sim-history-table').forEach(table => {
      const titles = $$('thead th', table).map((heading, index, all) => {
        const label = heading.textContent.trim();
        return label || (index === 0 && heading.querySelector('input[type="checkbox"]') ? 'Selecionar' : 'Ações');
      });
      const tbody = $('tbody', table);
      if (!tbody) return;
      const applyLabels = () => {
        $$('tr', tbody).forEach(row => {
          $$('td', row).forEach((cell, index) => {
            if (cell.hasAttribute('colspan')) return;
            cell.dataset.label = titles[index] || 'Informação';
          });
        });
      };
      applyLabels();
      new MutationObserver(applyLabels).observe(tbody, { childList: true });
    });
  }

  function enablePageTransitions() {
    document.addEventListener('click', event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest('a[href]');
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
      const raw = link.getAttribute('href') || '';
      if (!raw || raw.startsWith('#') || /^(mailto:|tel:|javascript:)/i.test(raw)) return;
      let destination;
      try { destination = new URL(raw, window.location.href); } catch { return; }
      if (destination.origin !== window.location.origin || destination.pathname === window.location.pathname && destination.search === window.location.search) return;
      event.preventDefault();
      document.body.classList.add('page-exit');
      window.setTimeout(() => { window.location.assign(destination.href); }, 170);
    });
  }

  function globalActions() {
    $$('a[data-aviso]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();message(a.dataset.aviso,'info');}));
    $$('[data-action="nova-entrega"]').forEach(b=>b.addEventListener('click',()=>{window.location.href='entrega-motorista.html';}));
    $$('[data-action="gestao-entregas"]').forEach(b=>b.addEventListener('click',()=>{window.location.href='entrega-motorista.html';}));
    $$('[data-action="mapa"]').forEach(b=>b.addEventListener('click',()=>{window.location.href='mapa-rotas.html';}));
    $$('[data-action="admin-messages"]').forEach(b=>b.addEventListener('click',()=>{window.location.href='admin-mensagens.html';}));

    const respostasFaq = [
      'Entre na sua conta, informe o código da entrega no campo “Rastrear uma entrega” ou abra Acompanhamento. O sistema mostra o status e o histórico registrado.',
      'O endereço não pode ser editado diretamente depois do envio. Abra um chamado o quanto antes. Enquanto a entrega estiver Pendente ou Aguardando coleta, você pode cancelá-la e criar uma solicitação com o endereço correto.',
      'Entre em contato pelo atendimento e informe o código do pedido. Não considere a entrega concluída até que o sistema registre o status “Entregue”.',
      'O sistema ainda não possui um fluxo automático de devolução. Abra um chamado informando o código da entrega e o motivo para receber orientação da equipe.',
      'A recuperação automática por e-mail não está configurada nesta versão. Solicite ao administrador responsável que oriente a redefinição de acesso.'
    ];
    $$('.item-faq').forEach((item,index)=>{
      if (item.dataset.faqReady === 'true') return;
      const answer = el('p','resposta-faq',respostasFaq[index] || 'Entre em contato pelo formulário de atendimento para receber orientação.');
      answer.hidden = true;
      answer.style.cssText = 'margin:8px 0 12px; padding:0 12px 10px; color:#687386; font-size:.86rem; line-height:1.5;';
      item.after(answer);
      item.setAttribute('role','button');
      item.setAttribute('tabindex','0');
      item.setAttribute('aria-expanded','false');
      const toggle=()=>{
        const open=answer.hidden;
        answer.hidden=!open;
        item.setAttribute('aria-expanded',String(open));
        const plus=$('.icone-mais',item);
        if(plus)plus.textContent=open?'−':'+';
      };
      item.addEventListener('click',toggle);
      item.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggle();}});
      item.dataset.faqReady='true';
    });

    $('#baixar-proposta')?.addEventListener('click',()=>{
      const link=el('a');link.href='./assets/proposta-patrocinio-urbanlink.txt';link.download='proposta-patrocinio-urbanlink.txt';
      document.body.append(link);link.click();link.remove();
    });
    $('#falar-equipe')?.addEventListener('click',()=>{
      const target='atendimento-cliente.html?assunto='+encodeURIComponent('Interesse em parceria e patrocínio');
      if (!token()) { message('Entre na sua conta para enviar uma mensagem à equipe de atendimento.','info'); window.location.href='login.html'; return; }
      window.location.href=target;
    });
  }

  async function init() {
    clearLegacyThemePreference();
    setupProfileLogout();
    ensureGlobalFooter();
    enablePageTransitions();
    enableResponsiveTableLabels();
    globalActions();
    loginPage();
    cadastroPage();
    const page=document.body.dataset.page || '';
    if(!['login','cadastro',''].includes(page)){
      const user=await protectPage();
      if(!user)return;
      if(page==='vehicle-registration') await vehicleRegistrationPage(user);
      else if(page==='customer-dashboard') await carregarDashboardCliente();
      else if(page==='customer-delivery') await customerDeliveryPage(user);
      else if(page==='tracking') await trackingPage(user);
      else if(page==='admin-dashboard') await carregarAdmin();
      else if(page==='admin-messages') await adminMessagesPage();
      else if(page==='manage-deliveries') await manageDeliveriesPage(user);
      else if(page==='driver-dashboard') await driverDashboardPage(user);
      else if(page==='driver-route') await routePage(user);
      else if(page==='simulations') await simulationPage();
      else if(page==='support') await supportPage();
    }
    // Populate the profile area on informational pages that do not use a guard.
    if(!document.body.dataset.role && token()) {
      const profile=await carregarPerfil();
      adjustNavigation(profile);
      updateFooterSupportLink(profile);
    }
  }

  document.addEventListener('DOMContentLoaded',()=>init().catch(error=>message(error.message,'erro')));
})();
