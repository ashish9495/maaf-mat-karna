# MAAF MAT KARNA 😈

*She has unlimited weapons. He has only one heart.*

A 2D browser game made for Khushi ("Mumma") by Ashish ("Baby"). It starts as a chaotic cartoon chase and ends as something else entirely.

Built with **Phaser 3 + TypeScript + Vite**. Every character, background (including the Pune landmarks: FC Road, Goodluck Chowk, JM Road, Shaniwar Wada, Karve Nagar, SB Road, Phoenix Marketcity, Mall of the Millennium, Parvati Hill, Z Bridge, Koregaon Park), weapon, particle and sound effect is drawn or generated in code, so the game runs without any downloaded art. The only audio files are the two songs and the "fahhh" hit sound in `public/assets`.

---

## 1. Run it locally

You need [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
npm run dev        # opens a local server, usually http://localhost:5173
```

To test on your phone, use the "Network" address Vite prints (same Wi-Fi).

Other commands:

```bash
npm run build      # type-checks and builds the production site into dist/
npm run preview    # serves the built dist/ folder locally
```

### Testing shortcuts

Add one of these to the URL to jump straight to a part of the game (handy while editing, and so you don't spoil it by playing the whole chase every time):

| URL ending | Goes to |
|---|---|
| `#level1`, `#level2`, `#level3` | that level |
| `#cinematic` | the final cinematic |
| `#ending-yes` / `#ending-no` | an ending |

Add `?touch` (e.g. `/?touch#level1`) to show the mobile buttons on a desktop.

**Before you send her the link, clear your test progress:** open the site, open DevTools → Application → Local Storage, and delete the `mmk.*` keys (or just use a private window when testing). Otherwise her menu will already show "Endings & Memories" and spoil the surprise.

---

## 2. Make it yours

Almost everything personal is in two files:

- **`src/config/dialogueConfig.ts`** — every line of dialogue, including Baby's apology in the ending (`cinematic.sorry`, `cinematic.still`, `cinematic.promise`).
- **`src/config/gameConfig.ts`** — level layouts and the Pune signboards, stalls and malls (change a `label` to rename one).
- **`src/config/personalization.ts`** — names, nicknames, titles, outfit/skin/hair colours, the final handwritten note, signature, secret message, song file paths.
- **`src/config/memoryConfig.ts`** — the 8 memory cards (photo, title, optional date, caption, sticker).

Dialogue (Hinglish + English) is in `src/config/dialogueConfig.ts`, weapon stats in `src/config/weaponConfig.ts`, level layouts in `src/config/gameConfig.ts`.

### Relationship photos

1. Put photos in `public/assets/memories/` (JPG/PNG/WebP, ideally under 1000 px wide).
2. Point the cards at them in `src/config/memoryConfig.ts`, e.g. `photo: 'assets/memories/memory-3.jpg'`.

Four of your photos are already in (`memory-1`, `-2`, `-4`, `-5`). Cards 3, 6, 7 and 8 show a decorated placeholder until you add `memory-3.jpg`, `memory-6.jpg`, `memory-7.jpg`, `memory-8.jpg`. Dates are left empty on purpose: fill them in yourself.

### Cartoon portraits

Save square images as `public/assets/characters/khushi-portrait.png` and `ashish-portrait.png`. They replace the auto-drawn faces on the menu cards and in the HUD.

The in-game characters are drawn from code (so they can animate every expression). To tweak how they look, change the colours under `look` in `personalization.ts`; hairstyles and features (her long hair, middle part and hoop earrings; his big swept-up hair, forehead mole, stubble and red thread) are in `src/characters/CharacterRig.ts` → `drawHair()` / `redrawFeatures()`.

### Music

- **Chase music:** `public/assets/music/chase.mp3` (Levitating instrumental) plays from the main menu through all three levels and fades out the moment Baby falls.
- **Ending song:** `public/assets/music/romantic.mp3` ("Abhi Na Jao Chhod Kar", flute version) starts from the beginning as Khushi walks towards him after he falls, and keeps playing through the memories and both endings.
- To swap either song, replace the file with the same name. She can also pick a different ending song in **Settings → Ending song** (stored only in that browser).
- If a file is missing, the game falls back to its own built-in tunes.
- Both recordings are copyrighted. They're fine for a private gift, but a **public** GitHub repo or Pages site shares them with anyone who has the link (see the note under Deploy).

### Mumma's arsenal (14 weapons)

Unlocked in this order as she lands hits (anything missed is handed over at the start of the next level):

| Level | Weapon | How it works |
|---|---|---|
| 1 | 🩴 Legendary Chappal | starting weapon, arcs through the air |
| 1 | 💄 Sticky Lipgloss | thrown; a hit slows him down |
| 1 | 🛏️ Pillow of Doom | close-range smack, huge knockback |
| 1 | 🥟 Momo Shotgun | three momos in a fan |
| 2 | 🍕 Burn-to-Hell Pizza | flaming slice that flies out and comes back |
| 2 | 😡 Angry Emoji Cannon | rapid straight shots |
| 2 | 😍 Beautiful Eyes | **power attack**: instant heart-beam; he freezes and compliments her eyes |
| 2 | ✔️ Blue Ticks (Seen) | fast double-tick shots |
| 2 | 💦 Water Blaster | rapid stream, slows him |
| 2 | 💢 Tantrum Stomp | shockwaves both ways along the ground (he must jump) |
| 3 | 🔥 Gussa Fireballs | bouncing fireballs |
| 3 | 💋 Spicy Kiss | **power attack**: homing kiss; he melts and compliments her |
| 3 | 🤐 Silent Treatment | slow cloud that freezes him on the spot |
| 3 | ✨ Ultimate Chappal | hold to charge |

Switch with Q/E, number keys 1–9 and 0, or click/tap a weapon icon at the top left.
Stats are in `src/config/weaponConfig.ts`; unlock order in `src/config/gameConfig.ts` (`unlocks`);
his compliments are in `src/config/dialogueConfig.ts` (`bfCompliments`).

### Story pacing

The intro, the ending dialogue and the memory album all play by themselves; there's no "tap to continue".
Each line stays on screen for its reading time (1.8–5.2 s, longer lines longer), and each memory photo for 5.5–9.5 s.
A tap or Enter still skips ahead, and Skip closes the album. Change the timings in `src/ui/StoryUI.ts` (`hold`)
and `src/ui/MemoryMontage.ts` (`holdFor`). The only taps the story asks for are the final forgiveness choice and the end-screen buttons.

### The "fahhh" hit sound

`public/assets/sfx/fahhh.mp3` plays every time Baby gets hit, on phones and computers alike. It's loaded into Web Audio
after her first tap, so it starts instantly and can overlap. It plays even when an iPhone is on silent (Safari 17+), and it repeats at most every ~0.4 s
so rapid weapons don't turn it into noise. Replace the file to change the sound; volume is `hitSoundVolume` in `personalization.ts`.

### Personal messages

Edit `finalNote`, `signature` and `secretMessage` in `personalization.ts`, and the memory captions in `memoryConfig.ts`.

---

## 3. Put it online (GitHub Pages)

1. Create a new repository on GitHub. On a free account, GitHub Pages only works for **public** repos (see the privacy note below).
2. Upload the project:
   ```bash
   git init
   git add .
   git commit -m "Maaf Mat Karna"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git push -u origin main
   ```
3. On GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. The included workflow (`.github/workflows/deploy.yml`) builds and publishes automatically. After a minute or two, the **Actions** tab shows the site URL:
   `https://<your-username>.github.io/<repo-name>/`
5. Open it on your phone once to check, clear your test progress (see above), then send her the link. 💌

Every later `git push` redeploys automatically.

**Netlify / Vercel instead:** import the repo, build command `npm run build`, output folder `dist`. No other settings needed.

### Privacy note

A public repo and a GitHub Pages site can be seen by anyone with the link, including your photos. If that matters, use Netlify or Vercel with a private repo, or keep the song and any extra-personal photos out of the repo and load the song through the in-game picker.

---

## 4. How it's built

```
src/
  main.ts                   Phaser game config
  config/                   personalization, memories, dialogue, weapons, levels
  scenes/                   Boot, Menu, Intro, Level (all 3 levels), Cinematic, Ending, shared stage
  characters/               CharacterRig (procedural rigged chibi), Character base,
                            GirlfriendController (player), BoyfriendAI (FSM NPC)
  systems/                  Audio (Web Audio synth + file playback), Weapons, Health,
                            Input (keyboard/mouse/touch), Cutscene manager, Environment builder,
                            Save (localStorage), Achievements
  ui/                       HTML overlays: HUD, mobile controls, menus/settings/pause,
                            memory montage, dialogue box, forgiveness popup, ending panels
  utils/                    textures, effects, portraits, helpers
```

- **Player:** acceleration-based movement, coyote time, jump buffering, variable jump height, dash with cooldown, squash & stretch.
- **Baby's AI:** a finite-state machine (flee, panic, dodge, hide in bushes, stumble, catch breath, random comedy events, leap over her when cornered, stuck recovery, escape to the next level).
- **Weapons:** 14 weapons across 11 mechanics: arc, melee, straight, stream, charge, spread, boomerang, beam, shockwave, bounce, homing. Effects: slow, charm (stops and compliments), freeze.
- **Cinematic:** an explicit async sequence on Phaser's clock with skip/abort handling, so rapid clicks can't double-trigger anything.
