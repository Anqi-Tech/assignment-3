// Orchestrator: single-prompt agent selection → agent respond

import { geminiGenerate } from "../gemini.js";
import { CasualAgent } from "../agents/CasualAgent.js";
import { SadAgent } from "../agents/SadAgent.js";

const SELECTION_SCHEMA = {
    type: "OBJECT",
    properties: {
        agent: { type: "STRING" },
        reasons: { type: "STRING" },
    },
    required: ["agent"],
};
export class Orchestrator {
    constructor() {
        this.name = "casual_sad";
        this.agentByName = {
            casual: new CasualAgent(),
            sad: new SadAgent(),
        };
    }

    async _respondWith(agentName, contents) {
        const agent = this.agentByName[agentName] || this.agentByName.casual;
        const res = await agent.respond(contents);
        return res?.text || "";
    }

    async orchestrate(contents) {
        const orchestratorPrompt = `Your job is to choose which emotional agents should respond to the user right now.
        Think in two steps:
        1) What emotions would best connect with the user right now, and what do they need (e.g., reassurance, validation, encouragement, caution)? Prioritize the latest user message while considering prior user messages with light recency weighting.
        2) Pick the agent whose voice best matches that need.

        Available agents: "casual", "sad". ONLY USE ONE OF THESE AGENTS.

        Constraints:
        - Speak only through structured output. No extra text.
        - Choose agents only from the list above.
        - Prefer clarity and coherence over breadth.

        Output strictly as JSON:
        {
          "agent": "casual",
          "reasons": "User celebrated good news; needs warm encouragement"
        }`;

        const result = await geminiGenerate({
            contents,
            systemPrompt: orchestratorPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: SELECTION_SCHEMA,
            },
        });

        let agent = "casual";
        let reasons = "Defaulted to casual";

        try {
            const parsed = JSON.parse(result.text || "{}");
            agent = parsed?.agent;
            if (parsed?.reasons) reasons = String(parsed.reasons);
        } catch (_) {}

        const text = await this._respondWith(agent, contents);

        const frameSet = {
            frames: { persona: { value: agent, rationale: [reasons] } },
        };
        return { assistantMessage: text || "", frameSet, agent, reasons };
    }
}
