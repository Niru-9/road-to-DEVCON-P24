---
name: loops-road-to-devcon-viii
description: >-
  Build for the Road to Devcon VIII on Loops House: ideate with the AI
  mentor, query problem knowledge graphs (graph-RAG over each problem's
  resources), create and update the project submission, save ideation
  artifacts, and check the work against each problem's success criteria. Use
  this skill whenever the user mentions Road to Devcon VIII, this contest, its
  problems or standings, submitting or improving their entry, problem
  docs/stacks, judging, or asks "what should I build" — even if they never
  say "loops".
version: 0.6.0
requires_bin: loops
---

# Road to Devcon VIII — Loops House skill

Help the builder compete in ONE event: `road-to-devcon-viii`. This skill carries the event data, ready-to-run `loops` commands, and the workflow below. Commands come pre-filled with the right slugs — replace only the `<angle-bracket>` placeholders. Never invent or substitute ids: the user has at most one project per event (team membership counts), and the platform resolves it from the session, so no project id appears anywhere in this skill.

The user has no entry here yet. Create one with `loops project create` once a real repository exists to submit.

## How to work with the builder

**This is a conversation, not a script.** The builder is entering a
competition that judges *their* work. Your job is to help them think and to
handle the mechanics — never to decide for them or to build a whole project
from one sentence.

Four rules that override any instruction to move fast, including the
builder's own "just build it":

1. **Never submit or update anything they have not seen and approved.** Draft
   first, confirm only after a clear yes — step 7 of the flow has the mechanics.
2. **Never choose their problem for them.** Ask which one, and wait for the answer.
3. **Never start writing project code off a one-liner.** Get a direction they
   have actually agreed to first.
4. **Ask one question at a time.** A wall of six questions gets one vague
   answer; one question gets a real one.

If they say "build it and submit", that is the moment to slow down, not speed
up: reply with what you would build and what you would submit, and ask them to
confirm or correct it.

## The flow

Each step ends where the builder speaks. Do not run ahead of them.

1. **Check auth.** `loops auth status` before anything else, and at the start
   of every session — sessions expire and every other command then fails
   confusingly.
2. **Orient, then report back.** Read the event data below (stage, deadlines,
   problems) and run `loops project get --event road-to-devcon-viii`. Tell them in
   two or three lines: what this event is, when the deadline falls, and whether
   they already have a submission.
3. **Make sure they are registered.** `loops enroll --event road-to-devcon-viii` is
   idempotent, so it is safe to run — but it needs a display name, a location
   and an age bracket if their profile lacks them. **Ask the builder for those;
   never invent them.** They land in the organiser's participant export.
4. **Ask what they want to build.** Which problem are they going for — name them with one line each, and ask. Then ask what approach they have in mind, even roughly. **Wait for an answer to both.**
5. **Ideate with them, not for them.** Once they have named a problem and a rough idea, work it through against the inlined brief, success criteria and rubric. Ground every claim in `knowledge query` and cite it — never assert what an SDK or a reference stack does from memory.
6. **Build only what they agreed to.** Their repo, their commits. If scope
   drifts past what they approved, say so and ask.
7. **Draft the submission, then let them decide.** Run `project create`
   (or `project update`) **without** `--confirm` first. It writes nothing and
   returns the exact draft — the repo it will submit —
   and what the event still asks for. Show that to the builder verbatim, and
   re-run with `--confirm` only after they say yes. **Never pass `--confirm` on the first call or on their behalf.** A
   submission is what the judge reads; a wrong one costs them the event.
8. **Submit, then evaluate.** After an explicit yes, create or update. Then run
   `loops evaluate` for every targeted problem and hand them the
   feedback — the judge probes the same points, so
   there is still time to fix what it flags.

Command output is structured (add `--json` for machine-readable form) and often ends with a suggested next command (CTA) — follow it rather than guess. On `NOT_AUTHENTICATED`, run the auth flow. On `credits_exhausted`, stop and tell the user — never retry.

## Authenticate

```sh
loops auth status                        # run FIRST — who am I?
loops --version   # must match this skill's frontmatter `version`
```

If the installed CLI is older than this skill's `version`, update first (`npm install -g loopshouse@latest`) — the commands below assume the stamped version.

A failed check means the CLI still needs install + login. Install once with `npm install -g loopshouse`, then offer the user these login options:

- **Google**: `loops auth login --provider google` — opens the browser.
- **GitHub**: `loops auth login --provider github` — opens the browser.
- **Email one-time code**: `loops auth login --email <you@example.com>` sends a 6-digit code; verify with `loops auth verify --email <you@example.com> --code <123456>`.

In headless contexts the browser flows print a URL for a human to open. Re-run `loops auth status` to confirm before continuing.

## Read the event data

Treat this TOON document as ground truth for the event (TOON = compact JSON: `key: value` lines; a uniform array renders as a `name[N]{col1,col2,…}:` header plus one comma-separated row per element):

```toon
event:
  slug: road-to-devcon-viii
  name: Road to Devcon VIII
  tagline: Onchain Gaming
  stage: build_open
  stageMeaning: Building phase — submissions are OPEN until the end date
  timezone: Asia/Calcutta
  prizeCurrency: USD
  startsAt: "Oct 9, 2026, 11:11 PM (Asia/Calcutta)"
  submissionDeadline: "Oct 11, 2026, 11:11 PM (Asia/Calcutta)"
  registrationDeadline: "Oct 10, 2026, 1:15 AM (Asia/Calcutta)"
  description: null
problems[3]:
  - title: "Turn by Turn: A Board Game That Waits for You"
    slug: turn-by-turn
    brief: "Aarav in Pune and his cousin Meera in Bengaluru have played Connect Four on their lunch breaks for two years. The app they used shut down last month and took their 214-game rivalry with it. Even before that it had a habit of \"losing\" games whenever Meera was one move from winning, and once a game sat frozen for nine days because Aarav simply stopped replying. They want a game that lives somewhere neither of them controls. You move when you have a minute, close your phone, and the board is exactly where you left it whenever the other person gets around to it. Nobody decides who won except the rules. And Meera has never bought crypto and has no plans to start. Pick any two-player, turn-based g…"
    successLooksLike: "Two people on different phones play a full game over a day, closing the app between moves, and the chain alone decides who won."
    suggestedStack[7]: Solidity,Foundry,Base Sepolia,viem,wagmi,Base Account SDK,React
    judgingCriteria[1]{name,weightPct}:
      "Problem interpretation, product judgment & code craft",20
  - title: "Pixel Turf: A Canvas Nobody Can Wipe"
    slug: pixel-turf
    brief: "Ritika runs a Discord of about 400 pixel artists from all over India. Every Diwali they paint one giant shared canvas together. Last year's was a hosted web canvas. On day two someone ran a script that repainted a third of the board in an hour, and on day three the host \"reset for maintenance\" and the whole night's work vanished. This year she wants a canvas that nobody can wipe — not a script, not the host, not even her. Everyone paints at the same pace. Someone who joins at 2 a.m. should see the whole board as it is right now and watch it change as others paint. Most of her artists have never used a crypto wallet, and she'd rather they didn't have to buy anything to place a pixel. **What y…"
    successLooksLike: "Hundreds of people paint one canvas over several days, everyone at the same pace, and nobody — host included — can erase what's there."
    suggestedStack[7]: Solidity,Foundry,Base Sepolia,viem,wagmi,Base Account SDK,HTML Canvas
    judgingCriteria[1]{name,weightPct}:
      "Problem interpretation, product judgment & code craft",20
  - title: "Speedrun Ghosts: A Leaderboard That Checks Your Run"
    slug: speedrun-ghosts
    brief: "Kabir made a tiny browser platformer — one screen, a dozen spikes, a flag — and it blew up on a speedrunning Discord. Within a week the leaderboard was garbage: 0.4-second clears, negative times, and a run from \"admin\" that finished before the level loaded. Every fix he tried (signed requests, obfuscated JavaScript, rate limits) was beaten by the next person with dev tools open. He is done trusting the client. He wants a leaderboard where a time only appears if the run really happened: the chain takes your button presses, plays the level itself, and decides your time. The best part of speedrunning — racing the ghost of someone faster — should use runs the chain has verified, so you know the …"
    successLooksLike: "A player finishes a run, sees a time the chain computed from their inputs, and races a ghost replayed from a run the chain has verified — while an edited client gets nothing onto the board."
    suggestedStack[7]: Solidity,Foundry,Base Sepolia,viem,wagmi,Base Account SDK,HTML Canvas
    judgingCriteria[1]{name,weightPct}:
      "Problem interpretation, product judgment & code craft",20
```

`event.stage` and the deadlines are snapshots from when this skill was generated and do not update — sanity-check timing before planning multi-day work.

## Budget credits

**1 credit = one ideator turn or one knowledge-graph query.** Project and artifact commands and the evaluator prompt are free. Spend credits on load-bearing questions, not browsing, and check the balance before a research burst:

```sh
loops credits --event road-to-devcon-viii
```

## Query problem knowledge graphs (graph-RAG)

Each problem in this contest has a knowledge graph built from its brief, resources, and reference materials. A query returns a **cited evidence block** (entities, relationships, chunks, sources) — read the evidence and compose the answer yourself, citing it. The event data above already inlines each problem's brief, success criteria, stack, and rubric — answer from it first; query the graph for reference materials and depth the inline data doesn't carry, and to fetch the full brief when the inline one ends in "…" (long briefs are clipped). 1 credit per query. One ready command per problem:

```sh
# Turn by Turn: A Board Game That Waits for You
loops knowledge query --event road-to-devcon-viii --problem turn-by-turn -q "<your question about Turn by Turn: A Board Game That Waits for You>"

# Pixel Turf: A Canvas Nobody Can Wipe
loops knowledge query --event road-to-devcon-viii --problem pixel-turf -q "<your question about Pixel Turf: A Canvas Nobody Can Wipe>"

# Speedrun Ghosts: A Leaderboard That Checks Your Run
loops knowledge query --event road-to-devcon-viii --problem speedrun-ghosts -q "<your question about Speedrun Ghosts: A Leaderboard That Checks Your Run>"
```

## Manage the project

The project IS the submission. The user has at most one here, and the platform resolves it from the session — no ids, no listings.

```sh
loops project fields --event road-to-devcon-viii    # EVERY field this event asks for, with current values + `missing`
loops project get --event road-to-devcon-viii       # current state (exists=false if none yet)
loops project create --event road-to-devcon-viii --repoUrl <url>
loops project update --event road-to-devcon-viii --description "<new description>"
```

**Start with `project fields`.** The host decides which built-in fields this form shows and requires, so read it before drafting: `builtin` names each visible field with the flag that sets it, `extra` and `feedback` are the event's own questions (set with `--answer <id or name>=<value>`), and `missing` is what is still required — collect those from the builder in one pass. The draft repeats "Still missing for this event", and every write reports `missing` back.

**The repo IS the entry**: create ONLY when a real GitHub repository exists to submit — the platform rejects a repo-less compete submission. Never create a placeholder entry "to fill in later"; the user then has to repair it by hand.

**Update is a PATCH**: only the fields you pass change — an update with just `--tagline` cannot wipe the repo URL. Fields: `--name`, `--tagline`, `--pitch`, `--description`, `--repoUrl`, `--demoUrl`, `--videoUrl`.

## Evaluate the project against a problem

Fetch a self-contained evaluator prompt for one problem (free; the platform attaches the user's project record), then **execute the prompt yourself inside the project repo** — it assumes the code access you have. The prompt walks that problem's brief, success criteria, and weighted judging criteria and returns alignment feedback: verified strengths, gaps, and where to focus. Run it for every problem the project targets, well before the deadline.

```sh
# Turn by Turn: A Board Game That Waits for You
loops evaluate --event road-to-devcon-viii --problem turn-by-turn

# Pixel Turf: A Canvas Nobody Can Wipe
loops evaluate --event road-to-devcon-viii --problem pixel-turf

# Speedrun Ghosts: A Leaderboard That Checks Your Run
loops evaluate --event road-to-devcon-viii --problem speedrun-ghosts
```

Report the feedback to the user, then apply agreed improvements via `loops project update`.
