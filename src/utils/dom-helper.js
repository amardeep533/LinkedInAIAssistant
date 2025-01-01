const { createAIAssistButton } = require('../ui/components.js');

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

module.exports = {
    setupDOMObserver
};
