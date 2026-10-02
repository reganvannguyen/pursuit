# In-Run UX Design

## Purpose

The in-run experience should prioritize **glanceability, safety, and running utility first**, while keeping enough game information visible to preserve the chase/story experience.

The app should not use the heavily themed arcade-style presentation that appears in campaign selection, episode selection, mission briefing, and results screens. During a run, the interface should be much cleaner and closer to a modern running app.

The main principle is:

> **Before and after the run: game first. During the run: running first, game second.**

Campaign identity should still be present through accent colors, terminology, audio, subtle typography, and small visual details.

---

## Core In-Run Information

The runner should be able to glance at the phone and quickly understand the most important information.

The primary information is:

- Lives
- Threat level
- Distance
- Elapsed time
- Current pace
- Chase status
- Current objective
- Objective progress or countdown

The stats should use large typography and high contrast so they are easy to read while moving.

---

## In-Run Views

The in-run experience uses two main swipeable views:

1. **Map View**
2. **Stats View**

Both views share the same top status information and bottom run controls.

---

# 1. Map View

The Map View is the default spatial/chase view.

Its purpose is **not navigation**. The app does not know the runner's intended physical route ahead of time.

Instead, the map answers:

> **Where am I, and how close is the pursuer?**

## Layout

### Header

Keep the mission header small and unobtrusive.

Example:

```text
OUTBREAK // MISSION 04
THE UNDERPASS
```

### Lives and Threat

Lives and threat level appear near the top of the screen, above the running stats.

Example:

```text
LIVES   ❤️ ❤️ ❤️ ❤️ ♡      THREAT   ▮ ▮ ▮ ▯ ▯
```

These remain visible on both Map View and Stats View.

### Running Stats

Show the three primary running metrics in a compact but readable row:

- Distance
- Elapsed time
- Pace

Example:

```text
DISTANCE       TIME         PACE
2.4 KM         18:26        7:41 /KM
```

### Map

The map takes up most of the remaining screen.

The map should display:

- The runner's recorded GPS trail
- The runner's current location
- The pursuer's virtual location
- The starting location, if useful
- Chase distance

The map should **not** display a geographic checkpoint ahead of the runner.

Example:

```text
START ───────── PURSUER ───────────── YOU
```

The exact path may curve, loop, double back, or cross itself depending on where the runner physically travels.

### Chase Status

A compact chase status element should communicate the most important chase information without requiring the runner to interpret the map.

Example:

```text
CHASE STATUS
Pursuer 310 m behind
Following your route
```

---

# Pursuer Map Model

The pursuer is a virtual entity that follows the runner's previously recorded GPS trail.

The app does **not** need to predict where the runner will go.

As the runner moves:

1. GPS positions are appended to the recorded route.
2. The runner occupies the newest point on that route.
3. The pursuer advances along earlier points on the same route.
4. The distance between the runner and pursuer is calculated along the route.

The pursuer should not use straight-line geographic distance to determine whether it has caught the runner.

For example, if the runner has completed 3,200 m of route distance and the pursuer has completed 2,890 m:

```text
Runner progress:   3,200 m
Pursuer progress:  2,890 m
Gap:                 310 m
```

This keeps the mechanic fair even when the runner:

- turns corners
- loops around a field
- doubles back
- runs winding trails
- follows unusual routes

The pursuer follows the same trail rather than taking a geographic shortcut.

---

# No Geographic Checkpoints

Story checkpoints are **progress-based**, not real-world map destinations.

The game may tell the runner:

```text
Reach the checkpoint
0.8 km remaining
```

This means the runner needs to travel another 0.8 km.

It does **not** mean there is a known physical location 0.8 km ahead.

The player can run in any direction.

Once the required additional distance has been completed, the game considers the fictional checkpoint reached.

Therefore, the map should not render a checkpoint pin ahead of the runner.

---

# Story Route vs. Physical Route

Story choices do not represent real-world navigation directions.

For example:

```text
SERVICE TUNNEL
Shorter · Higher risk

UPPER ROAD
Safer · Longer route
```

The user is choosing what happens in the fictional story world.

They are **not** being told which physical road to take.

A story choice may change game parameters such as:

- required distance
- pursuer speed
- chase duration
- objective timer
- threat level
- likelihood or severity of future events

Example:

### Service Tunnel

- shorter distance to next story checkpoint
- faster pursuer
- higher threat
- harder chase

### Upper Road

- longer distance to next story checkpoint
- slower pursuer
- lower threat
- easier chase

The runner is still free to physically travel in any direction.

---

# Route Decisions

Route decisions should **not** have a permanent reserved area on the screen.

Most of the run will not contain an active decision, so reserving permanent screen space would waste valuable room that could otherwise be used for the map or stats.

Instead, use a temporary **bottom sheet**.

## Decision Bottom Sheet

When a decision event occurs:

1. An audio cue announces the decision.
2. The phone may vibrate.
3. A bottom sheet slides up over the lower portion of the map.
4. The two choices are displayed as large tap targets.
5. Once a choice is made, the sheet disappears.

Example:

```text
ROUTE DECISION

Gate ahead. Which route will you take?

┌─────────────────────────────────┐
│ SERVICE TUNNEL                  │
│ Shorter · Higher risk           │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ UPPER ROAD                      │
│ Safer · Longer route            │
└─────────────────────────────────┘
```

The sheet should take enough space to make the options easy to read and tap while running, but it should not permanently replace the map.

## No-Input Behaviour

A runner may be unable or unwilling to interact with the phone during a decision.

The game should therefore support a fallback behaviour such as:

- automatically choosing a predefined default route after a countdown, or
- continuing onto a safe/default branch

The exact fallback rule can be determined later.

---

# 2. Stats View

The runner can swipe from the Map View to a Stats View.

The Stats View removes the map and uses most of the available screen for large, highly readable information.

Its purpose is:

> **How am I doing right now?**

## Layout

### Header

Same compact mission header as Map View.

### Lives and Threat

Same persistent lives and threat row.

### Large Running Stats

Distance, time, and pace should dominate the screen.

Example:

```text
DISTANCE
2.4 KM

TIME
18:26 ELAPSED

PACE
7:41 /KM
```

### Chase Status

Example:

```text
CHASE STATUS

Pursuer 310 m behind
Following your route
```

### Current Objective

Example:

```text
CURRENT OBJECTIVE

Reach the checkpoint before the gate closes.

0.8 km remaining
09:34 left
```

The objective communicates story progress without pretending the checkpoint has a fixed real-world location.

---

# Swipe Behaviour

The two views should be easily accessible during a run.

### From Map View

```text
Swipe right → Stats View
```

### From Stats View

```text
Swipe left → Map View
```

The transition should be simple and fast.

The user should not need to navigate through menus while running.

---

# Bottom Run Controls

Both views should use the same persistent bottom controls.

Recommended controls:

- Safety Lock
- Pause
- End Run

Pause should be the most visually prominent control.

End Run should require a hold or confirmation to reduce accidental termination.

The controls should remain secondary to the running information.

---

# Lock Screen Behaviour

The user's phone may remain locked for much of the run.

The app should aim to expose essential run information through supported lock-screen functionality where possible.

Potential lock-screen information:

- elapsed time
- distance
- pace
- lives
- threat level
- concise chase status
- concise objective status

The full interactive experience should still live inside the app.

Important route decisions may use audio/vibration to alert the runner that interaction is available.

Exact lock-screen capabilities should be validated against the platform APIs during implementation.

---

# Visual Design Rules

The in-run UI should be considerably cleaner than the campaign menus.

## Use

- large numbers
- high contrast
- generous spacing
- simple dark surfaces
- restrained campaign accent color
- small campaign-specific typography or labels
- subtle game terminology
- audio and haptics for immersion

## Avoid

- large campaign cover artwork
- full-screen decorative backgrounds
- heavy arcade borders
- excessive warning graphics
- tiny labels
- permanent story panels
- permanently visible route-decision areas
- map elements implying navigation the app does not provide

---

# UX Summary

The in-run interface should have two primary states:

## Map View

Best for answering:

> **Where am I relative to the pursuer?**

Contains:

- lives
- threat
- compact running stats
- recorded route map
- player marker
- pursuer marker
- chase distance
- temporary decision bottom sheets

## Stats View

Best for answering:

> **How am I doing?**

Contains:

- lives
- threat
- large running stats
- chase distance
- current objective
- objective remaining distance/time

## Core Rule

The in-run experience should always prioritize safety and readability.

The game should create immersion through **audio, haptics, terminology, chase mechanics, and temporary events**, rather than permanently filling the screen with decorative game UI.
