
// ==UserScript==
// @name         LinkedIn AI Comment Assistant
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Enhance LinkedIn with AI-powered comment assistance
// @author       Your name
// @match        https://www.linkedin.com/*
// @grant        GM_addStyle
// @require      https://cdn.jsdelivr.net/npm/openai@4.28.0/dist/browser/stream.min.js
// ==/UserScript==

(function() {
    'use strict';
    
    const DEBUG = true;
    function log(...args) {
        if (DEBUG) {
            console.log('[LinkedIn AI Assistant]', ...args);
        }
    }

    log('Script initialized');

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
    `);

    // Hardcoded OpenAI configuration
    const OPENAI_KEY = 'YOUR-OPENAI-KEY-HERE'; // Replace with your actual OpenAI key
    const openai = new window.OpenAI({ apiKey: OPENAI_KEY, dangerouslyAllowBrowser: true });
    let activeBubble = null;

    async function generateComment(postContent) {
        log('Generating comment for post:', postContent.substring(0, 50) + '...');
        try {
            const response = await openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: "You are a professional LinkedIn user. Generate an engaging, relevant comment for the given post."
                    },
                    {
                        role: "user",
                        content: postContent
                    }
                ],
                max_tokens: 150
            });
            return response.choices[0].message.content;
        } catch (error) {
            log('Error generating comment:', error);
            throw new Error(`OpenAI Error: ${error.message}`);
        }
    }

    function createAIAssistButton() {
        log('Creating AI Assist button');
        const button = document.createElement('button');
        button.className = 'ai-assist-button';
        button.textContent = 'AI Assist';
        button.onclick = async (e) => {
            const post = e.target.closest('.feed-shared-update-v2');
            const postContent = post.querySelector('.feed-shared-text').textContent;
            try {
                const comment = await generateComment(postContent);
                showPreviewBubble(comment, e.target);
            } catch (error) {
                showError(error.message);
            }
        };
        return button;
    }

    function showPreviewBubble(comment, buttonElement) {
        if (activeBubble) {
            activeBubble.remove();
        }

        const bubble = document.createElement('div');
        bubble.className = 'ai-preview-bubble';
        
        const commentText = document.createElement('p');
        commentText.textContent = comment;
        
        const useButton = document.createElement('button');
        useButton.textContent = 'Use Comment';
        useButton.onclick = () => {
            const commentBox = document.querySelector('.comments-comment-box__form-container textarea');
            if (commentBox) {
                commentBox.value = comment;
                commentBox.dispatchEvent(new Event('input', { bubbles: true }));
            }
            bubble.remove();
        };

        bubble.appendChild(commentText);
        bubble.appendChild(useButton);

        const rect = buttonElement.getBoundingClientRect();
        bubble.style.top = `${rect.bottom + 8}px`;
        bubble.style.left = `${rect.left}px`;

        document.body.appendChild(bubble);
        activeBubble = bubble;
    }

    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #ff4444; color: white; padding: 12px; border-radius: 4px;';
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 3000);
    }

    // Setup observer to inject AI button
    const observer = new MutationObserver((mutations) => {
        log('DOM mutation detected');
        mutations.forEach((mutation) => {
            if (mutation.addedNodes && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1 && node.matches('.feed-shared-update-v2')) {
                        const actionsContainer = node.querySelector('.feed-shared-social-actions');
                        if (actionsContainer && !actionsContainer.querySelector('.ai-assist-button')) {
                            actionsContainer.insertBefore(createAIAssistButton(), actionsContainer.firstChild);
                        }
                    }
                });
            }
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();
