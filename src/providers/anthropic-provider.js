// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
class AnthropicProvider {
    constructor(apiKey) {
        this.anthropic = new Anthropic({ apiKey });
    }

    async generateComment(postContent) {
        try {
            const response = await this.anthropic.messages.create({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 150,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a professional LinkedIn user. Generate an engaging, relevant comment for the given post. The comment should be insightful, professional, and encourage meaningful discussion.'
                    },
                    {
                        role: 'user',
                        content: postContent
                    }
                ]
            });

            return response.content[0].text;
        } catch (error) {
            throw new Error(`Anthropic Error: ${error.message}`);
        }
    }
}

module.exports = AnthropicProvider;
