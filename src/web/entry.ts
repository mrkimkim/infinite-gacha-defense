export {};

/** The layout checkpoint is explicitly inert; the existing game remains the default. */
if (new URLSearchParams(window.location.search).get('screen') === 'v2-layout') {
  const { createV2Shell } = await import('./v2-shell.ts');
  const root = document.getElementById('app');
  if (!root) throw new Error('Missing app host');
  root.classList.remove('shop');
  document.body.classList.add('v2-page');
  createV2Shell(root);
  document.title = '무한의 가챠 디펜스 · v2 화면 구조 시안';
} else {
  await import('./main.ts');
}
