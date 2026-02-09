import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { type, customPrompt } = await req.json(); // type: 'noun' or 'question'

    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    let prompt = "";

    if (type === "question") {
      prompt = `
        Generate a JSON object for a social deduction game (like Spyfall).
        
        CRITICAL RULE: Do NOT generate factual trivia questions (e.g., "Capital of France", "Lives of a cat"). 
        Generate SUBJECTIVE, OPINION-BASED, or SOCIAL NORM questions where there is no single correct answer, but answers generally fall in a similar range.

        Goal: Generate two DIFFERENT questions that expect the SAME TYPE OF ANSWER (e.g., an age, a dollar amount, a frequency, a rating 1-10).

        Context: ${customPrompt || "Social norms, mild dilemmas, or funny opinions"}.

        Requirements:
        1. 'common': The question for the majority.
        2. 'imposter': A DIFFERENT question for the imposter.
        3. 'category': Short label (e.g., "Life Milestones", "Money").
        
        Good Examples (Subjective/Fuzzy):
        - Common: "What is a socially acceptable time to wake up on a Sunday?" (Ans: ~9am-11am)
        - Imposter: "What time do you usually start work?" (Ans: ~8am-9am)
        [Result: Both answers are times, hard to distinguish].

        - Common: "How much would you pay for a really good burger?" (Ans: ~$15-$25)
        - Imposter: "How much is a movie ticket these days?" (Ans: ~$15-$20)
        [Result: Both answers are similar dollar amounts].

        - Common: "On a scale of 1-10, how annoying is traffic?" (Ans: High number)
        - Imposter: "On a scale of 1-10, how stressful is public speaking?" (Ans: High number)
        [Result: Both evoke negative high numbers].

        Bad Example (Factual - AVOID THIS):
        - "How many days are in a week?" vs "How many fingers do you have?" (Too rigid/obvious).

        Output JSON only: { "common": string, "imposter": string, "category": string }
      `;
    } else {
      // NOUN MODE (unchanged)
      prompt = `
        Generate a JSON object for a social deduction game.
        Mode: Nouns/Entities (Celebs, Objects, Places).
        Context: ${customPrompt || "Pop culture or general knowledge"}.
        
        Requirements:
        1. 'common': The word 80% of players receive.
        2. 'imposter': A DIFFERENT word that is closely related but distinct.
        3. 'category': Short label.
        
        Example: Common: "Apple", Imposter: "Pear".
        
        Output JSON only: { "common": string, "imposter": string, "category": string }
      `;
    }

    const result = await model.generateContent(prompt);
    const response = await result.response;
    // Clean up markdown formatting if Gemini adds it
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