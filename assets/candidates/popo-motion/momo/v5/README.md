# Popo v5 attack-readability revision

Recommendation: independent review of the clearer directional attack; leader's working browser must verify actual36px playback and runtime integration. No production adoption.

## Change and observed result
Leader review of v3 requested an attack arm beyond the ear silhouette rather than a wave. V5 middle pose extends the same viewer-right arm horizontally, with the closed empty paw roughly5px beyond the ear at36px bodyheight. Single-button apron, lavender bag and face identity remain recognizable; feet stay planted. Idle upper-chest paw, horizontal strike and lowered recovery are distinguishable in actual-size still comparison. Slight generated contour/face/bag drift remains for independent review. No projectile is baked into the sprite.

## Measured sources and presentation
Raw2172x724RGBA is preserved unmodified. Three frames896x768 share foot pivot(448,704). Full RGBA reconstruction PASS; native pixels only translated, never alpha-deleted or recolored. Common body reference681px gives actual measured heights[32,32,32] and[36,36,36]. Canvas42x36 and47x41 respectively. Board320px static stress test shows no neighboring-body overlap;36px attack projects to the right visibly, still inside the cell spacing used here.

Interior alpha was measured, not altered.773650 eroded interior pixels: median253;22 below250, minimum239. Nearopaque values are not an automatic defect; no material translucent body observed in inspected target-size presentation. Source alpha/contour outliers remain preserved. See alpha-inspection.json, do not confuse alpha255 count with runtime quality.

## Proposed visual clip timing, not balance data
- idle lead-in:120ms (same image as the final idle gap; no separate anticipation pose)
- extended attack pose:100ms
- recovery pose:140ms
- idle inspection gap:640ms
- total review loop:1000ms

These are proposed animation presentation durations chosen to show an idle lead-in, a readable held strike, and recovery. The120ms lead-in and640ms gap are the same idle image, totaling760ms of idle in the1000ms inspection loop; this clip has no distinct preparation/anticipation motion. The640ms gap is for inspection only, not a proposed core attack cooldown. No damage/event timing, attack interval, hit point, projectile duration or balance value changed. Leader determines synchronization in runtime review.

## Playback artifacts and precise verification limit
- playback-36px.gif: actual36px body on actualboard crop plus4x inspection detail, four decoded frames with durations[120,100,140,640], repeated. Flattened palette GIF is lossy presentation only, not source art.
- viewer.html: self-contained actual36px PNG viewer with play/pause/next and4x detail, same timeline.
- static-controls-verification.json: DOM-stub timeline/control test PASS. This proves script sequence at supplied clock times, not live browser execution.
- verify_playback.cjs: real Chromium review script for working environment.
- Chromium launch here failed with process_singleton_posix.cc socket() Operation not permitted in default and approved elevated mode. Actual playback is therefore UNVERIFIED in this environment. No screenshot or live-playback success is claimed. Leader's existing working browser is the next test route.
- gif-decoded-*.png: decoded GIF stills inspected, not actual playback captures.

No further socket escalation, code integration, core change, repository publication or automatic adoption was performed.

## Independent timing-label correction
Independent Kiki timing-label review was verified: GIF first and last decoded RGBA frames are byte-identical, zero differing pixels. Their decoded RGBA SHA256 is f671d81bb61f2b0273ca7ef33df9b46f6a420f7b364620e80fd670f91a56f99e. Label changed from prepare to idle lead-in; no source image, GIF bytes, frame duration or core timing changed. Actual leader-browser playback remains pending.
