import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Each round picks one answer format so both questions get comparable answers
const QUESTION_ARCHETYPES = [
  {
    type: "HYPOTHETICAL_LIMIT",
    structure: "Question MUST ask for a Count (Days, Hours, Items, People).",
    topic: "Ask about SURVIVAL LIMITS, GLUTTONY, or PHYSICAL FEATS.",
    examples: `
      1. Common: 'How many 5-year-olds could you take in a fight?' vs Imposter: 'How many chicken nuggets could you eat in one sitting?'
      2. Common: 'How many days could you survive in the wild?' vs Imposter: 'How many hours could you listen to Baby Shark on loop?'
      3. Common: 'How many work days could you go without a shower?' vs Imposter: 'How many years would you stay in prison for £10 million?'
    `
  },
  {
    type: "SOCIAL_PRICE",
    structure: "Question MUST ask for a Price in GBP (£).",
    topic: "Ask about the price of DIGNITY, EMBARRASSMENT or INCONVENIENCE.",
    examples: `
      1. Common: 'Price to leak your entire browser history?' vs Imposter: 'Price to punch your best friend in the face?'
      2. Common: 'Price to never use a smartphone again?' vs Imposter: 'Price to wear a wedding dress to work tomorrow?'
      3. Common: 'Price to legally change your name to "Gary Glitter"?' vs Imposter: 'Price to sleep in a bin for a week?'
    `
  },
  {
    type: "IRRATIONAL_CONFIDENCE",
    structure: "Question MUST start with 'On a scale of 1-10...'",
    topic: "Ask about DELUSIONAL SKILLS, FIGHTING ANIMALS, or SURVIVAL SCENARIOS.",
    examples: `
      1. Common: 'Scale 1-10, confidence in landing a plane in an emergency?' vs Imposter: 'Scale 1-10, confidence in winning a fight against a bear?'
      2. Common: 'Scale 1-10, how well would you do in a fight against Mike Tyson?' vs Imposter: 'Scale 1-10, how good are you at dancing?'
      3. Common: 'Scale 1-10, chance of surviving a Zombie apocalypse?' vs Imposter: 'Scale 1-10, how good do you look in a hat?'
    `
  },
  {
    type: "PERCENTAGE_CHANCE",
    structure: "Question MUST ask for a Percentage (0-100%).",
    topic: "Ask about LUCK, ACCIDENTS, or PERSONALITY FLAWS.",
    examples: `
      1. Common: 'Odds you would join a cult by accident?' vs Imposter: 'Odds you could get away with a bank robbery?'
      2. Common: 'Percentage chance we are currently in a simulation?' vs Imposter: 'Percentage of your brain thinking about food right now?'
      3. Common: 'Odds you will be famous one day?' vs Imposter: 'Odds you would survive on a desert island?'
    `
  }
];

export async function POST(req: Request) {
  try {
    const { type, customPrompt } = await req.json();

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite-preview-09-2025" });
    const archetype = QUESTION_ARCHETYPES[Math.floor(Math.random() * QUESTION_ARCHETYPES.length)];

    let prompt = "";

    const ukContext = `
      TARGET AUDIENCE: British Dinner Party / Social Game.
      TONE: Fun, Relatable, Hypothetical.

      LOCALISATION RULES:
      1. UK Spelling (Colour, Favourite).
      2. £ Pounds for money.
    `;

    if (type === "question") {
      prompt = `
        ${ukContext}

        Generate a JSON object for a social deduction game.

        ARCHETYPE: ${archetype.type}

        RULES:
        1. ${archetype.structure}
        2. ${archetype.topic}
        3. NO Alcohol, Pubs, or Drinking questions. NO "Deep" or "Depressing" topics.
        4. The two questions must be about COMPLETELY different topics (e.g. Planes vs Geese) but share the exact same answer format/range.

        Context: ${customPrompt || "Fun social dilemmas"}.

        Requirements:
        1. 'common': The question for the majority.
        2. 'imposter': A DIFFERENT, UNRELATED question.
        3. 'category': Short label describing the ANSWER TYPE.

        Examples:
        ${archetype.examples}

        Output JSON only: { "common": string, "imposter": string, "category": string }
      `;
    } else {
      prompt = `
        ${ukContext}

        Generate a JSON object for a social deduction game.
        Mode: Nouns/Entities.
        Context: ${customPrompt || "Universal Pop Culture, Food, or Objects"}.

        Requirements:
        1. 'common': The word 80% of players receive.
        2. 'imposter': A DIFFERENT word that is closely related but distinct.
        3. 'category': Short label.

        Example: Common: "Coffee", Imposter: "Tea".

        Output JSON only: { "common": string, "imposter": string, "category": string }
      `;
    }

    const result = await model.generateContent(prompt);
    // Gemini sometimes wraps the JSON in a markdown code block
    const text = result.response.text().replace(/```json|```/g, "").trim();

    const { common, imposter, category } = JSON.parse(text);
    if (![common, imposter, category].every((v) => typeof v === "string" && v)) {
      throw new Error(`Incomplete response: ${text}`);
    }

    return NextResponse.json({ common, imposter, category });
  } catch (error) {
    console.error("Gemini Error:", error);
    return NextResponse.json({ error: "Couldn't generate a prompt. Try again." }, { status: 502 });
  }
}
