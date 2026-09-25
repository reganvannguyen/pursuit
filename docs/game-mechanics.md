# Pursuit — Game Mechanics & Product Design

**Status:** Initial product design for the MVP  
**First episode:** *The Forest: First Escape*  
**Scope:** Player experience, gameplay rules, and product requirements. Technical implementation and technology stack are intentionally out of scope.

## 1. Product vision

Pursuit is an immersive, choice-based outdoor running game. The player participates in an audio-driven story while physically running. Story decisions affect which physical challenges they face; their real-world performance determines whether they succeed, lose health, or change the course of the episode.

**Core principle: Your voice determines your strategy. Your running determines the outcome.**

The product is **a game first and a fitness tracker second**. It should motivate people to run by giving them meaningful objectives, suspense, progression, and accomplishments that they can share. It is not merely a pace-alert application or a narrated interval timer.

Survival horror is the theme of the first episode, not necessarily the only theme of future campaigns. Other settings could eventually use the same core gameplay rules.

## 2. MVP scope

Build **one complete, replayable, standard-length episode**, *The Forest: First Escape*. Its target experience is approximately **20–35 minutes**, although actual duration varies with running speed and route choices. Do not promise an identical completion time or distance for everyone.

The MVP should demonstrate:
- An audio-led story with distance-based checkpoints.
- Optional, meaningful route choices and unavoidable encounters.
- Fixed, objective physical challenges at each selected difficulty.
- Voice-based fictional radio conversations for optional decisions.
- Outcomes determined by the player's actual outdoor running.
- Health, narrative consequences, mission failure, and continued workout tracking.
- Easy, Medium, and Hard difficulties.
- Episode completion, achievements, XP/progression, run statistics, and optional results sharing.
- Pausing without a health penalty.

**Not in the MVP:** treadmill support, leaderboards, multiplayer, extensive campaigns, wearable-device dependence, dynamically personalized pace requirements, or a large collection of missions.

## 3. Supported play and equipment

- **A smartphone is essential** to play and record an outdoor run.
- **Headphones with a microphone are strongly recommended** for immersive audio and hands-free decisions. They are not strictly required: phone audio and a screen-based alternative can be supported when the runner is safely stopped.
- Audio should remain understandable without requiring dangerously high volume. Maintaining awareness of traffic, people, and other surroundings takes priority over immersion. Open-ear headphones are an appropriate option.
- The MVP is designed for **outdoor running** with measurable real-world movement. A runner should be free to use ordinary paths, parks, running tracks, and, subject to measurement reliability, smaller fields.
- The fictional story route **does not give real-world navigation directions**. “Gate,” “detour,” and other route choices alter virtual objectives and story outcomes, not the player's actual streets or turns.

## 4. Episode structure

### 4.1 Distance-based progression

Story checkpoints trigger after the player accumulates the designated distance travelled, **not** at a universal elapsed minute. A fast runner and a slower runner therefore encounter the same story beat after covering the same mission distance, rather than skipping an event for arriving early.

For example, an episode may include an opening, the first encounter, a route choice, a recovery section, and a final chase. Exact checkpoint distances and narration for *The Forest: First Escape* will be authored and playtested separately.

Between major events, allow ordinary running and occasional narrative/ambient audio. The player should not face constant intense challenges.

Distance is **cumulative travel distance**. Running laps or revisiting the same location should still advance the episode; distance from the starting point is not the relevant measure.

### 4.2 Local physical objectives

An event can start when a distance checkpoint is reached, then introduce its own fixed objective. For instance, “cover 250 metres within 75 seconds” starts **when the gate event activates**, regardless of how quickly the runner reached that point in the episode.

Challenges may test:
- **Escape:** cover a fixed distance within a time limit.
- **Pursuit:** remain ahead of a virtual pursuer over a set segment.
- **Endurance:** sustain a specified minimum pace over a longer segment.
- **Repeated pressure:** survive a deliberately authored combination of effort and recovery.

Exact values above and below are **illustrative**, not final difficulty benchmarks. We must playtest actual pace, distance, duration, and recovery requirements.

### 4.3 Branching, then reconverging

Meaningful decisions change the **current episode** and its running demands, dialogue, and potentially achievements or health. Branches ultimately reconverge so later episodes do not require entirely separate campaigns for every past choice.

Because routes can differ in length, one player may finish an episode after less total distance by accepting shorter intense challenges, while another may complete a longer, steadier route. Both can legitimately clear the same episode difficulty because each permitted route has its own predetermined objective.

## 5. Difficulty and objective accomplishment

The only visible difficulty choices are **Easy, Medium, and Hard**. There are no additional user-facing running tiers or hidden pace brackets in the MVP.

- Each difficulty has **fixed, published/understandable challenge standards**.
- The game does **not** secretly lower objectives when it infers that the runner is tired.
- Players improve their running ability to reach the next objective, rather than having every objective adjusted to them.
- Hard must represent a meaningfully harder set of requirements than Medium, and Medium than Easy, while accounting for the episode's different permitted routes.
- Stronger runners may naturally find earlier difficulties easy. This is intentional: clearing a harder objective should be something to work toward and take pride in.

The same difficulty **and chosen route** should impose the same physical challenge on all players. Distinct routes trade intensity against duration/distance; they need not produce identical finishing times.

This objectivity supports recognized clears, bragging rights, badges, and optional social sharing. It does **not** mean every player must choose the same route.

## 6. Event categories

### 6.1 Story events

Narration, discoveries, character interactions, environmental developments, or atmosphere. These advance the story without arbitrarily costing health.

### 6.2 Unavoidable encounters

The story automatically introduces a required physical challenge: for example, a pursuer appears and the runner must reach shelter. **No route-selection command is required.** Performance against the fixed distance/time or pursuit objective decides success or failure.

The consequence is announced clearly before the challenge. Failing a designated hazardous encounter may cost health.

### 6.3 Optional strategic decisions

The radio character presents **two clear alternatives**, typically:
- **Risky shortcut:** shorter mission segment, higher immediate intensity, and a clearly stated consequence if the accepted challenge is failed.
- **Safer detour:** longer distance or duration, lower immediate intensity, and **no health loss merely for choosing it**. Its own later challenge rules, if any, must also be communicated.

The player intentionally chooses a route. They are not penalized simply for choosing the less aggressive option. If they explicitly accept the hazardous shortcut and fail, that challenge can cost health and force a detour.

These choices should involve genuine trade-offs, particularly when the player has little remaining health.

## 7. Route selection and radio interaction

### 7.1 Chosen MVP direction

**Use short voice commands for optional strategic decisions**, framed as fictional radio communication. Example:

> Radio: “The gate's closing! You can try the gate or take the service road. What's your call?”  
> Player: “Gate.”  
> Radio: “Copy. You've got 75 seconds to reach it. Move!”

Only a small command vocabulary is required at a decision, such as **“Gate”** and **“Detour.”** Brief radio acknowledgment should confirm the recognized choice before the player commits. This should feel like talking to a character, not using a generic assistant.

Voice input is active during short decision windows rather than constantly listening. Background audio can be reduced while listening.

**Speech recognition reliability remains to be tested**, especially when breathing hard, in wind, and with different headphone microphones. If a command is unclear, allow a retry using in-story “radio interference” dialogue. Failed recognition must **never** cost health. After unsuccessful attempts, use a predetermined safer fallback. Provide an alternative screen choice for use when safely stopped.

### 7.2 Separate intention from performance

**Choosing to attempt a route** and **physically passing its objective** are distinct actions. The player's current running pace must not accidentally force a risky choice.

A runner already fast enough to complete a gate objective should be allowed to maintain that pace after consciously choosing the gate. They must **not** need to accelerate even further merely to prove intent.

We considered using a short acceleration window as a hands-free decision mechanic, but it creates this already-fast-enough problem and may be unreliable over short GPS intervals. It is **not** the agreed primary MVP selection method.

For an **unavoidable** event, no selection is needed: the event activates and distance/time performance determines the result. This distinction preserves explicit risk-taking for optional routes without complicating unavoidable chases.

## 8. Virtual pursuit and challenge outcomes

During pursuit encounters, the virtual threat closes or opens the gap in response to the runner's real movement under **fixed rules for the chosen difficulty and encounter**. Changing audio intensity and radio cues should communicate mounting danger and relief.

Other events may be framed as reaching a closing gate or shelter before a countdown expires rather than always showing a pursuer gap.

The story provides a reason to change pace; it is not an excuse to invent random or excessive sprints. Include authored calmer segments and recovery intervals. The game does **not** secretly adapt the objective based on guessed fatigue.

At the end of a challenge, success and failure trigger distinct narration. If a failed optional gate attempt closes the gate, for example, the player may lose a heart and be forced onto the longer detour. If the player chooses the detour initially, simply taking that route is not failure.

## 9. Health and fail-forward storytelling

Health represents remaining survival capacity and mistakes tolerated during the **mission**, not literal repeated resurrection.

**Core health rule:** only lose health after failing a clearly identified hazardous physical challenge whose consequence was communicated. No random damage for arbitrary story beats, route selection alone, GPS uncertainty, misunderstood voice commands, or choosing the safe route.

If a pursuer reaches the player, the story treats this as **losing the encounter**, not necessarily being killed: the character can break free, obstruct the pursuer, receive help, or escape through a narrow opening. Each event needs a credible authored explanation for how the character survives the setback.

A failed gate or environmental challenge needs its own consequence narration, such as a forced scramble over an obstacle, rather than a generic unexplained lost heart.

After a damaging encounter, briefly reset the threat and provide a short, authored lower-pressure transition before ordinary gameplay resumes. Avoid making failure a desirable way to obtain a large rest; longer recovery sections belong in episode design.

Health can influence strategy: with one heart remaining, the runner may reasonably prefer a longer safe route to risking the shortcut.

**At zero health:**
1. Mark the mission failed.
2. Give a coherent in-world failure/retreat message.
3. Stop the mission's active challenges and story progression.
4. **Keep recording the real run** until the player elects to finish.

Failing the game should never make the player's actual workout disappear.

Potential future mechanic, **not required for MVP**: a longer optional detour to recover health at a meaningful distance/time cost. Any such system must be reconciled with standardized achievement rules.

## 10. Pausing and real-world safety

Pausing is **allowed and carries no automatic health penalty**.

- Pausing freezes mission challenges, the pursuer, and story progression.
- Overall **elapsed time continues** through pauses.
- Resuming provides a short countdown and must never unexpectedly begin an immediate sprint.
- Stoplights, obstacles, traffic, pedestrians, and personal safety always take priority. Do not pressure players to sprint through hazards or follow fictional turns.
- Losing signal, an unavailable microphone, and ambiguous GPS readings must not silently cause damage.

We want players to feel comfortable pausing whenever necessary. Do **not** treat unusually long elapsed time alone as evidence of cheating.

For challenge integrity, record whether an individual timed objective was completed **uninterrupted**. Normal episode clears may allow pauses, but an additional uninterrupted-challenge achievement should require an uninterrupted valid attempt. Exact handling of paused active objectives and measurement uncertainty needs playtesting; safety remains more important than qualification for an extra badge.

## 11. Completion, achievements, progression, and sharing

These are distinct concepts:

- **Episode completion:** the player survives the episode at a named fixed difficulty via any permitted successful route.
- **Achievements and badges:** recognize specific accomplishments, such as a Hard clear, finishing with full health, completing aggressive shortcuts, completing an endurance route, or uninterrupted challenge success.
- **Personal records:** retain noteworthy run and mission performance without assuming that different route lengths are directly comparable.

Allow players to retry episodes, explore alternative routes, beat higher difficulties, pursue perfect clears, and earn route-specific badges.

**XP and progression** may recognize participation and unlock new episodes, lore, titles, cosmetics, or other non-power rewards. Do **not** grant extra health or stronger physical abilities through ordinary XP in standardized challenge mode: two players claiming the same objective clear must not have fundamentally different in-game advantages. Campaign upgrades, if explored later, should have clearly distinguished completion categories.

**No leaderboard in the MVP.** If competitive comparisons arrive later, differing routes, pauses, GPS quality, and validation rules must be considered before ranking finish times.

Players can **optionally share a results card** with useful statistics and earned badges. Include, as available:
- Episode name and difficulty.
- Clear or failed status.
- Route/challenge achievements.
- Distance.
- Average moving pace.
- **Moving time and total elapsed time**, both clearly labeled.
- Health remaining and other relevant mission outcomes.
- Pause/interruption information where relevant to a special achievement.

An unusually long elapsed time may be visible on a shared result, but it does not by itself invalidate ordinary completion.

## 12. Running locations, tracking expectations, and limits

Players should be able to run on normal outdoor paths, around a park, or on repeated loops. **Distance accumulates along the path**, not as straight-line displacement from the start. Returning to the same spot after a lap must still advance the episode.

GPS quality remains an important **product acceptance question**:
- Can short fixed-distance challenges be measured fairly?
- What happens with sharp turns and tightly overlapping loops around a small field?
- How does a standard athletics track compare with an open straight path and a tree-covered trail?
- How should the game respond to poor accuracy, unrealistic jumps, or interrupted tracking?

Do not invent exact tolerances before real-world testing. Any eventual tolerance should protect players from ordinary measurement error without quietly changing the intended difficulty.

**Treadmill support is excluded from the MVP.** A stationary smartphone cannot use outdoor location tracking to measure treadmill travel. Revisit treadmill-specific inputs or motion-based estimation later, and distinguish any manually entered or unverified performance from outdoor-measured achievements.

## 13. First episode: The Forest — First Escape

The MVP is one authored, complete, replayable survival-horror episode with a shared start and ending and branching middle segments.

**Intended gameplay beats** (subject to actual story writing and playtesting):
1. **Introduction:** establish the forest setting, the player's situation, and the radio companion.
2. **First unavoidable encounter:** teach the player how a physical pursuit challenge works.
3. **Calmer narrative/recovery segment:** allow running without continuous pressure.
4. **Closing-gate choice:** explicitly choose a short intense gate attempt or longer safer service-road route via radio.
5. **Consequences and reconvergence:** successful shortcut, failed risky attempt, and voluntary detour receive appropriate narration before returning to the main episode.
6. **Additional encounter / final pursuit:** test the player's survival under a fixed objective.
7. **Escape or failure:** finish the story accordingly and display results; if the mission fails earlier, run tracking remains available.

**This is an outline, not the final episode script.** Exact distances, timing, pace thresholds, starting threat gaps, heart counts per difficulty, dialogue, audio scenes, and precise number of encounters require design and playtesting. Do not treat illustrative examples from brainstorming as official level requirements.

## 14. Product questions to validate before finalizing level parameters

These are **known experiments**, not invitations to silently change the agreed product direction:

1. **Distance measurement:** test a straight path, a 400 m running track, tight loops around a smaller field, and a tree-covered route. Confirm cumulative distance and short-objective reliability.
2. **Voice commands:** test “Gate” / “Detour” with actual outdoor running, heavy breathing, wind, and different headphones; verify confirmation, retry, and safe fallback.
3. **Challenge fairness:** choose realistic objective requirements and measurement tolerances through playtesting with runners of differing abilities.
4. **Pause integrity:** decide precise rules for interrupted objectives and special uninterrupted badges while allowing safety pauses without health loss.
5. **Narrative pacing:** verify that the single episode's story, hard efforts, calmer stretches, and branching routes remain enjoyable rather than feeling like constant interval prompts.

## 15. Design principles to preserve

1. **Game first:** physical running directly controls meaningful game outcomes.
2. **Objective standards:** a given difficulty and selected route have fixed requirements; the app does not secretly adjust standards to the runner.
3. **Informed decisions:** risky choices must be intentional, and the possible health consequence must be clear.
4. **Fail forward:** mistakes have story consequences; losing a mission never erases the run.
5. **Safety above achievements:** physical surroundings always take priority and pausing is permitted.
6. **Immersion without complexity:** short in-character radio commands, accessible choices, and minimal phone interaction while moving.
7. **One good episode first:** validate a complete, replayable *The Forest: First Escape* before expanding the campaign.
