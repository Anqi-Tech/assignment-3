import { geminiGenerate } from "../gemini.js";

export class AngryAgent {
    constructor() {
        this.name = "example";
    }

    /**
     * Respond to the user with your agent's persona.
     *
     * TODO: Replace the systemPrompt with your persona's guidance.
     */
    async respond(contents) {
        const systemPrompt = `You are (short description).
            Setting:
            Participants:
            Ends:
            Act Sequence:
            Key:
            Instrumentalities:
            Norms:
            Genre: `;

        const { text } = await geminiGenerate({ contents, systemPrompt });
        return { text };
    }
}
