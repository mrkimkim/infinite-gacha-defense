export type Candidate = 'nuri' | 'popo';
export type Pose = 'idle' | 'attack' | 'recovery';
export const POSES: readonly Pose[] = ['idle', 'attack', 'recovery'];
export const sources = {
  nuri: { label: '누리 v03', height: 625, files: ['nuri/raw.png'],
    frames: [[132,41,499,636,354.5,671], [774,43,648,635,1051,673], [1542,43,525,635,1770.5,673]] },
  popo: { label: '포포 v5', height: 681, files: POSES.map(p => `popo/${p}.png`),
    frames: POSES.map(() => [0,0,896,768,448,704]) },
} as const;
export async function loadCandidate(candidate: Candidate): Promise<HTMLImageElement[]> {
  return Promise.all(sources[candidate].files.map(file => new Promise<HTMLImageElement>((resolve,reject) => {
    const image = new Image(); const timeout = setTimeout(() => finish(new Error('이미지 응답 시간 초과')), 10000);
    const finish = (error?: Error) => { clearTimeout(timeout); image.onload = null; image.onerror = null; if(error) reject(error); else resolve(image); };
    image.onload = () => { const expected = candidate === 'nuri' ? [2158,729] : [896,768]; finish(image.naturalWidth === expected[0] && image.naturalHeight === expected[1] ? undefined : new Error('이미지 치수 불일치')); }; image.onerror = () => finish(new Error('이미지 로드 실패'));
    image.src = `./assets/art-review/${file}`;
  })));
}
export function drawCandidate(ctx: CanvasRenderingContext2D, candidate: Candidate, images: HTMLImageElement[], pose: Pose, size: number, x: number, y: number, facing: number) {
  const source = sources[candidate], index = POSES.indexOf(pose), [sx,sy,w,h,px,py] = source.frames[index], scale = size/source.height;
  ctx.save();ctx.translate(x,y);ctx.scale(facing,1);ctx.imageSmoothingEnabled = true;ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(images[candidate === 'nuri' ? 0 : index],sx,sy,w,h,(sx-px)*scale,(sy-py)*scale,w*scale,h*scale);ctx.restore();
}
