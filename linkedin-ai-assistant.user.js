// ==UserScript==
// @name         LinkedIn AI Comment Assistant
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Simple AI comment helper for LinkedIn
// @author       Amardeep Singh
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
        apiKey: '',  // Will be populated from localStorage
        model: 'gpt-4',  // Default model, can be overridden by settings
        maxTokens: 150
    };

    // Load saved settings at startup
    const savedSettings = JSON.parse(localStorage.getItem('ai-assistant-settings') || '{}');
    if (savedSettings.apiKey) {
        OPENAI_CONFIG.apiKey = savedSettings.apiKey;
    }
    if (savedSettings.model) {
        OPENAI_CONFIG.model = savedSettings.model;
    }

    GM_addStyle(`
        #ai-assistant-box {
            position: fixed !important;
            top: 0 !important;
            right: -300px !important;
            bottom: 0 !important;
            width: 300px !important;
            background: white !important;
            border-left: 2px solid #0a66c2 !important;
            transition: right 0.3s ease !important;
            z-index: 99999 !important;
        }

        #ai-assistant-box.visible {
            right: 0 !important;
        }

        #ai-assistant-toggle {
            position: fixed !important;
            top: 50% !important;
            right: 0 !important;
            transform: translateY(-50%) !important;
            background: #0a66c2 !important;
            color: white !important;
            border: none !important;
            border-radius: 4px 0 0 4px !important;
            padding: 8px !important;
            cursor: pointer !important;
            z-index: 99999 !important;
            writing-mode: vertical-lr !important;
            text-orientation: mixed !important;
            height: auto !important;
            font-size: 12px !important;
            transition: right 0.3s ease !important;
        }

        #ai-assistant-toggle.shifted {
            right: 300px !important;
        }

        #ai-assistant-box {
            padding: 12px !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
        }

        .ai-button {
            background: #0a66c2 !important;
            color: white !important;
            border: none !important;
            border-radius: 12px !important;
            padding: 6px 12px !important;
            cursor: pointer !important;
            font-weight: 600 !important;
            margin: 3px !important;
            font-size: 12px !important;
            width: calc(100% - 6px) !important;
        }

        .ai-content {
            margin: 8px 3px !important;
            padding: 8px !important;
            background: #f3f6f8 !important;
            border-radius: 4px !important;
            font-size: 12px !important;
            white-space: pre-wrap !important;
            flex: 1 !important;
            overflow-y: auto !important;
        }

        .ai-status {
            font-size: 11px !important;
            color: #666 !important;
            margin: 3px !important;
        }

        .ai-nav-buttons {
            display: flex !important;
            gap: 3px !important;
            margin: 3px !important;
        }

        .ai-nav-buttons .ai-button {
            flex: 1 !important;
        }

        .ai-response-type {
            width: 100% !important;
            padding: 8px 24px 8px 12px !important;
            margin: 3px 0 !important;
            border: 1px solid #0a66c2 !important;
            border-radius: 4px !important;
            background: white url('data:image/svg+xml;charset=US-ASCII,<svg width="12" height="12" xmlns="http://www.w3.org/2000/svg"><path d="M2 4l4 4 4-4" stroke="%230a66c2" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>') no-repeat right 8px center !important;
            font-size: 12px !important;
            color: #000 !important;
            appearance: none !important;
            -webkit-appearance: none !important;
            cursor: pointer !important;
        }

        .ai-response {
            position: relative !important;
            padding-top: 24px !important;
            margin-top: 8px !important;
        }

        .ai-response-text {
            position: relative !important;
            background: white !important;
            padding: 16px !important;
            padding-bottom: 48px !important; /* Space for the copy button */
            border-radius: 8px !important;
            border: 1px solid #e0e0e0 !important;
            margin: 6px 0 !important;
            font-size: 12px !important;
            line-height: 1.4 !important;
        }

        .ai-generate-button {
            background: #057642 !important;
        }
    `);

    // Add these styles first
    GM_addStyle(`
        .ai-modal-backdrop {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            background: rgba(0,0,0,0.5) !important;
            z-index: 99999 !important;
            display: none !important;
        }

        .ai-settings-modal {
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            background: white !important;
            padding: 20px !important;
            border-radius: 8px !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
            z-index: 100000 !important;
            width: 400px !important;
            display: none !important;
        }

        .ai-modal-backdrop.visible,
        .ai-settings-modal.visible {
            display: block !important;
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

    // Add this function to create the settings modal
    function createSettingsModal() {
        const backdrop = document.createElement('div');
        backdrop.className = 'ai-modal-backdrop';

        const modal = document.createElement('div');
        modal.className = 'ai-settings-modal';

        // Create header
        const header = document.createElement('div');
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';

        const title = document.createElement('h3');
        title.textContent = 'Settings';
        title.style.margin = '0';

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = 'background: none; border: none; font-size: 20px; cursor: pointer;';

        header.appendChild(title);
        header.appendChild(closeBtn);

        // Create model selection
        const models = [
            { value: 'gpt-3.5-turbo', text: 'GPT-3.5 Turbo ($0.0015/1K tokens) - Fast & Economic' },
            { value: 'gpt-3.5-turbo-16k', text: 'GPT-3.5 Turbo 16k ($0.003/1K tokens) - Extended Context' },
            { value: 'claude-3-haiku-20240307', text: 'Claude 3 Haiku ($0.0025/1K tokens) - Fast & Efficient' },
            { value: 'claude-3-sonnet-20240229', text: 'Claude 3 Sonnet ($0.003/1K tokens) - Balanced' },
            { value: 'claude-3.5-sonnet-20240229', text: 'Claude 3.5 Sonnet ($0.003/1K tokens) - Latest Balanced' },
            { value: 'gpt-4o-mini', text: 'GPT-4 Optimized Mini ($0.008/1K tokens) - Fast & Efficient' },
            { value: 'gpt-4-turbo-preview', text: 'GPT-4 Turbo ($0.01/1K tokens) - Latest & Fast' },
            { value: 'gpt-4o', text: 'GPT-4 Optimized ($0.012/1K tokens) - Best Performance/Cost' },
            { value: 'claude-3-opus-20240229', text: 'Claude 3 Opus ($0.015/1K tokens) - Most Capable' },
            { value: 'gpt-4', text: 'GPT-4 ($0.03/1K tokens) - Most Reliable' },
            { value: 'gpt-4-vision-preview', text: 'GPT-4 Vision ($0.03/1K tokens) - Image Understanding' },
            { value: 'gpt-4-32k', text: 'GPT-4 32k ($0.06/1K tokens) - Longest Context' },
            { value: 'gpt-4-all-tools', text: 'GPT-4 All Tools ($0.08/1K tokens) - Full Capabilities' }
        ];

        // Create all elements first
        const modelContainer = document.createElement('div');
        modelContainer.style.marginTop = '15px';

        const modelLabel = document.createElement('label');
        modelLabel.textContent = 'AI Model';
        modelLabel.style.cssText = 'display: block; font-size: 12px; font-weight: 600; margin-bottom: 4px;';

        const modelSelect = document.createElement('select');
        modelSelect.id = 'ai-settings-model';
        modelSelect.style.cssText = 'width: 100%; padding: 8px; border: 1px solid #0a66c2; border-radius: 4px; font-size: 12px;';

        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.value;
            option.textContent = model.text;
            modelSelect.appendChild(option);
        });

        const apiKeyContainer = document.createElement('div');
        apiKeyContainer.style.marginTop = '15px';

        const apiKeyLabel = document.createElement('label');
        apiKeyLabel.textContent = 'OpenAI API Key';
        apiKeyLabel.style.cssText = 'display: block; font-size: 12px; font-weight: 600; margin-bottom: 4px;';

        const apiKeyInput = document.createElement('input');
        apiKeyInput.type = 'password';
        apiKeyInput.id = 'ai-settings-apikey';
        apiKeyInput.placeholder = 'Enter your OpenAI API key';
        apiKeyInput.style.cssText = 'width: 100%; padding: 8px; border: 1px solid #0a66c2; border-radius: 4px; font-size: 12px;';

        // Now load saved settings after elements are created
        const savedSettings = JSON.parse(localStorage.getItem('ai-assistant-settings') || '{}');
        if (savedSettings.apiKey) {
            apiKeyInput.value = savedSettings.apiKey;
        }
        if (savedSettings.model) {
            modelSelect.value = savedSettings.model;
            log('Setting model to:', savedSettings.model);  // Debug log
        }

        // Create save button
        const saveButton = document.createElement('button');
        saveButton.textContent = 'Save Settings';
        saveButton.style.cssText = `
            width: 100%;
            padding: 8px;
            background: #0a66c2;
            color: white;
            border: none;
            border-radius: 16px;
            cursor: pointer;
            font-weight: 600;
            margin-top: 20px;
        `;

        // Append everything to modal
        modelContainer.appendChild(modelLabel);
        modelContainer.appendChild(modelSelect);
        modal.appendChild(header);
        modal.appendChild(modelContainer);
        modal.appendChild(apiKeyContainer);
        modal.appendChild(saveButton);

        // Close handlers
        const closeModal = () => {
            backdrop.classList.remove('visible');
            modal.classList.remove('visible');
        };

        closeBtn.onclick = closeModal;
        backdrop.onclick = closeModal;

        document.body.appendChild(backdrop);
        document.body.appendChild(modal);

        // Add save button click handler
        saveButton.onclick = () => {
            const settings = {
                apiKey: apiKeyInput.value,
                model: modelSelect.value
            };

            // Save to localStorage
            localStorage.setItem('ai-assistant-settings', JSON.stringify(settings));

            // Update OPENAI_CONFIG
            OPENAI_CONFIG.apiKey = settings.apiKey;
            OPENAI_CONFIG.model = settings.model;

            // Show success message
            const successMsg = document.createElement('div');
            successMsg.textContent = 'Settings saved successfully!';
            successMsg.style.cssText = `
                color: #057642;
                font-size: 12px;
                margin-top: 10px;
                text-align: center;
            `;
            modal.appendChild(successMsg);

            // Remove success message after 2 seconds
            setTimeout(() => {
                modal.removeChild(successMsg);
                closeModal();
            }, 2000);
        };

        return {
            show: () => {
                backdrop.classList.add('visible');
                modal.classList.add('visible');
            }
        };
    }

    // Add style for settings button
    GM_addStyle(`
        .ai-settings-button {
            position: absolute !important;
            top: 8px !important;
            right: 32px !important;
            background: none !important;
            border: none !important;
            color: #666 !important;
            cursor: pointer !important;
            font-size: 16px !important;
            padding: 4px !important;
        }

        .ai-settings-button:hover {
            color: #0a66c2 !important;
        }
    `);

    // Create container with full functionality
    function createContainer() {
        log('Creating container...');

        // Create toggle button
        const toggleButton = document.createElement('button');
        toggleButton.id = 'ai-assistant-toggle';
        toggleButton.textContent = 'AI Assistant ◀';
        document.body.appendChild(toggleButton);

        // Create main container with basic structure
        const container = document.createElement('div');
        container.id = 'ai-assistant-box';

        // Add title
        const title = document.createElement('h3');
        title.textContent = 'LinkedIn AI Assistant';
        title.style.margin = '0 0 10px 0';

        // Add settings button
        const settingsButton = document.createElement('button');
        settingsButton.className = 'ai-settings-button';
        settingsButton.innerHTML = '⚙️';
        settingsButton.title = 'Settings';

        // Create settings modal and connect it to button
        const settingsModal = createSettingsModal();
        settingsButton.onclick = () => settingsModal.show();

        // Add status
        const status = document.createElement('div');
        status.className = 'ai-status';

        // Add analyze button
        const analyzeButton = document.createElement('button');
        analyzeButton.className = 'ai-button';
        analyzeButton.textContent = 'Analyze Visible Posts';

        // Add navigation buttons
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

        // Add content area
        const content = document.createElement('div');
        content.className = 'ai-content';
        content.style.display = 'none';

        // Add state variables
        let currentPosts = [];
        let currentIndex = 0;

        // Update content display function
        async function updateContent(index) {
            if (index >= 0 && index < currentPosts.length) {
                const extracted = await getPostContent(currentPosts[index]);
                if (extracted) {
                    content.style.display = 'block';
                    content.textContent = `Post ${index + 1} of ${currentPosts.length}:\n\n${extracted.content}`;
                    prevButton.style.display = index > 0 ? 'block' : 'none';
                    nextButton.style.display = index < currentPosts.length - 1 ? 'block' : 'none';
                    generateButton.style.display = 'block';  // Show generate button
                }
            }
        }

        // Update analyze button functionality
        analyzeButton.onclick = async () => {
            currentPosts = getVisiblePosts();
            status.textContent = `Found ${currentPosts.length} visible posts`;
            currentIndex = 0;
            if (currentPosts.length > 0) {
                await updateContent(0);
            } else {
                content.style.display = 'block';
                content.textContent = 'No visible posts found. Try scrolling to view posts.';
                prevButton.style.display = 'none';
                nextButton.style.display = 'none';
            }
        };

        // Add navigation button handlers
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

        // Add response type selector
        const responseTypeSelect = document.createElement('select');
        responseTypeSelect.className = 'ai-response-type';
        Object.entries(RESPONSE_TYPES).forEach(([value, { label }]) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            responseTypeSelect.appendChild(option);
        });

        // Add generate button
        const generateButton = document.createElement('button');
        generateButton.className = 'ai-button ai-generate-button';
        generateButton.textContent = 'Generate AI Response';
        generateButton.style.display = 'none';

        // Add generate button click handler
        generateButton.onclick = async () => {
            const currentPost = currentPosts[currentIndex];
            const extracted = await getPostContent(currentPost);

            if (!extracted) return;

            try {
                generateButton.disabled = true;
                generateButton.textContent = 'Generating...';
                status.textContent = 'Generating AI response...';

                const responseType = responseTypeSelect.value;
                const response = await generateAIResponse(
                    extracted.content,
                    responseType
                );

                // Update the response display creation
                let responseDisplay = container.querySelector('.ai-response');
                if (!responseDisplay) {
                    responseDisplay = document.createElement('div');
                    responseDisplay.className = 'ai-content ai-response';
                }

                // Clear previous content
                responseDisplay.innerHTML = '';

                // Create elements individually
                const titleEl = document.createElement('strong');
                titleEl.textContent = 'AI Suggested Response:';
                responseDisplay.appendChild(titleEl);

                const responseTextDiv = document.createElement('div');
                responseTextDiv.className = 'ai-response-text';
                responseTextDiv.textContent = response.suggestion;

                // Create copy button
                const copyButton = document.createElement('button');
                copyButton.className = 'ai-copy-button';
                copyButton.title = 'Copy to clipboard';
                copyButton.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                `;

                // Add copy functionality
                copyButton.addEventListener('click', async () => {
                    try {
                        await navigator.clipboard.writeText(response.suggestion);
                        copyButton.classList.add('success');
                        setTimeout(() => {
                            copyButton.classList.remove('success');
                        }, 2000);
                    } catch (err) {
                        log('Copy failed:', err);
                        status.textContent = 'Failed to copy to clipboard';
                    }
                });

                // Add copy button to response text div
                responseTextDiv.appendChild(copyButton);
                responseDisplay.appendChild(responseTextDiv);

                // Add metadata
                const metadataEl = document.createElement('small');
                metadataEl.style.cssText = 'color: #666; margin-top: 8px; display: block;';
                metadataEl.innerHTML = `
                    Model: ${response.metadata.model}<br>
                    Tokens: ${response.metadata.promptTokens + response.metadata.responseTokens}
                `;
                responseDisplay.appendChild(metadataEl);

                // Make sure response display is visible and added to container
                responseDisplay.style.display = 'block';
                if (!container.contains(responseDisplay)) {
                    container.appendChild(responseDisplay);
                }

                status.textContent = 'Response generated successfully';
            } catch (error) {
                status.textContent = `Error: ${error.message}`;
                log('Generation error:', error);
            } finally {
                generateButton.disabled = false;
                generateButton.textContent = 'Generate AI Response';
            }
        };

        // Add elements to container
        container.appendChild(title);
        container.appendChild(settingsButton);
        container.appendChild(status);
        container.appendChild(analyzeButton);
        container.appendChild(navButtons);
        container.appendChild(content);
        container.appendChild(responseTypeSelect);
        container.appendChild(generateButton);

        document.body.appendChild(container);

        // Toggle functionality (unchanged)
        toggleButton.addEventListener('click', () => {
            log('Toggle clicked');
            container.classList.toggle('visible');
            toggleButton.classList.toggle('shifted');
            toggleButton.textContent = container.classList.contains('visible') ? 'AI Assistant ▶' : 'AI Assistant ◀';
        });

        log('Container created successfully');
    }

    function init() {
        log('Initializing...');

        // Load saved settings
        const savedSettings = JSON.parse(localStorage.getItem('ai-assistant-settings') || '{}');
        if (savedSettings.apiKey) {
            OPENAI_CONFIG.apiKey = savedSettings.apiKey;
        }
        if (savedSettings.model) {
            OPENAI_CONFIG.model = savedSettings.model;
        }

        // Create elements if they don't exist
        if (!document.getElementById('ai-assistant-toggle')) {
            createContainer();
        }
    }

    // Call init when document is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    log('Script loaded');

    // Add this style verification
    const verifyStyles = () => {
        const container = document.getElementById('ai-assistant-box');
        const toggle = document.getElementById('ai-assistant-toggle');
        if (container && toggle) {
            log('Container styles:', window.getComputedStyle(container));
            log('Toggle styles:', window.getComputedStyle(toggle));
        }
    };

    // Call this after container creation
    setTimeout(verifyStyles, 1000);

    // Add style for copy button
    GM_addStyle(`
        .ai-response-text {
            position: relative !important;
            background: white !important;
            padding: 16px !important;
            padding-bottom: 48px !important; /* Space for the copy button */
            border-radius: 8px !important;
            border: 1px solid #e0e0e0 !important;
            margin: 6px 0 !important;
            font-size: 12px !important;
            line-height: 1.4 !important;
        }

        .ai-copy-button {
            position: absolute !important;
            bottom: 12px !important;
            right: 12px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 6px !important;
            padding: 6px 12px !important;
            background: #f8f9fa !important;
            border: 1px solid #e0e0e0 !important;
            border-radius: 6px !important;
            cursor: pointer !important;
            font-size: 12px !important;
            color: #666 !important;
            transition: all 0.2s ease !important;
        }

        .ai-copy-button::before {
            content: 'Copy' !important;
        }

        .ai-copy-button:hover {
            background: #f0f2f5 !important;
            border-color: #d0d0d0 !important;
            color: #333 !important;
        }

        .ai-copy-button svg {
            width: 14px !important;
            height: 14px !important;
            stroke: currentColor !important;
        }

        .ai-copy-button.success {
            background: #e7f7ed !important;
            border-color: #a8e5bd !important;
            color: #057642 !important;
        }

        .ai-copy-button.success::before {
            content: 'Copied!' !important;
        }
    `);
})();
