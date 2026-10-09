// Carga de respaldo automática para garantizar que el tablero siempre se dibuje
async function forzarCargaTablero() {
  const grid = document.getElementById('board-grid');
  if (!grid || grid.children.length > 0) return;

  try {
    const resQ = await fetch('/api/questions');
    const resS = await fetch('/api/state');
    questionsData = await resQ.json();
    gameState = await resS.json();
    renderBoard();
  } catch (e) {
    console.error("Error al cargar de respaldo:", e);
  }
}

// Ejecutar respaldo automáticamente
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(forzarCargaTablero, 500);
});
