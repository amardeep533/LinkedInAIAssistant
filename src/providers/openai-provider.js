// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
class OpenAIProvider {
    constructor(apiKey) {
        this.openai = new OpenAI({ apiKey });
    }

    async generateComment(postContent) {
        try {
            const response = await this.openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: "You are a professional LinkedIn user. Generate an engaging, relevant comment for the given post. The comment should be insightful, professional, and encourage meaningful discussion."
                    },
                    {
                        role: "user",
                        content: postContent
                    }
                ],
                max_tokens: 150,
                temperature: 0.7
            });

            return response.choices[0].message.content;
        } catch (error) {
            throw new Error(`OpenAI Error: ${error.message}`);
        }
    }
}

module.exports = OpenAIProvider;
