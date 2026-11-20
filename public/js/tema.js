(() => {
  const chave = 'urbanlink_tema';
  const logos = { light: './assets/logo.png', dark: './assets/logo-branca.png' };

  function aplicar(tema) {
    const modoEscuro = tema === 'dark';
    document.documentElement.dataset.theme = modoEscuro ? 'dark' : 'light';
    const logoAtual = modoEscuro ? logos.light : logos.dark;
    const logoDoTema = modoEscuro ? logos.dark : logos.light;
    document.querySelectorAll(`img[src="${logoAtual}"]`).forEach(img => {
      img.src = logoDoTema;
    });
  }

  try { aplicar(localStorage.getItem(chave)); } catch { aplicar('light'); }
  document.addEventListener('DOMContentLoaded', () => aplicar(document.documentElement.dataset.theme), { once: true });

  window.addEventListener('storage', event => {
    if (event.key === chave || event.key === null) aplicar(event.newValue);
  });
  window.alternarTemaUrbanLink = () => {
    const tema = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    aplicar(tema);
    try { localStorage.setItem(chave, tema); } catch { /* O tema continua ativo nesta tela. */ }
  };
})();
