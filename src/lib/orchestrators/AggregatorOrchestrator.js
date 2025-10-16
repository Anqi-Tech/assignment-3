import { geminiGenerate } from "../gemini.js";
import { CasualAgent } from "../agents/CasualAgent.js";
import { AngryAgent } from "../agents/AngryAgent.js";
import { ShyAgent } from "../agents/ShyAgent.js";

const SELECTION_SCHEMA = {
    type: "OBJECT",
    properties: {
        response: { type: "STRING" },
        dominantAgent: { type: "STRING" },
        reasoning: { type: "STRING" },
    },
    required: ["response", "dominantAgent"],
};

export class Orchestrator {
    constructor() {
        this.name = "casual_angry_shy_aggregate";
        this.agentByName = {
            casual: new CasualAgent(),
            angry: new AngryAgent(),
            shy: new ShyAgent(),
        };
    }

    async orchestrate(contents) {
        const [casualResponse, angryResponse, shyResponse] = await Promise.all([
            this.agentByName.casual.respond(contents),
            this.agentByName.angry.respond(contents),
            this.agentByName.shy.respond(contents),
        ]);

        const aggregatorPrompt = `Your job is to combine the voices of the three available agents to best respond to the user's most recent message.
            Available agents: "casual", "angry", "shy". ONLY USE ONE OF THESE AGENTS.
            - casual: calm, friendly, simple exchange.
            - angry: flustered, reactive (but not mean); triggered by teasing, compliments, or emotional confrontation.
            - shy: soft, hesitant, affectionate; triggered by honest kindness.

            Each agent's response to the user's message:
            - Casual: "${casualResponse?.text || ""}"
            - Angry: "${angryResponse?.text || ""}"
            - Shy: "${shyResponse?.text || ""}"

            Instructions:
            - Blend the voices of the three agents together into one message that sounds like a good friend who sometimes has a habit of trying to hide their feelings.
            - If the user sounds neutral or casual, prioritize the "casual" agent, but integrate a little bit of the "angry" agent too.
            - Don't force unnatural emotional layering. If it makes more sense to strictly use a singular agent's response, do that.
            - Use anger, pride, and contradictions to hide affection and embarassment, but let a bit of honesty slip through.
            - Let the user's honest kindness soften the anger.
            - Keep instrumentalities (e.g. italics, em dashes) where helpful.

            Constraints:
            - Speak only through structured output. No extra text.
            - Prefer emotional consistency and believability over variety.

            Output strictly as JSON:
            {
              "agent": "angry",
              "reasons": "User abruptly flirted; someone who is emotionally guarded would respond with flustered irritation."
            }`;

        const result = await geminiGenerate({
            contents,
            systemPrompt: aggregatorPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: SELECTION_SCHEMA,
            },
        });

        let agent = "casual";
        let reasons = "Defaulted to casual";
        let assistantMessage = "...I-I don’t know what to say, okay?!";

        try {
            const parsed = JSON.parse(result.text || "{}");
            assistantMessage = parsed?.response || assistantMessage;
            agent = parsed?.dominantAgent || "casual";
            reasons =
                parsed?.reasoning ||
                `Multiple agents aggregated, dominant agent: ${agent}`;
        } catch (_) {}

        const frameSet = {
            frames: {
                persona: {
                    value: "multi",
                    rationale: [reasons],
                },
            },
        };
        return { assistantMessage, frameSet, agent, reasons };
    }
}
