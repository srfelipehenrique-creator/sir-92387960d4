let siglasLoaded = false;

function openSiglas() {
  const overlay = document.getElementById('siglas-modal');
  const iframe  = document.getElementById('siglas-iframe');

  /* Carrega o arquivo só na primeira abertura (evita recarregar 21 MB toda vez) */
  if (!siglasLoaded) {
    iframe.src = 'tools/buscador_siglas.html';
    siglasLoaded = true;
  }

  overlay.classList.add('active');
}

function closeSiglas() {
  document.getElementById('siglas-modal').classList.remove('active');
}
