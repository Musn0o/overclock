# OVERCLOCK — plan

A neon tower-climbing arcade game for YouTube Playables. Climb an endless
megastructure while plasma rises from below; chain landings for combo points.
Original theme, art and audio — **not** a copy of Icy Tower (no shared name,
character, art, music, or level design). Genre mechanics are fair game; the
identity and the twists below are ours.

## Decisions

- **Theme:** chunky neon robot on a megastructure, rising plasma hazard.
- **Physics:** Phaser Arcade Physics (one-way platforms, gravity, bounce).
- **Renderer:** Canvas (Playables Test-Suite-safe; see PLAYABLES_NOTES.md).
- **Repo:** separate repo `overclock`, physically inside `YT_Playables/`.

## Status of this scaffold (MVP)

Implemented and runnable:
- Project infra (SDK wrapper, Canvas boot + size-sync, deploy workflow).
- Boot → Preloader → MainMenu (hub) → Game → GameOver.
- Core climb: arcade movement, variable jump with coyote-time + jump buffering,
  procedurally generated platforms, rising plasma, wrap-around walls, camera
  follow, combo on chained landings, height/score HUD, game over + rewarded-ad
  continue, cloud/local profile (best height, coins, XP, level).

## Roadmap

### Milestone 1 — Core feel (DONE)
- [x] Tuned jump/gravity/move; landing squash + dust puff.
- [x] Platform variety: **one-way** (jump through from below), **crumbling**
      (shakes then breaks), **moving** (horizontal, carries the player),
      **bounce pads**.
- [x] Wall-jump off neon **pillars** (kept wrap-around at the screen edges too).
- [x] Combo juice: centre pop + screen flash on every 5th combo.
- [x] **"Close call"** when plasma nearly catches you (bonus + brief slow-mo).

### Milestone 2 — Meta progression (reuse Undertow architecture)
- [ ] Skins (robot colours/trails) bought with coins.
- [ ] Tower **themes/backgrounds** unlocked by level (skyline, magma, void…).
- [ ] Daily missions (climb X m, reach a combo, survive N seconds).
- [ ] Lucky wheel every 5 minutes.
- [ ] Coins/XP balance + level-up feedback.

### Milestone 3 — Controls & accessibility
- [ ] Touch: on-screen left/right + jump (currently hold-toward-pointer + jump
      pad); support both.
- [ ] Keyboard parity; Esc closes modals; responsive across aspect ratios.

### Milestone 4 — Polish & platform compliance
- [ ] HUD readability pass; pause overlay.
- [ ] Perf check on low-end mobile (Canvas).
- [ ] Audio: coyote/land/combo/game-over; obey platform mute/pause.

### Milestone 5 — Test & ship
- [ ] Mock-SDK harness: `loadData` before `saveData`, `firstFrameReady` →
      `gameReady`, pause/resume/audio.
- [ ] Serve under YouTube CSP inside a sandboxed iframe (hidden → revealed).
- [ ] Official Test Suite (all green), then Android/iOS/desktop.
- [ ] Commit, deploy to GitHub Pages, submit.

## Reuse vs. rebuild

Reused from Undertow (proven): `playables/YouTubePlayables.ts`, `ytgame.d.ts`,
`systems/Sfx.ts`, `ui/Button.ts`, `ui/panel.ts`, the Canvas + size-sync boot,
the Pages deploy workflow, and the `PLAYABLES_NOTES.md` pre-flight checklist.
