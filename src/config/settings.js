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
}

async function initializeSettings() {
    if (!getSettings().openaiKey && !getSettings().anthropicKey) {
        // Show settings panel on first run
        const { showSettingsPanel } = require('../ui/components.js');
        showSettingsPanel();
    }
}

module.exports = {
    getSettings,
    saveSettings,
    initializeSettings
};
