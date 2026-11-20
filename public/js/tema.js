(() => {
  const chave = 'urbanlink_tema';

  function aplicar(tema) {
    document.documentElement.dataset.theme = tema === 'dark' ? 'dark' : 'light';
  }

  try { aplicar(localStorage.getItem(chave)); } catch { aplicar('light'); }

  window.addEventListener('storage', event => {
    if (event.key === chave || event.key === null) aplicar(event.newValue);
  });
  window.alternarTemaUrbanLink = () => {
    const tema = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    aplicar(tema);
    try { localStorage.setItem(chave, tema); } catch { /* O tema continua ativo nesta tela. */ }
  };
})();
