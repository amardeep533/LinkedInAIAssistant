const { getSettings, saveSettings } = require('../config/settings.js');
const OpenAIProvider = require('../providers/openai-provider.js');
const AnthropicProvider = require('../providers/anthropic-provider.js');

class UIManager {
    constructor() {
        this.currentProvider = null;
        this.initializeProvider();
    }

    initializeProvider() {
        const settings = getSettings();
        if (settings.provider === 'openai') {
            this.currentProvider = new OpenAIProvider(settings.openaiKey);
        } else {
            this.currentProvider = new AnthropicProvider(settings.anthropicKey);
        }
    }

    createAIAssistButton() {
        const button = document.createElement('button');
        button.className = 'ai-assist-button';
        button.innerHTML = '<i class="fas fa-robot"></i> AI Assist';
        button.onclick = async (e) => {
            const postContent = this.getPostContent(e.target);
            await this.handleAIAssist(postContent, e.target);
        };
        return button;
    }

    async handleAIAssist(postContent, buttonElement) {
        try {
            const comment = await this.currentProvider.generateComment(postContent);
            this.showPreviewBubble(comment, buttonElement);
        } catch (error) {
            this.showError(error.message);
        }
    }

    showPreviewBubble(comment, buttonElement) {
        const bubble = document.createElement('div');
        bubble.className = 'ai-preview-bubble';
        bubble.innerHTML = `
            <div>${comment}</div>
            <div style="margin-top: 12px">
                <button onclick="this.useComment('${comment}')">Use Comment</button>
                <button onclick="this.regenerateComment()">Regenerate</button>
            </div>
        `;
        
        const rect = buttonElement.getBoundingClientRect();
        bubble.style.top = `${rect.bottom + 8}px`;
        bubble.style.left = `${rect.left}px`;
        
        document.body.appendChild(bubble);
    }

    showSettingsPanel() {
        const settings = getSettings();
        const panel = document.createElement('div');
        panel.className = 'ai-settings-panel';
        panel.innerHTML = `
            <h3>AI Assistant Settings</h3>
            <div>
                <label>Provider:</label>
                <select id="ai-provider">
                    <option value="openai" ${settings.provider === 'openai' ? 'selected' : ''}>OpenAI</option>
                    <option value="anthropic" ${settings.provider === 'anthropic' ? 'selected' : ''}>Anthropic</option>
                </select>
            </div>
            <div>
                <label>OpenAI API Key:</label>
                <input type="password" id="openai-key" value="${settings.openaiKey || ''}">
            </div>
            <div>
                <label>Anthropic API Key:</label>
                <input type="password" id="anthropic-key" value="${settings.anthropicKey || ''}">
            </div>
            <button onclick="this.saveSettings()">Save</button>
        `;
        document.body.appendChild(panel);
    }

    saveSettings() {
        const settings = {
            provider: document.getElementById('ai-provider').value,
            openaiKey: document.getElementById('openai-key').value,
            anthropicKey: document.getElementById('anthropic-key').value
        };
        saveSettings(settings);
        this.initializeProvider();
        document.querySelector('.ai-settings-panel').remove();
    }

    getPostContent(element) {
        const post = element.closest('.feed-shared-update-v2');
        return post.querySelector('.feed-shared-text').textContent;
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #ff4444; color: white; padding: 12px; border-radius: 4px;';
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 3000);
    }
}

function initializeUI() {
    const uiManager = new UIManager();
    return uiManager;
}

module.exports = { initializeUI };
