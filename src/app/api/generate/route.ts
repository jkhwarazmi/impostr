import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { type, customPrompt } = await req.json(); // type: 'noun' or 'question'

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    let prompt = "";

    const ukContext = `
      TARGET AUDIENCE: United Kingdom (British).
      CRITICAL LOCALISATION RULES:
      1. NO US-specific concepts (e.g., "Jaywalking", "GPA", "Spring Break", "Thanksgiving", "4th of July", "Inches/Miles" unless standard).
      2. Use UK Terminology: "Holiday" (not Vacation), "Pavement" (not Sidewalk), "University" (not College), "Mobile" (not Cell).
      3. Currency: Must use £ (Pounds) if money is mentioned.
      4. Avoid US Sports references (NFL, Baseball) unless globally famous.
    `;

    if (type === "question") {
      prompt = `
        ${ukContext}

        Generate a JSON object for a social deduction game.

        CRITICAL RULE: Do NOT generate factual trivia.
        Generate SUBJECTIVE, OPINION-BASED, or SOCIAL NORM questions where answers generally fall in a similar range.

        Goal: Two DIFFERENT questions that expect the SAME TYPE OF ANSWER (e.g., an age, a price in £, a rating 1-10).

        Context: ${customPrompt || "British social norms, mild dilemmas, or funny opinions"}.

        Requirements:
        1. 'common': The question for the majority.
        2. 'imposter': A DIFFERENT question for the imposter.
        3. 'category': Short label.

        Good Examples (UK/Universal):
        - Common: "What is a socially acceptable time to go to the pub on a Sunday?" (Ans: ~12pm-2pm)
        - Imposter: "What time do you usually have Sunday Roast?" (Ans: ~1pm-3pm)

        - Common: "How much is a reasonable price for a pint of beer in London?" (Ans: ~£6-£8)
        - Imposter: "How much would you pay for a meal deal?" (Ans: ~£3-£5)

        - Common: "On a scale of 1-10, how annoying is the Tube in summer?" (Ans: High)
        - Imposter: "On a scale of 1-10, how stressful is queue jumping?" (Ans: High)

        Output JSON only: { "common": string, "imposter": string, "category": string }
      `;
    } else {
        prompt = `
        ${ukContext}

        Generate a JSON object for a social deduction game.
        Mode: Nouns/Entities.
        Context: ${customPrompt || "British Culture, Pop Culture, or General Knowledge"}.

        Requirements:
        1. 'common': The word 80% of players receive.
        2. 'imposter': A DIFFERENT word that is closely related but distinct.
        3. 'category': Short label.

        Example: Common: "Tesco", Imposter: "Sainsbury's".
        Example: Common: "Fish and Chips", Imposter: "Sunday Roast".

        Output JSON only: { "common": string, "imposter": string, "category": string }
      `;
    }

    const result = await model.generateContent(prompt);
    const response = await result.response;
    // Gemini sometimes wraps the JSON in a markdown code block
    const text = response.text().replace(/```json|```/g, "").trim();

    return NextResponse.json(JSON.parse(text));
  } catch (error) {
    console.error("Gemini Error:", error);
    return NextResponse.json(
      {
        common: "Error generating",
        imposter: "Manual Mode",
        category: "System Error"
      },
      { status: 500 }
    );
  }
}
