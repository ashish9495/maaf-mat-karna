/**
 * All dialogue. Every line has a Hinglish (hi) and English (en) version;
 * the player picks the language in Settings.
 */
export interface Line {
  hi: string;
  en: string;
}

const L = (hi: string, en: string): Line => ({ hi, en });

export const dialogue = {
  intro: [
    { who: 'gf', line: L('Aaj toh tu gaya, baby! 😈', "You're so done today, baby! 😈") },
    { who: 'bf', line: L('Mummaaaa! Maine kya kiya ab?! 😭', 'Mummaaaa! What did I even do?! 😭') },
    { who: 'gf', line: L('Ab bhaag ke dikha!', "Let's see you run!") },
    { who: 'bf', line: L('BHAGOOOOO!', 'RUNNNNN!') },
  ] as { who: 'gf' | 'bf'; line: Line }[],

  bfChase: [
    L('Mumma pleaseeeee! 😭', 'Mumma pleaseeeee! 😭'),
    L('Ye toh cheating hai!', 'This is cheating!'),
    L('Main toh innocent hoon!', "I'm innocent, I swear!"),
    L('Mumma, meri baat toh suno!', 'Mumma, just listen to me!'),
    L('Ek hug de do, please!', 'Just one hug, please!'),
    L('Mera insurance bhi nahi hai!', "I don't even have insurance!"),
    L('Sorry bol diya naaaaa!', 'I already said sorryyyy!'),
    L('Bas karo, meri jaan!', 'Stop it, my love!'),
    L('FC Road pe izzat ka sawaal hai!', 'My reputation on FC Road is at stake!'),
    L('Mumma, cutting chai pila deta hoon! ☕', "Mumma, I'll buy you cutting chai! ☕"),
    L('Rickshaw! RICKSHAW! Jaldi chalo bhaiya!', 'Rickshaw! RICKSHAW! Drive, bhaiya!'),
    L('Mall mein shopping karwa dunga, pakka! 🛍️', "I'll take you shopping at the mall, promise! 🛍️"),
  ],
  bfHurtLow: [
    L('Saans phool gayi... 😮‍💨', "I can't breathe... 😮‍💨"),
    L('Mumma, rehem karo! 🥺', 'Mumma, have mercy! 🥺'),
    L('Mere pair jawab de rahe hain!', 'My legs are giving up!'),
    L('Main ghar jaana chahta hoon 😭', 'I want to go home 😭'),
  ],
  bfWeaponReact: {
    chappal: L('MUMMAAA! NOT THE CHAPPAL!', 'MUMMAAA! NOT THE CHAPPAL!'),
    pillow: L('Arey! Pillow bhi weapon hai?!', 'Hey! A pillow is a weapon now?!'),
    emoji: L('Mujhpe itna gussa?! 😭', 'All this anger for me?! 😭'),
    water: L('Mumma, main already ro raha hoon!', "Mumma, I'm already crying!"),
    ultimate: L('Ye kya hai?! YE KYA HAI?! 😱', 'What is THAT?! WHAT IS THAT?! 😱'),
    lipgloss: L('Lipgloss?! Ab main chipak gaya! 💄', "Lipgloss?! Now I'm stuck! 💄"),
    momos: L('Momos phek rahi ho?! Mujhe khane do pehle! 🥟', "You're throwing momos?! Let me eat them first! 🥟"),
    pizza: L('PIZZA mein aag lagi hai! 🔥🍕', 'The PIZZA is on fire! 🔥🍕'),
    eyes: L('Haaye... ye aankhein 😍', 'Oh no... those eyes 😍'),
    ticks: L('Seen karke ignore?! 💔', 'Seen and ignored?! 💔'),
    tantrum: L('Bhookamp aa gaya! 😱', "It's an earthquake! 😱"),
    fireball: L('Itna gussa?! Aag nikal rahi hai! 🔥', "So much anger it's literally fire! 🔥"),
    silent: L('Kuch toh bolo Mumma... 🥺', 'Say something, Mumma... 🥺'),
    kiss: L('Uff... ye toh bahut spicy thi 🥵💋', 'Oof... that was SO spicy 🥵💋'),
  } as Record<string, Line>,
  /**
   * Beautiful Eyes / Spicy Kiss: he is charmed and stops to compliment her.
   * One random line per hit.
   */
  bfCompliments: {
    eyes: [
      L('Tumhari aankhein duniya ki sabse sundar aankhein hain 😍', 'Your eyes are the most beautiful in the whole world 😍'),
      L('In aankhon mein toh main kho gaya... 🥹', "I just got lost in those eyes... 🥹"),
      L('Haaye, ek baar aur dekho na mujhe aise 🥰', 'Look at me like that one more time 🥰'),
      L('Itni pyaari aankhein dekh ke kaun bhaagega? 😍', 'Who could run from eyes this pretty? 😍'),
      L('Mumma, tum gussa mein bhi kitni cute lagti ho 🥺', 'Mumma, you look so cute even when angry 🥺'),
    ],
    kiss: [
      L('Uff... ab toh maar bhi do, koi gham nahi 🥵', 'Oof... you can hit me now, I have no regrets 🥵'),
      L('Ye attack nahi, ye toh blessing hai 💋', "That's not an attack, that's a blessing 💋"),
      L('Main toh pighal gaya, Mumma 🫠', "I've completely melted, Mumma 🫠"),
      L('Ek aur please? Science ke liye 😳', 'One more please? For science 😳'),
      L('Tum duniya ki sabse hot Mumma ho 🔥', "You're the hottest Mumma in the world 🔥"),
    ],
  } as Record<string, Line[]>,
  /** frozen by the Silent Treatment */
  bfFrozen: [
    L('Mumma... baat toh karo 🥺', 'Mumma... please talk to me 🥺'),
    L('Ye chuppi chappal se zyada dukhti hai 😭', 'This silence hurts more than the chappal 😭'),
    L('Kuch toh bolo, chahe daant hi do 😢', 'Say anything, even if it is scolding 😢'),
  ],
  /** said when she equips a power weapon */
  bfSeesPower: {
    eyes: L('Nahi nahi, aankhon wala attack nahi! 😳', 'No no, not the eyes attack! 😳'),
    kiss: L('Wo kiss wala mat karna... main kamzor hoon 🫣', "Not the kiss... I'm weak 🫣"),
  } as Record<string, Line>,
  bfSeesChappal: L('Arre baap re, CHAPPAL!', 'Oh no, the CHAPPAL!'),
  bfPanicPower: L('Wo bada wala weapon mat nikaalo! 😱', 'Not the big one! 😱'),
  gfTaunts: [
    L('Ab bhaag!', 'Run now!'),
    L('HAHAHAHA! 😈', 'HAHAHAHA! 😈'),
    L('Pakad liya!', 'Got you!'),
    L('Aaj nahi bachoge!', "You won't escape today!"),
    L('Ab meri baari!', 'My turn now!'),
  ],
  randomEvents: {
    fakeApology: L('Mumma, main chocolate laya hoon! 🍫', 'Mumma, I brought you chocolate! 🍫'),
    fakeApologyRun: L('...JHOOTH! BHAAGOOO!', '...JUST KIDDING! RUNNN!'),
    puppyEyes: L('🥺🥺🥺', '🥺🥺🥺'),
    wrongWay: L('Galat taraf! GALAT TARAF! 😱', 'Wrong way! WRONG WAY! 😱'),
    fall: L('AAAAH— *dhadaam*', 'AAAAH— *thud*'),
    hide: L('Shhh... main yahan nahi hoon 🤫', "Shhh... I'm not here 🤫"),
    found: L('Kaise dhoondh liya?! 😱', 'How did you find me?! 😱'),
    escape: L('Next level mein milte hain! 🏃', 'See you in the next level! 🏃'),
    cornered: L('Upar se nikal jaata hoon! 🦘', "I'll jump over you! 🦘"),
  },
  levelIntro: [
    L('Level 1 — FC Road Chase', 'Level 1 — FC Road Chase'),
    L('Level 2 — SB Road to the Malls', 'Level 2 — SB Road to the Malls'),
    L('Level 3 — Sunset at Parvati Hill', 'Level 3 — Sunset at Parvati Hill'),
  ],

  /**
   * The ending, in Baby's own words. Lines are shown one by one, in this order.
   * Edit freely: add or remove lines in any of the three groups.
   */
  cinematic: {
    whisper1: L('Mumma...', 'Mumma...'),
    whisper2: L('Ek last baat sunogi?', 'Will you listen to one last thing?'),
    /** while she holds the Ultimate Chappal over him (slow motion) */
    sorry: [
      L("I'm sorry, Mumma...", "I'm sorry, Mumma..."),
      L('Mujhse bahut galtiyan ho gayi hain.', "I've made so many mistakes."),
    ],
    /** as the song swells */
    still: [
      L('Main aaj bhi unki saza bhugat raha hoon...', "I'm still paying for them, even today..."),
    ],
    /** after the world turns warm */
    promise: [
      L('Main woh sab kar raha hoon jo jo tu bol rahi hai.', "I'm doing every single thing you've asked me to."),
      L("I'll be the best, Mumma. Promise.", "I'll be the best, Mumma. Promise."),
      L('Tu gussa kar, daant, chappal maar... sab chalega.', 'Be angry, scold me, throw the chappal... all of it is okay.'),
      L('Par tere bina sab adhoora lagta hai.', 'But without you, everything feels incomplete.'),
      L('Please forgive me...', 'Please forgive me...'),
      L('Please... mujhe chhod kar mat jaao. 🥺', "Please... don't leave me. 🥺"),
    ],
    hug1: L('Mumma...', 'Mumma...'),
    hug2: L('Ek hug milega?', 'Can I get a hug?'),
  },
  endingB: {
    ouch: L('Arreeee, Mumma! 😭', 'Arreeee, Mumma! 😭'),
    promise: L("Okay, okay... I'll keep trying to make things right.", "Okay, okay... I'll keep trying to make things right."),
  },
  portraitClick: L('Mummaaaa!', 'Mummaaaa!'),
};
