
// ==UserScript==
// @name         LinkedIn AI Comment Assistant
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Enhance LinkedIn with AI-powered comment assistance
// @author       Your name
// @match        https://www.linkedin.com/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
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

    const OPENAI_KEY = 'YOUR-OPENAI-KEY-HERE'; // Replace with your actual OpenAI key

    async function generateComment(postContent) {
        log('Generating comment for post:', postContent.substring(0, 50) + '...');
        
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: 'https://api.openai.com/v1/chat/completions',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_KEY}`
                },
                data: JSON.stringify({
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
                }),
                onload: function(response) {
                    try {
                        const data = JSON.parse(response.responseText);
                        if (data.choices && data.choices[0] && data.choices[0].message) {
                            resolve(data.choices[0].message.content);
                        } else {
                            reject(new Error('Invalid response format'));
                        }
                    } catch (error) {
                        reject(error);
                    }
                },
                onerror: function(error) {
                    reject(new Error('Network error'));
                }
            });
        });
    }

    function createAIAssistButton() {
        log('Creating AI Assist button');
        const button = document.createElement('button');
        button.className = 'ai-assist-button';
        button.textContent = 'AI Assist';
        button.onclick = async (e) => {
            const post = e.target.closest('.feed-shared-update-v2, .feed-shared-post');
            const postContent = post.querySelector('.feed-shared-text, .feed-shared-post-text').textContent.trim();
            log('Post content:', postContent);
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

    let activeBubble = null;

    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #ff4444; color: white; padding: 12px; border-radius: 4px;';
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 3000);
    }

    // Setup observer to inject AI button
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            const feed = document.querySelectorAll('.feed-shared-update-v2, .feed-shared-post');
            feed.forEach(post => {
                const actionsContainer = post.querySelector('.social-actions-button-group, .feed-shared-social-actions');
                if (actionsContainer && !actionsContainer.querySelector('.ai-assist-button')) {
                    log('Injecting AI button');
                    actionsContainer.insertBefore(createAIAssistButton(), actionsContainer.firstChild);
                }
            });
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();
