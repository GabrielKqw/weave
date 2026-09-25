# Posts Prontos para o Reddit

Este arquivo contém os títulos e corpos formatados especificamente para a sintaxe do Reddit. Basta copiar e colar.

---

## 1. Post Principal: r/ClaudeAI (Maior Prioridade)
* **Onde postar:** https://www.reddit.com/r/ClaudeAI/submit
* **Flair recomendada:** `Tools` ou `Discussion`

### Título:
```text
I built a zero-dependency CLI layer that stops Claude Code from burning context on noisy terminal logs
```

### Corpo do Post (Markdown do Reddit):
```markdown
Hey everyone,

Whenever I run longer sessions with Claude Code on non-trivial codebases, the context window degrades the same way:

Running test suites (Node test, Jest, Vitest, Pytest) or checking git diffs floods the terminal with hundreds of lines of progress bars, ANSI codes, and passing assertions. Claude ingests every single line, burning thousands of tokens on repetitive noise and quickly forgetting earlier constraints.

To fix this in my own workflow without pulling in heavy external dependencies or daemons, I built **Weave**:

### What it does:
* **Terminal output reduction (`weave exec`)**: Intercepts shell commands and condenses successful runs into clean 2-line summaries (up to 96.4% output reduction).
* **100% failure integrity**: On any non-zero exit code (`exit != 0`), **nothing is reduced**. Stack traces, assertion diffs, and error diagnostics pass through completely untouched.
* **Redundant read prevention (`preread`)**: Keeps a lightweight ledger in `.weave/ledger.json` and reminds Claude if it tries to re-read files that haven't changed.
* **Context memory snapshots (`weave memory`)**: Save your task context and request contract with `weave memory save <name>` and restore it in another session with just ~250 tokens instead of feeding 40k tokens of chat history.
* **Zero runtime dependencies**: 100% built on top of the Node.js 18+ standard library.

### Try it instantly without cloning:
```bash
npx weave-agent-workflow doctor
```

Or install globally:
```bash
npm install --global weave-agent-workflow
```

### Live Demo & Links:
* **Interactive Demo & Docs:** https://gabrielkqw.github.io/weave/ (includes an interactive terminal simulation)
* **GitHub (MIT):** https://github.com/GabrielKqw/weave
* **NPM Package:** https://www.npmjs.com/package/weave-agent-workflow

I'd love to hear your feedback on the output profiles and what other noisy terminal commands you struggle with in Claude Code!
```

---

## 2. Post para r/ChatGPTCoding
* **Onde postar:** https://www.reddit.com/r/ChatGPTCoding/submit
* **Flair recomendada:** `Project` ou `Tool`

### Título:
```text
Weave: A zero-dependency CLI layer that cuts AI terminal noise by up to 96% (Claude Code, Codex CLI)
```

### Corpo do Post:
```markdown
Hey everyone,

One of the biggest token sinks when using terminal-based AI coding agents (Claude Code, OpenAI Codex CLI, etc.) is terminal output. A single `npm test`, `git status`, or linter run can dump 300+ lines of text that the LLM has to process, leading to rapid context window rot.

I created **Weave**, an open-source CLI layer built with vanilla Node.js (zero runtime dependencies).

### Core Features:
1. **Conservative Terminal Filters**: Condenses repetitive passing tests and status outputs down to ~2 lines, while keeping 100% of stack traces intact when tests fail.
2. **Re-read Prevention**: Warns the agent if it repeatedly reads the exact same unchanged file.
3. **Cross-Agent Task Memory**: Allows you to snapshot task state to `.weave/memories/` and hand it off to another session in ~250 tokens.
4. **Automatic Secret Scrubbing**: Redacts AWS keys, GitHub PATs, JWTs, and Bearer tokens before saving history.

You can run the diagnostics directly via npx:
```bash
npx weave-agent-workflow doctor
```

* **Interactive Docs & Terminal Simulator:** https://gabrielkqw.github.io/weave/
* **GitHub Repository:** https://github.com/GabrielKqw/weave
* **NPM Registry:** https://www.npmjs.com/package/weave-agent-workflow

Would love your thoughts and suggestions for additional tool filters!
```
