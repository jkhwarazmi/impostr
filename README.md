# Impostr

A social deduction party game you play on your phones, in the style of Spyfall.

Everyone in the room gets the same question, apart from the imposter, who gets a different one that has a similar kind of answer. Nobody is told which question they have. You all answer out loud, then the common question is revealed and you have to work out whose answer doesn't quite fit.

**Play it here: [impostr-weld.vercel.app](https://impostr-weld.vercel.app)**

## How a round works

1. One person hosts a game and gets a four-letter room code and a QR code. Everyone else scans the QR code or types the code in to join.
2. The host chooses a mode, an optional topic and how many imposters there should be (1 to 3).
3. When the host starts the round, Gemini generates a pair of prompts. Each player taps their card to see theirs privately.
4. Go round and answer. Once everyone has had a go, the host reveals the common prompt to the whole room.
5. Discuss, vote for who you think the imposter is, and the host reveals the truth.

### Modes

**Questions** (default). The two questions are about completely unrelated things but share an answer format, so a good imposter can blend in. Each round uses one of four formats:

- a count ("How many days could you survive in the wild?")
- a price in pounds ("Price to wear a wedding dress to work tomorrow?")
- a rating out of 10 ("On a scale of 1-10, how good are you at dancing?")
- a percentage ("Odds you would survive on a desert island?")

**Nouns.** Closer to classic Spyfall. Most players get a word and the imposter gets a related one, like Coffee and Tea.

The topic box lets the host steer generation towards something specific, like "football" or "90s films".

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router), React 19 and Tailwind CSS 4
- [Firebase Realtime Database](https://firebase.google.com/docs/database) to sync room state between players
- [Gemini](https://ai.google.dev) 2.5 Flash-Lite to generate prompts, called from a server route so the API key stays private
- Hosted on [Vercel](https://vercel.com)

## Running it locally

You'll need Node.js 20 or later, a Firebase project with a Realtime Database, and a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).

```bash
git clone https://github.com/jkhwarazmi/impostr.git
cd impostr
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Where to find it |
| --- | --- |
| `GEMINI_API_KEY` | Google AI Studio. Only used on the server. |
| `NEXT_PUBLIC_FIREBASE_*` | Firebase console, Project settings > Your apps > Web app config |

Then start the dev server and open [localhost:3000](http://localhost:3000):

```bash
npm run dev
```

To test with more than one player on your own machine, use a separate browser profile or a private window for each player, since your player ID is kept in `localStorage`.

### Database rules

There are no accounts, so the client reads and writes rooms directly. The Realtime Database rules need to allow that:

```json
{
  "rules": {
    "rooms": {
      ".read": true,
      ".write": true
    }
  }
}
```

This means anyone with your database URL can read and edit rooms. That's fine for a party game, but don't reuse the database for anything else.

## Project structure

```
src/
├── app/
│   ├── api/generate/route.ts   # Gemini prompt generation
│   ├── page.tsx                # The whole game: join screen, lobby, rounds, voting
│   ├── layout.tsx
│   └── icon.tsx                # Favicon
└── lib/
    └── firebase.ts             # Firebase client setup
```

## Known limitations

- Rooms are never cleaned up, so old ones stay in the database until you delete them.
- The host's phone drives the game. If the host leaves, the room gets stuck.
- If Gemini fails, the round starts with placeholder text and the host has to restart it.
