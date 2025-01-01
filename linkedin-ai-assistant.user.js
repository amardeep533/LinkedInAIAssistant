// ==UserScript==
// @name         LinkedIn AI Comment Assistant
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Enhance LinkedIn with AI-powered comment assistance
// @author       Your name
// @match        https://www.linkedin.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @require      https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.10.2/dist/web/min.js
// @require      https://cdn.jsdelivr.net/npm/openai@4.28.0/dist/browser.min.js
// ==/UserScript==

(function() {
    'use strict';

    // Add custom styles
    GM_addStyle(`
        .ai-assist-button {
            background-color: #0a66c2;
            color: white;
            border: none;
            border-radius: 16px;
            padding: 6px 16px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            margin-right: 8px;
        }

        .ai-preview-bubble {
            position: absolute;
            background: white;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            max-width: 400px;
            z-index: 1000;
        }

        .ai-settings-panel {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1001;
        }
    `);

    // Global state
    let currentProvider = null;
    let activeBubble = null;

    // Settings management
    function getSettings() {
        return {
            provider: GM_getValue('ai_provider', 'openai'),
            openaiKey: GM_getValue('openai_key', ''),
            anthropicKey: GM_getValue('anthropic_key', '')
        };
    }

    function saveSettings(settings) {
        GM_setValue('ai_provider', settings.provider);
        GM_setValue('openai_key', settings.openaiKey);
        GM_setValue('anthropic_key', settings.anthropicKey);
        initializeProvider();
    }

    // AI Providers
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

    // UI Components
    function createAIAssistButton() {
        const button = document.createElement('button');
        button.className = 'ai-assist-button';
        button.innerHTML = '<i class="fas fa-robot"></i> AI Assist';
        button.onclick = async (e) => {
            const postContent = getPostContent(e.target);
            await handleAIAssist(postContent, e.target);
        };
        return button;
    }

    function showPreviewBubble(comment, buttonElement) {
        if (activeBubble) {
            activeBubble.remove();
        }

        const bubble = document.createElement('div');
        bubble.className = 'ai-preview-bubble';

        const commentText = document.createElement('div');
        commentText.textContent = comment;

        const buttonsDiv = document.createElement('div');
        buttonsDiv.style.marginTop = '12px';

        const useButton = document.createElement('button');
        useButton.textContent = 'Use Comment';
        useButton.onclick = () => useComment(comment, bubble);

        const regenerateButton = document.createElement('button');
        regenerateButton.textContent = 'Regenerate';
        regenerateButton.onclick = () => regenerateComment(buttonElement);

        buttonsDiv.appendChild(useButton);
        buttonsDiv.appendChild(regenerateButton);

        bubble.appendChild(commentText);
        bubble.appendChild(buttonsDiv);

        const rect = buttonElement.getBoundingClientRect();
        bubble.style.top = `${rect.bottom + 8}px`;
        bubble.style.left = `${rect.left}px`;

        document.body.appendChild(bubble);
        activeBubble = bubble;
    }

    function showSettingsPanel() {
        const settings = getSettings();
        const panel = document.createElement('div');
        panel.className = 'ai-settings-panel';

        const content = `
            <h3>AI Assistant Settings</h3>
            <div style="margin: 10px 0;">
                <label style="display: block; margin-bottom: 5px;">Provider:</label>
                <select id="ai-provider" style="width: 100%; padding: 5px;">
                    <option value="openai" ${settings.provider === 'openai' ? 'selected' : ''}>OpenAI</option>
                    <option value="anthropic" ${settings.provider === 'anthropic' ? 'selected' : ''}>Anthropic</option>
                </select>
            </div>
            <div style="margin: 10px 0;">
                <label style="display: block; margin-bottom: 5px;">OpenAI API Key:</label>
                <input type="password" id="openai-key" value="${settings.openaiKey || ''}" style="width: 100%; padding: 5px;">
            </div>
            <div style="margin: 10px 0;">
                <label style="display: block; margin-bottom: 5px;">Anthropic API Key:</label>
                <input type="password" id="anthropic-key" value="${settings.anthropicKey || ''}" style="width: 100%; padding: 5px;">
            </div>
        `;

        panel.innerHTML = content;

        const saveButton = document.createElement('button');
        saveButton.textContent = 'Save';
        saveButton.style.cssText = 'background: #0a66c2; color: white; border: none; border-radius: 4px; padding: 8px 16px; margin-top: 16px; cursor: pointer; width: 100%;';
        saveButton.addEventListener('click', () => {
            const newSettings = {
                provider: document.getElementById('ai-provider').value,
                openaiKey: document.getElementById('openai-key').value,
                anthropicKey: document.getElementById('anthropic-key').value
            };
            saveSettings(newSettings);
            initializeProvider();
            panel.remove();
        });

        panel.appendChild(saveButton);
        document.body.appendChild(panel);
    }

    // Helper functions
    function getPostContent(element) {
        const post = element.closest('.feed-shared-update-v2');
        return post.querySelector('.feed-shared-text').textContent;
    }

    function useComment(comment, bubble) {
        const commentBox = document.querySelector('.comments-comment-box__form-container textarea');
        if (commentBox) {
            commentBox.value = comment;
            commentBox.dispatchEvent(new Event('input', { bubbles: true }));
        }
        bubble.remove();
        activeBubble = null;
    }

    async function regenerateComment(buttonElement) {
        const postContent = getPostContent(buttonElement);
        await handleAIAssist(postContent, buttonElement);
    }

    async function handleAIAssist(postContent, buttonElement) {
        try {
            const comment = await currentProvider.generateComment(postContent);
            showPreviewBubble(comment, buttonElement);
        } catch (error) {
            showError(error.message);
        }
    }

    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #ff4444; color: white; padding: 12px; border-radius: 4px;';
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 3000);
    }

    // DOM Observer
    function setupDOMObserver() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1 && node.matches('.feed-shared-update-v2')) {
                            injectAIButton(node);
                        }
                    });
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    function injectAIButton(postElement) {
        const actionsContainer = postElement.querySelector('.feed-shared-social-actions');
        if (actionsContainer && !actionsContainer.querySelector('.ai-assist-button')) {
            const button = createAIAssistButton();
            actionsContainer.insertBefore(button, actionsContainer.firstChild);
        }
    }

    // Initialize the application
    function initializeProvider() {
        const settings = getSettings();
        if (settings.provider === 'openai') {
            currentProvider = new OpenAIProvider(settings.openaiKey);
        } else {
            currentProvider = new AnthropicProvider(settings.anthropicKey);
        }
    }

    async function initialize() {
        if (!getSettings().openaiKey && !getSettings().anthropicKey) {
            showSettingsPanel();
        }
        initializeProvider();
        setupDOMObserver();
    }

    // Start the application when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();