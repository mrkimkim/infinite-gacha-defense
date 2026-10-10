export {};

const query = new URLSearchParams(window.location.search);
const screen = query.get('screen');
if (screen === 'v2-layout' || screen === 'v2') {
  const root = document.getElementById('app');
  if (!root) throw new Error('Missing app host');
  root.classList.remove('shop');
  document.body.classList.add('v2-page');
  if (screen === 'v2-layout') {
    const { createV2Shell } = await import('./v2-shell.ts');
    createV2Shell(root);
    document.title = '무한의 가챠 디펜스 · v2 화면 구조 시안';
  } else {
    try {
      const core = await import('../core-v2/index.ts');
      const { mountV2Game } = await import('./v2-main.ts');
      const seedText = query.get('seed') ?? '1';
      if (!/^[1-9][0-9]*$/.test(seedText)) throw new Error('BAD_SEED');
      const seed = Number(seedText);
      const rulesId = query.get('rules') ?? core.EXPERIMENT_RULES_ID;
      const rules = core.getRules(rulesId);
      if (!rules) throw new Error('UNKNOWN_RULES');
      mountV2Game(root, core, seed, rules.rulesId);
      document.title = '무한의 가챠 디펜스 · schema3 기술 실험';
    } catch (error) {
      const message = document.createElement('p');
      message.setAttribute('role', 'alert');
      message.textContent = `기술 실험을 시작하지 못했습니다: ${error instanceof Error ? error.message : String(error)}`;
      root.replaceChildren(message);
    }
  }
} else {
  await import('./main.ts');
}
