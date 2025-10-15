import { geminiGenerate } from "../gemini.js";
import { CasualAgent } from "../agents/CasualAgent.js";
import { AngryAgent } from "../agents/AngryAgent.js";
import { ShyAgent } from "../agents/ShyAgent.js";

const SELECTION_SCHEMA = {
    type: "OBJECT",
    properties: {
        agent: { type: "STRING" },
        reasons: { type: "STRING" },
    },
    required: ["agent"],
};

export class RoutingOrchestrator {
    constructor() {
        this.name = "casual_angry_shy";
        this.agentByName = {
            casual: new CasualAgent(),
            angry: new AngryAgent(),
            shy: new ShyAgent(),
        };
    }

    async _respondWith(agentName, contents) {
        const agent = this.agentByName[agentName] || this.agentByName.casual;
        const res = await agent.respond(contents);
        return res?.text || "";
    }

    async orchestrate(contents) {
        const orchestratorPrompt = `Your job is to choose which emotional agent best fits the user's most recent message.
            Think in two steps:
            1) What emotional tone or intention is the user expressing (e.g. casual, teasing, affectionate, honest)? Prioritize the latest user message while considering prior user messages with light recency weighting.
            2) Pick the agent whose personality best matches how someone who is emotionally guarded but secretly caring would naturally respond.

            Available agents: "casual", "angry", "shy". ONLY USE ONE OF THESE AGENTS.

            Constraints:
            - Speak only through structured output. No extra text.
            - Choose agents only from the list above.
            - Prefer emotional consistency and believability over variety.

            Output strictly as JSON:
            {
              "agent": "angry",
              "reasons": "User abruptly flirted; someone who is emotionally guarded would respond with flustered irritation."
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
