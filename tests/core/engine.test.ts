import assert from 'node:assert/strict';
import test from 'node:test';
import { createMatch, dispatch, advance, observe, getRules, pathPosition, boardPosition,
  canonicalState, stateHash, replay, DEFAULT_RULES_ID } from '../../src/core/index.ts';
import type { MatchState, Unit, Enemy, Command, ReplayHeader } from '../../src/core/index.ts';
import { nextRandom, RULE_DATA, RULES_DIGEST } from '../../src/core/rules.ts';
import { canonicalJson, sha256 } from '../../src/core/serialization.ts';

type Mutable<T> = T extends object ? { -readonly [K in keyof T]: Mutable<T[K]> } : T;
function initial(seed = 2): MatchState {
  const result = createMatch(seed); assert.equal(result.ok, true);
  if (!result.ok) throw new Error('creation failed'); return result.state;
}
function send(state: MatchState, command: Command): MatchState {
  const result = dispatch(state, command); assert.equal(result.ok, true, JSON.stringify(result));
  if (!result.ok) throw new Error('dispatch failed'); return result.state;
}
function run(state: MatchState, count: number): MatchState {
  const result = advance(state, count); assert.equal(result.ok, true);
  if (!result.ok) throw new Error('advance failed'); return result.state;
}
function header(state: MatchState): ReplayHeader {
  return { schemaVersion: state.schemaVersion, rulesId: state.rulesId, rulesDigest: state.rulesDigest, seed: state.seed };
}
function recruit(state = initial(), col = 0, row = 0, offerSlot = 0): MatchState {
  return send(state, { type: 'recruit', offerSlot, to: { kind: 'board', col, row } });
}
function frozen<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(frozen); Object.freeze(value); }
  return value;
}
/** Diagnostic states are test-only controlled fixtures, never normal match/balance evidence. */
function combat(units: readonly Unit[], enemies: readonly Enemy[], extra: Partial<MatchState> = {}): MatchState {
  return { ...initial(), phase: 'combat', units, enemies, spawnCursor: 5, nextEntityId: 100, ...extra };
}
function unit(id = 1, col = 0, row = 0, typeId: 'single' | 'splash' = 'single', cooldown = 0): Unit {
  return { id, typeId, star: 1, location: { kind: 'board', col, row }, cooldown };
}
function enemy(id = 10, distance = 0, hp = 100): Enemy { return { id, typeId: 'basic', distance, hp }; }
function rejected(state: MatchState, command: unknown, code?: string): void {
  const before = structuredClone(state), bytes = canonicalState(state);
  const result = dispatch(frozen(state), command);
  assert.equal(result.ok, false);
  if (result.ok) throw new Error('accepted invalid command');
  assert.strictEqual(result.state, state);
  if (code) assert.equal(result.error.code, code);
  assert.deepEqual(state, before); assert.equal(canonicalState(state), bytes);
}

test('initial rules, seed constraints, vectors, and three draws are exact', () => {
  for (const seed of [0, -1, 4294967296, 1.2, NaN, Infinity, '2', null]) assert.equal(createMatch(seed).ok, false);
  assert.equal(createMatch(1, 'growth').ok, false);
  assert.equal(createMatch(4294967295).ok, true);
  const state = initial(1);
  assert.equal(nextRandom(1), 270369); assert.equal(nextRandom(270369), 67634689);
  assert.equal(nextRandom(67634689), 2647435461);
  assert.equal(state.rngState, 2647435461); assert.equal(state.nextEntityId, 1);
  assert.deepEqual(state.offers, [0, 1, 2].map(slot => ({ slot, typeId: 'splash' })));
  assert.equal(state.gold, 6); assert.equal(state.lives, 10); assert.equal(state.phase, 'preparation');
  assert.equal(state.wave, 1); assert.equal(state.tick, 0); assert.equal(state.waveTick, 0);
  assert.equal(RULES_DIGEST, sha256(canonicalJson(RULE_DATA)));
  assert.equal(getRules('growth'), null); assert.equal(getRules()!.rulesId, DEFAULT_RULES_ID);
});

test('closed path corner/seam boundaries and all sixteen centers', () => {
  const cases = [[0,-500,-500],[4999,4499,-500],[5000,4500,-500],[9999,4500,4499],
    [10000,4500,4500],[14999,-499,4500],[15000,-500,4500],[19999,-500,-499]];
  for (const [d,x,y] of cases) assert.deepEqual(pathPosition(d), {x,y});
  for (const d of [-1,20000,Infinity,NaN,0.5]) assert.equal(pathPosition(d), null);
  for (let row=0;row<4;row++) for (let col=0;col<4;col++) assert.deepEqual(boardPosition(col,row), {x:500+1000*col,y:500+1000*row});
  for (const [col,row] of [[-1,0],[4,0],[0,4],[0,0.5]]) assert.equal(boardPosition(col,row), null);
});

test('all malformed command families reject atomically including accessors and sparse arrays', () => {
  const state = recruit();
  const bad: unknown[] = [null, [], {}, 'startWave', {type:'startWave', extra:1},
    {type:'sell',unitId:1}, {type:'move',unitId:1},
    {type:'move',unitId:NaN,to:{kind:'board',col:0,row:1}},
    {type:'recruit',offerSlot:Infinity,to:{kind:'board',col:0,row:1}},
    {type:'recruit',offerSlot:0.5,to:{kind:'board',col:0,row:1}},
    {type:'recruit',offerSlot:0,to:{kind:'board',col:4,row:1}},
    {type:'recruit',offerSlot:0,to:{kind:'board',col:0,row:1,extra:1}},
    {type:'merge',ids:[1,,3],keepId:1}, {type:'merge',ids:[1,2,3,4],keepId:1},
    Object.assign(Object.create({}), {type:'startWave'}),
    Object.defineProperty({}, 'type', {get(){throw new Error('getter executed');}, enumerable:true}),
    Object.assign({type:'startWave'}, {[Symbol('hidden')]:1}),
    Object.defineProperty({type:'startWave'}, 'hidden', {value:1}),
  ];
  for (const payload of bad) rejected(state, payload, 'BAD_FORMAT');
  rejected(state, {type:'merge',ids:[1,1,1],keepId:1}, 'BAD_FORMAT');
  rejected(state, {type:'merge',ids:[1,2,3],keepId:4}, 'BAD_FORMAT');
  rejected(state, {type:'merge',ids:[1,2,3],keepId:1}, 'UNSUPPORTED_COMMAND');
  rejected(state, {type:'recruit',offerSlot:0,to:{kind:'bench',slot:0}}, 'BAD_LOCATION');
});

test('recruit pays once, generates one ID/draw, snapshots input/log/events deeply', () => {
  const state = initial(), before = structuredClone(state);
  const command = {type:'recruit' as const,offerSlot:1,to:{kind:'board' as const,col:0,row:0}};
  const result = dispatch(frozen(state), command); assert.equal(result.ok,true); if (!result.ok) return;
  assert.deepEqual(state,before); assert.notStrictEqual(result.state,state);
  assert.equal(result.state.gold,4); assert.equal(result.state.nextEntityId,2);
  assert.equal(result.state.rngState,nextRandom(state.rngState));
  assert.equal(result.state.units[0].id,1);
  assert.deepEqual(result.state.offers[0],state.offers[0]); assert.deepEqual(result.state.offers[2],state.offers[2]);
  command.to.col=3;
  assert.equal(result.state.units[0].location.kind==='board' && result.state.units[0].location.col,0);
  const log=result.state.acceptedLog[0]; assert.equal(log.type,'command');
  if(log.type==='command') assert.equal(log.command.type==='recruit' && log.command.to.kind==='board' && log.command.to.col,0);
  const events=result.events as Mutable<typeof result.events>; events[0].location={kind:'board',col:2,row:2};
  assert.equal(result.state.units[0].location.kind==='board' && result.state.units[0].location.col,0);
  if(log.type==='command') assert.equal(log.events[0].location.kind==='board' && log.events[0].location.col,0);
});

test('free moves/swaps and atomic rejection of occupied, absent, same, duplicate, capacity and funds', () => {
  let state = recruit(); state=recruit(state,1,0); state=recruit(state,2,0);
  rejected(state,{type:'recruit',offerSlot:0,to:{kind:'board',col:3,row:0}},'INSUFFICIENT_GOLD');
  rejected(state,{type:'move',unitId:1,to:{kind:'board',col:0,row:0}},'SAME_LOCATION');
  rejected(state,{type:'move',unitId:1,to:{kind:'board',col:1,row:0}},'LOCATION_OCCUPIED');
  rejected(state,{type:'move',unitId:999,to:{kind:'board',col:3,row:0}},'UNIT_NOT_FOUND');
  rejected(state,{type:'swap',aId:1,bId:1},'DUPLICATE_ID');
  rejected(state,{type:'swap',aId:1,bId:99},'UNIT_NOT_FOUND');
  const moved=send(state,{type:'move',unitId:1,to:{kind:'board',col:3,row:3}});
  assert.equal(moved.gold,state.gold); assert.equal(moved.rngState,state.rngState);
  const swapped=send(moved,{type:'swap',aId:1,bId:2});
  assert.deepEqual(swapped.units[0].location,moved.units[1].location);
  assert.deepEqual(swapped.units[1].location,moved.units[0].location);
  const full={...swapped,gold:10,units:[...swapped.units,unit(4,0,3)]};
  rejected(full,{type:'recruit',offerSlot:0,to:{kind:'board',col:2,row:3}},'CAPACITY_REACHED');
  const across=send(full,{type:'move',unitId:1,to:{kind:'board',col:2,row:3}}); assert.equal(across.units.length,4);
});

test('rejected input does not alter later RNG/IDs/state/log', () => {
  const state=initial(); rejected(state,{type:'startWave'},'NO_BOARD_UNITS');
  const a=recruit(state), b=recruit(initial()); assert.deepEqual(a,b);
  const started=send(a,{type:'startWave'});
  rejected(started,{type:'move',unitId:1,to:{kind:'board',col:1,row:1}},'BAD_PHASE');
  assert.deepEqual(run(started,10),run(send(b,{type:'startWave'}),10));
});

test('advance count and phase rejection preserve exact input identity', () => {
  for(const state of [initial(),combat([unit()],[enemy()]),{...initial(),phase:'result' as const,outcome:'win' as const}]) {
    for(const count of [0,-1,10001,1.1,NaN,Infinity,'1',null]) {
      const before=structuredClone(state), result=advance(frozen(state),count);
      assert.equal(result.ok,false); assert.strictEqual(result.state,state); assert.equal(result.executedTicks,0); assert.deepEqual(state,before);
    }
  }
  assert.equal(advance(initial(),1).ok,false);
  assert.equal(advance({...initial(),phase:'result'},1).ok,false);
});

test('spawn before attack, cooldown decrement and exact attack interval', () => {
  const start=send(recruit(initial()),{type:'startWave'});
  const result=advance(frozen(start),21); assert.equal(result.ok,true); if(!result.ok)return;
  assert.equal(start.enemies.length,0); assert.equal(start.tick,0);
  const spawns=result.events.filter(e=>e.type==='enemySpawned'); assert.deepEqual(spawns.map(e=>e.tick),[0,10,20]);
  const attacks=result.events.filter(e=>e.type==='attack'); assert.deepEqual(attacks.map(e=>e.tick),[0,10,20]);
  assert.equal(result.events[0].type,'enemySpawned'); assert.equal(result.events[1].type,'attack');
  const empty=advance(combat([unit(1,0,0,'single',1)],[enemy(10,9500)]),1);
  assert.equal(empty.state.units[0].cooldown,0);
});

test('range boundary includes equality, excludes one beyond, and prioritizes distance then numeric ID', () => {
  // Unit (500,500), left edge (-500,y): use top edge y=-500 and x=500 for distance 1000.
  // Exact 3000 boundary uses unit (500,2500) and enemy at (500,-500), d=1000.
  for(const [d,hit] of [[1000,true],[999,false],[1001,false]] as const) {
    const result=advance(combat([unit(1,0,2)],[enemy(10,d)]),1); assert.equal(result.ok,true); if(!result.ok)return;
    assert.equal(result.events.some(e=>e.type==='attack'),hit);
  }
  const result=advance(combat([unit()],[enemy(20,1000),enemy(11,2000),enemy(10,2000)]),1);
  assert.equal(result.ok,true); if(!result.ok)return;
  const attack=result.events.find(e=>e.type==='attack'); assert.equal(attack?.targetId,10);
});

test('sequential attacks retarget after immediate removal and preserve numeric unit order', () => {
  const result=advance(combat([unit(2),unit(1)],[enemy(11,1000,4),enemy(10,1000,4)]),1);
  assert.equal(result.ok,true); if(!result.ok)return;
  const attacks=result.events.filter(e=>e.type==='attack');
  assert.deepEqual(attacks.map(e=>[e.unitId,e.targetId]),[[1,10],[2,11]]);
  assert.equal(result.state.enemies.length,0);
});

test('splash boundary, ID order, and collateral beyond attacker range', () => {
  // Main at (500,-500), attacker (500,2500): main exactly range3000.
  // Secondary (-500,-500) lies outside attack range but radius1000 from main.
  const result=advance(combat([unit(1,0,2,'splash')],[enemy(30,2001),enemy(20,0),enemy(10,1000),enemy(40,2000),enemy(50,1999)]),1);
  assert.equal(result.ok,true); if(!result.ok)return;
  const attack=result.events.find(e=>e.type==='attack'); assert.equal(attack?.targetId,10);
  assert.deepEqual(attack?.hits.map(h=>h.enemyId),[10,20,40,50]);
  assert.equal(result.state.enemies.find(e=>e.id===30)!.hp,100);
});

test('bench fixture neither attacks nor decrements cooldown', () => {
  const bench:Unit={...unit(),location:{kind:'bench',slot:0},cooldown:5};
  const result=advance(combat([bench],[enemy()]),1); assert.equal(result.ok,true); if(!result.ok)return;
  assert.equal(result.state.units[0].cooldown,5); assert.equal(result.events.some(e=>e.type==='attack'),false);
});

test('exact/overshoot leak removes once; kill before movement wins race; failure precedes wave completion', () => {
  for(const distance of [19900,19999]) {
    const result=advance(combat([],[enemy(10,distance)],{lives:1,wave:5,spawnCursor:13}),10);
    assert.equal(result.ok,true); if(!result.ok)return;
    assert.equal(result.executedTicks,1); assert.equal(result.state.lives,0); assert.equal(result.state.outcome,'loss');
    assert.equal(result.events.filter(e=>e.type==='enemyLeaked').length,1);
    assert.equal(result.events.some(e=>e.type==='waveCompleted'),false);
    assert.equal(advance(result.state,1).ok,false);
  }
  const before=run(combat([],[enemy(10,19899)]),1); assert.equal(before.enemies[0].distance,19999); assert.equal(before.lives,10);
  const killed=advance(combat([unit()],[enemy(10,19999,4)],{lives:1}),1);
  assert.equal(killed.ok,true); if(!killed.ok)return;
  assert.equal(killed.state.lives,1); assert.equal(killed.events.some(e=>e.type==='enemyLeaked'),false);
});

test('wave transition reward/candidates and early stop happen exactly once', () => {
  const state=combat([],[enemy(10,19999)]), result=advance(state,10000);
  assert.equal(result.ok,true); if(!result.ok)return;
  assert.equal(result.executedTicks,1); assert.equal(result.state.phase,'preparation'); assert.equal(result.state.wave,2);
  assert.equal(result.state.gold,9); assert.equal(result.state.spawnCursor,0); assert.equal(result.state.waveTick,0);
  assert.equal(result.state.rngState,nextRandom(nextRandom(nextRandom(state.rngState))));
  assert.equal(advance(result.state,1).ok,false);
  const final=advance(combat([],[enemy(10,19999)],{wave:5,spawnCursor:13}),1);
  assert.equal(final.state.outcome,'win'); assert.equal(final.state.gold,6); assert.equal(final.state.rngState,state.rngState);
});

test('batching changes only accepted logs at same actual end tick', () => {
  const start=send(recruit(),{type:'startWave'});
  const bulk=run(start,100); let singles=start;
  for(let i=0;i<100&&singles.phase==='combat';i++) singles=run(singles,1);
  assert.equal(canonicalState(bulk),canonicalState(singles)); assert.equal(stateHash(bulk),stateHash(singles));
  assert.notDeepEqual(bulk.acceptedLog,singles.acceptedLog);
  const early=run(start,10000); let stepped=start;
  while(stepped.phase==='combat') stepped=run(stepped,1);
  assert.equal(canonicalState(early),canonicalState(stepped));
});

test('observe and rules return detached current values, without private/future data', () => {
  const state=run(send(recruit(),{type:'startWave'}),1), before=structuredClone(state);
  const observation=observe(state) as Mutable<ReturnType<typeof observe>>;
  for(const key of ['seed','rngState','nextEntityId','spawnCursor','acceptedLog','header','waves']) assert.equal(Object.hasOwn(observation,key),false);
  assert.equal(Object.hasOwn(observation.rules,'waves'),false);
  observation.units[0].cooldown=999; observation.offers[0].typeId='splash'; observation.enemies[0].hp=-1;
  observation.rules.units.single.damage=999; observation.rules.path.vertices[0].x=0;
  assert.deepEqual(state,before); assert.equal(getRules()!.units.single.damage,4);
  assert.equal(getRules()!.path.vertices[0].x,-500);
});

test('canonical includes exact projection, excludes log, sorts IDs/keys, and retains every field', () => {
  const state=recruit(), parsed=JSON.parse(canonicalState(state));
  assert.deepEqual(Object.keys(parsed),['schemaVersion','rulesId','rulesDigest','seed','rngState','nextEntityId','tick','phase','outcome','wave','waveTick','spawnCursor','lives','gold','offers','units','enemies'].sort());
  assert.equal(canonicalState({...state,acceptedLog:[]}),canonicalState(state));
  for(const key of ['schemaVersion','rulesId','rulesDigest','seed','rngState','nextEntityId','tick','phase','outcome','wave','waveTick','spawnCursor','lives','gold'] as const) {
    const changed={...state,[key]: typeof state[key]==='number' ? Number(state[key])+1 : 'different'} as MatchState;
    assert.notEqual(canonicalState(changed),canonicalState(state),key);
  }
  const many={...state,units:[unit(10),unit(2)],enemies:[enemy(11),enemy(3)]};
  assert.deepEqual(JSON.parse(canonicalState(many)).units.map((u:Unit)=>u.id),[2,10]);
});

test('safe integer overflow returns original state without partial draw or tick', () => {
  rejected({...initial(),nextEntityId:Number.MAX_SAFE_INTEGER},{type:'recruit',offerSlot:0,to:{kind:'board',col:0,row:0}},'INTEGER_OVERFLOW');
  const state=combat([],[enemy()],{tick:Number.MAX_SAFE_INTEGER}); const before=structuredClone(state);
  const result=advance(state,1); assert.equal(result.ok,false); assert.strictEqual(result.state,state); assert.deepEqual(state,before);
});

test('five-wave simulation has deterministic replay and same-seed restart', () => {
  function play():MatchState {
    let state=initial(2); for(const [col,row] of [[0,0],[3,0],[3,3]]) state=recruit(state,col,row);
    while(state.phase!=='result') {
      if(state.wave===2) state=recruit(state,0,3);
      state=send(state,{type:'startWave'}); state=run(state,10000);
    } return state;
  }
  const state=play(); assert.deepEqual(state,play());
  assert.equal(state.outcome,'win'); assert.equal(state.wave,5);
  const result=replay(header(state),state.acceptedLog,stateHash(state)); assert.equal(result.ok,true);
  if(result.ok)assert.deepEqual(result.state,state);
  assert.deepEqual(initial(2),initial(2)); assert.notDeepEqual(initial(2).offers,initial(1).offers);
});

test('successful steps detach previously accepted logs from earlier states',()=>{
  const state=recruit(), before=structuredClone(state);
  const moved=send(state,{type:'move',unitId:1,to:{kind:'board',col:1,row:0}}) as Mutable<MatchState>;
  const earlier=moved.acceptedLog[0];
  if(earlier.type==='command'&&earlier.command.type==='recruit')earlier.command.to={kind:'board',col:3,row:3};
  assert.deepEqual(state,before);
});

test('natural underpowered placement loses reproducibly without fabricated live state',()=>{
  let state=recruit(initial(1),1,1);
  while(state.phase!=='result')state=run(send(state,{type:'startWave'}),10000);
  assert.equal(state.outcome,'loss'); assert.equal(state.lives,0);
  const result=replay(header(state),state.acceptedLog,stateHash(state));assert.equal(result.ok,true);
  if(result.ok)assert.deepEqual(result.state,state);
});

test('movement crosses every corner continuously and preserves final seam removal',()=>{
  for(const distance of [4999,9999,14999]) {
    const result=advance(combat([],[enemy(10,distance)]),1);
    assert.equal(result.ok,true); assert.equal(result.state.enemies[0].distance,distance+100);
    const before=pathPosition(distance)!, after=pathPosition(distance+100)!;
    assert.equal(Math.abs(before.x-after.x)+Math.abs(before.y-after.y),100);
  }
  const inside=advance(combat([unit(1,0,1)],[enemy(10,1000)]),1);
  assert.equal(inside.ok,true);if(inside.ok)assert.equal(inside.events.some(e=>e.type==='attack'),true);
});
