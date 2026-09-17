// --------------------------------------------------------------------------
// Weave Interactive UI Logic (Zero external dependencies)
// --------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  // 1. Install Snippet Switcher
  const installSnippets = {
    claude: 'claude plugin marketplace add GabrielKqw/weave --scope user\nclaude plugin install weave@weave --scope user',
    codex: 'codex plugin marketplace add GabrielKqw/weave\ncodex plugin add weave@weave',
    agy: 'git clone https://github.com/GabrielKqw/weave.git\ncd weave && agy plugin install ./',
    standalone: 'git clone https://github.com/GabrielKqw/weave.git\ncd weave && npm pack && npm install --global ./weave-agent-workflow-0.5.1.tgz'
  };

  const installTabs = document.querySelectorAll('.install-tab-btn');
  const installCode = document.getElementById('install-snippet');
  const copyInstallBtn = document.getElementById('copy-install-btn');

  installTabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      installTabs.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.getAttribute('data-install');
      if (installSnippets[target]) {
        installCode.textContent = installSnippets[target];
      }
    });
  });

  // Copy helper
  const copyTextToClipboard = async (text, buttonElement, originalLabel = 'Copy') => {
    try {
      await navigator.clipboard.writeText(text);
      buttonElement.classList.add('copied');
      const label = buttonElement.querySelector('.copy-label') || buttonElement;
      label.textContent = 'Copied!';
      setTimeout(() => {
        buttonElement.classList.remove('copied');
        label.textContent = originalLabel;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  if (copyInstallBtn) {
    copyInstallBtn.addEventListener('click', () => {
      copyTextToClipboard(installCode.textContent, copyInstallBtn, 'Copy');
    });
  }

  // 2. Terminal Scenario Switcher
  const terminalToggles = document.querySelectorAll('.terminal-toggle');
  const terminalScreens = document.querySelectorAll('.terminal-screen');

  terminalToggles.forEach((btn) => {
    btn.addEventListener('click', () => {
      terminalToggles.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const scenario = btn.getAttribute('data-scenario');
      terminalScreens.forEach((screen) => {
        if (screen.id === `screen-${scenario}`) {
          screen.classList.add('active');
        } else {
          screen.classList.remove('active');
        }
      });
    });
  });

  // 3. AI Setup Guide Switcher
  const agentTabs = document.querySelectorAll('.agent-tab-btn');
  const agentCards = document.querySelectorAll('.agent-guide-card');

  agentTabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      agentTabs.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const targetAgent = btn.getAttribute('data-agent');
      agentCards.forEach((card) => {
        if (card.id === targetAgent) {
          card.classList.remove('hidden');
        } else {
          card.classList.add('hidden');
        }
      });
    });
  });

  // 4. Code Box Copy Buttons
  const codeBoxBtns = document.querySelectorAll('.btn-copy-box');
  codeBoxBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const textToCopy = btn.getAttribute('data-copy');
      if (textToCopy) {
        copyTextToClipboard(textToCopy, btn, 'Copy');
      }
    });
  });
});
