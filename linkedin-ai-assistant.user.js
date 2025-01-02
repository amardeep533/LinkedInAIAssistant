// ==UserScript==
// @name         LinkedIn AI Comment Assistant
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Simple AI comment helper for LinkedIn
// @author       Your name
// @match        https://www.linkedin.com/feed/*
// @grant        GM_addStyle
// @grant        GM_log
// @grant        GM_xmlhttpRequest
// @connect      api.openai.com
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    const DEBUG = true;
    function log(...args) {
        if (DEBUG) {
            console.log('%c[LinkedIn AI]', 'color: #0a66c2; font-weight: bold;', ...args);
        }
    }

    // OpenAI Configuration
    const OPENAI_CONFIG = {
        apiKey: 'sk-your-actual-api-key-here',
        model: 'gpt-4',
        maxTokens: 150
    };

    GM_addStyle(`
        /* Adjust main LinkedIn content when assistant is open */
        .ai-assistant-active .scaffold-layout__main {
            margin-right: 300px !important;
            transition: margin-right 0.3s ease;
        }

        #ai-assistant-box {
            position: fixed;
            top: 0;
            right: -300px; /* Start hidden */
            bottom: 0;
            z-index: 99999;
            background: white;
            border-left: 2px solid #0a66c2;
            padding: 12px;
            box-shadow: -2px 0 8px rgba(0,0,0,0.1);
            width: 300px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            transition: right 0.3s ease;
        }

        #ai-assistant-box.visible {
            right: 0;
        }

        #ai-assistant-toggle {
            position: fixed;
            top: 50%;
            right: 0;
            transform: translateY(-50%);
            background: #0a66c2;
            color: white;
            border: none;
            border-radius: 4px 0 0 4px;
            padding: 8px;
            cursor: pointer;
            z-index: 99999;
            box-shadow: -2px 0 8px rgba(0,0,0,0.1);
            writing-mode: vertical-lr;
            text-orientation: mixed;
            height: auto;
            font-size: 12px;
            transition: right 0.3s ease;
        }

        #ai-assistant-toggle.shifted {
            right: 300px;
        }

        #ai-assistant-box h3 {
            margin: 0 0 8px 0;
            font-size: 14px;
            color: #0a66c2;
        }

        .ai-button {
            background: #0a66c2;
            color: white;
            border: none;
            border-radius: 12px;
            padding: 6px 12px;
            cursor: pointer;
            font-weight: 600;
            margin: 3px;
            font-size: 12px;
            width: calc(100% - 6px);
        }

        .ai-generate-button {
            background: #057642;
        }

        .ai-content {
            margin: 8px 3px;
            padding: 8px;
            background: #f3f6f8;
            border-radius: 4px;
            font-size: 12px;
            white-space: pre-wrap;
            flex: 1;
            overflow-y: auto;
        }

        .ai-nav-buttons {
            display: flex;
            gap: 3px;
            margin: 3px;
        }

        .ai-status {
            font-size: 11px;
            color: #666;
            margin: 3px;
        }

        .ai-response {
            position: relative;
            padding-top: 24px !important;
            margin-top: 8px;
        }

        .ai-response-text {
            background: white;
            padding: 8px;
            border-radius: 4px;
            border: 1px solid #e0e0e0;
            margin: 6px 0;
            font-size: 12px;
            line-height: 1.4;
        }

        .ai-response-type {
            width: 100%;
            padding: 8px 24px 8px 12px;
            margin: 3px 0;
            border: 1px solid #0a66c2;
            border-radius: 4px;
            background: white url('data:image/svg+xml;charset=US-ASCII,<svg width="12" height="12" xmlns="http://www.w3.org/2000/svg"><path d="M2 4l4 4 4-4" stroke="%230a66c2" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>') no-repeat right 8px center;
            font-size: 12px;
            color: #000;
            appearance: none;
            -webkit-appearance: none;
            cursor: pointer;
            transition: border-color 0.2s, box-shadow 0.2s;
        }

        .ai-response-type:hover {
            border-color: #084e96;
            background-color: #f8f9fa;
        }

        .ai-response-type:focus {
            outline: none;
            border-color: #0a66c2;
            box-shadow: 0 0 0 2px rgba(10, 102, 194, 0.2);
        }

        .ai-response-type option {
            padding: 8px;
            font-size: 12px;
            background: white;
            color: #000;
        }

        .ai-custom-prompt {
            width: 100%;
            padding: 6px;
            margin: 3px 0;
            border: 1px solid #0a66c2;
            border-radius: 4px;
            min-height: 48px;
            font-size: 12px;
            resize: vertical;
            display: none;
        }

        .ai-copy-button {
            position: absolute;
            top: 2px;
            right: 2px;
            background: #057642;
            color: white;
            border: none;
            border-radius: 2px;
            padding: 1px 3px;
            cursor: pointer;
            font-size: 9px;
            display: inline-flex;
            align-items: center;
            gap: 2px;
            transition: all 0.2s;
            line-height: 1;
            height: 14px;
            opacity: 0.8;
        }
    `);

    // Function to get visible posts
    function getVisiblePosts() {
        const posts = document.querySelectorAll('div.feed-shared-update-v2, div[data-urn]');
        const viewportHeight = window.innerHeight;
        const buffer = 100;

        return Array.from(posts).filter(post => {
            const rect = post.getBoundingClientRect();
            return (
                (rect.top >= -buffer && rect.top <= viewportHeight) ||
                (rect.bottom >= 0 && rect.bottom <= viewportHeight + buffer) ||
                (rect.top <= 0 && rect.bottom >= viewportHeight)
            );
        });
    }

    // Function to get post content
    function getPostContent(post) {
        // Simpler selector focused on the most common "see more" button
        const expandButton = post.querySelector('button.see-more, .inline-show-more-text');

        return new Promise((resolve) => {
            if (expandButton && !expandButton.classList.contains('ai-processed')) {
                try {
                    log('Found expand button:', expandButton);
                    expandButton.classList.add('ai-processed');
                    expandButton.click();
                } catch (error) {
                    log('Error clicking expand button:', error);
                }
            }

            // Wait for content to expand
            setTimeout(() => {
                const contentSelectors = [
                    '.feed-shared-update-v2__description',
                    '.feed-shared-text-view',
                    '[data-test-id="main-feed-activity-card__commentary"]',
                    '.feed-shared-text-view__text-view'
                ];

                for (const selector of contentSelectors) {
                    const element = post.querySelector(selector);
                    if (element) {
                        const text = element.textContent.trim();
                        if (text && text.length > 20) {
                            resolve({ content: text, selector: selector });
                            return;
                        }
                    }
                }
                resolve(null);
            }, 1000);
        });
    }

    // Add response types configuration
    const RESPONSE_TYPES = {
        default: {
            label: "Professional & Balanced",
            prompt: "Write as if you're sharing a balanced, professional perspective"
        },
        supportive: {
            label: "Supportive & Encouraging",
            prompt: "Write an encouraging response that supports the post's message while adding personal insight"
        },
        critical: {
            label: "Constructively Critical",
            prompt: "Write a respectfully critical response that offers a different perspective"
        },
        funny: {
            label: "Light & Humorous",
            prompt: "Write a light-hearted, witty response that's still professional"
        },
        expert: {
            label: "Technical Expert",
            prompt: "Write as an experienced professional in this field, sharing technical insights"
        },
        story: {
            label: "Personal Experience",
            prompt: "Share a brief personal experience that relates to the post"
        },
        custom: {
            label: "Custom Prompt",
            prompt: "" // Will be filled from textarea
        }
    };

    // Function to create the prompt
    function createPrompt(postContent, responseType, customPrompt = '') {
        const type = RESPONSE_TYPES[responseType];
        const basePrompt = responseType === 'custom' ? customPrompt : type.prompt;

        return {
            messages: [
                {
                    role: "system",
                    content: `You are a thoughtful professional engaging with posts on LinkedIn. Guidelines:
                    - ${basePrompt}
                    - Keep it brief (1-2 sentences)
                    - Be specific to the post's content
                    - Sound natural and conversational
                    - Avoid corporate jargon
                    - Never use hashtags or emojis
                    ${responseType === 'custom' ? '- Maintain professional tone while following the custom prompt' : ''}`
                },
                {
                    role: "user",
                    content: `Write a ${responseType} comment for this LinkedIn post:\n\n${postContent}`
                }
            ],
            temperature: responseType === 'funny' ? 0.9 : 0.7,
            presence_penalty: 0.6,
            frequency_penalty: 0.6
        };
    }

    // Function to call OpenAI API
    async function generateAIResponse(postContent, responseType = 'default', customPrompt = '') {
        return new Promise((resolve, reject) => {
            const prompt = createPrompt(postContent, responseType, customPrompt);
            log('Sending prompt to OpenAI:', prompt);

            // Log the request details
            const requestData = {
                model: OPENAI_CONFIG.model,
                messages: prompt.messages,
                max_tokens: OPENAI_CONFIG.maxTokens,
                temperature: prompt.temperature,
                presence_penalty: prompt.presence_penalty,
                frequency_penalty: prompt.frequency_penalty,
                top_p: 0.9
            };
            log('Request data:', requestData);

            GM_xmlhttpRequest({
                method: 'POST',
                url: 'https://api.openai.com/v1/chat/completions',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_CONFIG.apiKey}`
                },
                data: JSON.stringify(requestData),
                onload: function (response) {
                    log('Raw response:', response);
                    try {
                        if (response.status === 200) {
                            const data = JSON.parse(response.responseText);
                            log('Parsed response data:', data);
                            resolve({
                                suggestion: data.choices[0].message.content.trim(),
                                metadata: {
                                    model: OPENAI_CONFIG.model,
                                    promptTokens: data.usage.prompt_tokens,
                                    responseTokens: data.usage.completion_tokens
                                }
                            });
                        } else {
                            const error = JSON.parse(response.responseText);
                            log('API error response:', error);
                            reject(new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'} (Status: ${response.status})`));
                        }
                    } catch (error) {
                        log('Error parsing response:', error, 'Raw response:', response.responseText);
                        reject(new Error('Failed to parse OpenAI response: ' + error.message));
                    }
                },
                onerror: function (error) {
                    log('Network error:', error);
                    reject(new Error('Failed to connect to OpenAI API: ' + error.message));
                }
            });
        });
    }

    // Create container with full functionality
    function createContainer() {
        // Create toggle button
        const toggleButton = document.createElement('button');
        toggleButton.id = 'ai-assistant-toggle';
        toggleButton.textContent = 'AI Assistant ◀';
        document.body.appendChild(toggleButton);

        // Create main container
        const container = document.createElement('div');
        container.id = 'ai-assistant-box';

        const title = document.createElement('h3');
        title.textContent = 'LinkedIn AI Assistant';
        title.style.margin = '0 0 10px 0';

        const status = document.createElement('div');
        status.className = 'ai-status';

        const analyzeButton = document.createElement('button');
        analyzeButton.className = 'ai-button';
        analyzeButton.textContent = 'Analyze Visible Posts';

        const navButtons = document.createElement('div');
        navButtons.className = 'ai-nav-buttons';

        const prevButton = document.createElement('button');
        prevButton.className = 'ai-button';
        prevButton.textContent = '← Previous';
        prevButton.style.display = 'none';

        const nextButton = document.createElement('button');
        nextButton.className = 'ai-button';
        nextButton.textContent = 'Next →';
        nextButton.style.display = 'none';

        navButtons.appendChild(prevButton);
        navButtons.appendChild(nextButton);

        const content = document.createElement('div');
        content.className = 'ai-content';
        content.style.display = 'none';

        const responseTypeSelect = document.createElement('select');
        responseTypeSelect.className = 'ai-response-type';
        Object.entries(RESPONSE_TYPES).forEach(([value, { label }]) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            responseTypeSelect.appendChild(option);
        });

        const customPromptArea = document.createElement('textarea');
        customPromptArea.className = 'ai-custom-prompt';
        customPromptArea.placeholder = 'Enter your custom prompt here...';

        responseTypeSelect.addEventListener('change', () => {
            customPromptArea.style.display =
                responseTypeSelect.value === 'custom' ? 'block' : 'none';
        });

        const generateButton = document.createElement('button');
        generateButton.className = 'ai-button ai-generate-button';
        generateButton.textContent = 'Generate AI Response';
        generateButton.style.display = 'none';

        let currentPosts = [];
        let currentIndex = 0;

        async function updateContent(index) {
            if (index >= 0 && index < currentPosts.length) {
                const extracted = await getPostContent(currentPosts[index]);
                if (extracted) {
                    content.style.display = 'block';
                    content.textContent = `Post ${index + 1} of ${currentPosts.length}:\n\n${extracted.content}`;
                    generateButton.style.display = 'block';
                    prevButton.style.display = index > 0 ? 'block' : 'none';
                    nextButton.style.display = index < currentPosts.length - 1 ? 'block' : 'none';
                }
            }
        }

        analyzeButton.onclick = async () => {
            currentPosts = getVisiblePosts();
            status.textContent = `Found ${currentPosts.length} visible posts`;
            currentIndex = 0;
            if (currentPosts.length > 0) {
                await updateContent(0);
            } else {
                content.style.display = 'block';
                content.textContent = 'No visible posts found. Try scrolling to view posts.';
                generateButton.style.display = 'none';
            }
        };

        prevButton.onclick = async () => {
            if (currentIndex > 0) {
                currentIndex--;
                await updateContent(currentIndex);
            }
        };

        nextButton.onclick = async () => {
            if (currentIndex < currentPosts.length - 1) {
                currentIndex++;
                await updateContent(currentIndex);
            }
        };

        generateButton.onclick = async () => {
            const currentPost = currentPosts[currentIndex];
            const extracted = await getPostContent(currentPost);

            if (!extracted) return;

            try {
                generateButton.disabled = true;
                generateButton.textContent = 'Generating...';
                status.textContent = 'Generating AI response...';

                const responseType = responseTypeSelect.value;
                const customPrompt = customPromptArea.value;
                const response = await generateAIResponse(
                    extracted.content,
                    responseType,
                    customPrompt
                );

                // Create or update response display
                let responseDisplay = container.querySelector('.ai-response');
                if (!responseDisplay) {
                    responseDisplay = document.createElement('div');
                    responseDisplay.className = 'ai-content ai-response';
                    container.appendChild(responseDisplay);
                }

                responseDisplay.innerHTML = `
                    <button class="ai-copy-button">
                        Copy
                    </button>
                    <strong>AI Suggested Response:</strong>
                    <div class="ai-response-text">${response.suggestion}</div>
                    <small style="color: #666; margin-top: 8px; display: block;">
                        Model: ${response.metadata.model}<br>
                        Tokens: ${response.metadata.promptTokens + response.metadata.responseTokens}
                    </small>
                `;
                responseDisplay.style.display = 'block';

                // Add click handler for copy button
                const copyButton = responseDisplay.querySelector('.ai-copy-button');
                copyButton.addEventListener('click', async () => {
                    try {
                        await navigator.clipboard.writeText(response.suggestion);
                        const originalText = copyButton.textContent;
                        copyButton.textContent = '✓ Copied!';
                        copyButton.style.background = '#2e7d32';
                        setTimeout(() => {
                            copyButton.textContent = originalText;
                            copyButton.style.background = '';
                        }, 2000);
                    } catch (err) {
                        log('Copy failed:', err);
                        status.textContent = 'Failed to copy to clipboard';
                        copyButton.textContent = '❌ Failed';
                        setTimeout(() => {
                            copyButton.textContent = originalText;
                        }, 2000);
                    }
                });

                status.textContent = 'Response generated successfully';
            } catch (error) {
                status.textContent = `Error: ${error.message}`;
                log('Generation error:', error);
            } finally {
                generateButton.disabled = false;
                generateButton.textContent = 'Generate AI Response';
            }
        };

        container.appendChild(title);
        container.appendChild(status);
        container.appendChild(analyzeButton);
        container.appendChild(navButtons);
        container.appendChild(content);
        container.appendChild(responseTypeSelect);
        container.appendChild(customPromptArea);
        container.appendChild(generateButton);

        // Add toggle functionality
        toggleButton.addEventListener('click', () => {
            const isVisible = container.classList.toggle('visible');
            toggleButton.classList.toggle('shifted');
            toggleButton.textContent = isVisible ? 'AI Assistant ▶' : 'AI Assistant ◀';
            document.body.classList.toggle('ai-assistant-active');
        });

        // Add close button inside container
        const closeButton = document.createElement('button');
        closeButton.style.cssText = `
            position: absolute;
            top: 8px;
            right: 8px;
            background: none;
            border: none;
            color: #666;
            cursor: pointer;
            font-size: 18px;
            padding: 4px;
        `;
        closeButton.textContent = '×';
        closeButton.onclick = () => {
            container.classList.remove('visible');
            toggleButton.classList.remove('shifted');
            toggleButton.textContent = 'AI Assistant ◀';
            document.body.classList.remove('ai-assistant-active');
        };

        // Add close button as first child
        container.insertBefore(closeButton, container.firstChild);

        document.body.appendChild(container);
        log('Container created with full functionality');
    }

    function init() {
        log('Initializing...');

        function createElements() {
            log('Creating elements...');

            // First create and add the toggle button
            if (!document.getElementById('ai-assistant-toggle')) {
                const toggleButton = document.createElement('button');
                toggleButton.id = 'ai-assistant-toggle';
                toggleButton.textContent = 'AI Assistant ◀';
                toggleButton.style.cssText = `
                    position: fixed;
                    top: 50%;
                    right: 0;
                    transform: translateY(-50%);
                    background: #0a66c2;
                    color: white;
                    border: none;
                    border-radius: 4px 0 0 4px;
                    padding: 8px;
                    cursor: pointer;
                    z-index: 99999;
                    box-shadow: -2px 0 8px rgba(0,0,0,0.1);
                    writing-mode: vertical-lr;
                    text-orientation: mixed;
                    height: auto;
                    font-size: 12px;
                `;
                document.body.appendChild(toggleButton);
                log('Toggle button created');

                // Only create container after toggle button exists
                createContainer();
            }
        }

        // Try immediately
        createElements();

        // Also try after a short delay
        setTimeout(createElements, 2000);

        // And keep trying every second for up to 10 seconds
        let attempts = 0;
        const maxAttempts = 10;
        const checkInterval = setInterval(() => {
            log('Checking if elements exist...');
            if (!document.getElementById('ai-assistant-toggle')) {
                attempts++;
                if (attempts < maxAttempts) {
                    createElements();
                } else {
                    clearInterval(checkInterval);
                    log('Failed to create elements after maximum attempts');
                }
            } else {
                clearInterval(checkInterval);
                log('Elements already exist');
            }
        }, 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    log('Script loaded');
})();
