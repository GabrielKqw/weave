// --------------------------------------------------------------------------
// Weave Interactive UI & Bilingual Logic (Zero External Dependencies)
// --------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  // ------------------------------------------------------------------------
  // 1. Translations Dictionary (English & Brazilian Portuguese)
  // ------------------------------------------------------------------------
  const translations = {
    en: {
      nav_workflow: 'How to Use',
      nav_demo: 'Live Demo',
      nav_commands: 'Commands',
      nav_setup: 'Integration',
      nav_benchmarks: 'Benchmarks',
      nav_releases: 'Releases',
      github_btn: 'Star on GitHub',

      hero_badge: 'v0.6.1 · Zero-Dependency CLI · Node.js 18+',
      hero_title: 'Terminal intelligence and context continuity for coding agents.',
      hero_subtitle: 'Weave condenses repetitive CLI output by up to <strong>96.4%</strong>, prevents redundant file reads, and synchronizes working memory across Claude Code, OpenAI Codex, and Antigravity CLI. Pure Node.js standard library with 100% failure integrity.',
      copy_btn: 'Copy',
      copied_btn: 'Copied!',

      metric_deps: 'Runtime Dependencies',
      metric_reduction: 'Output Reduction on Tests',
      metric_integrity: 'Error & Failure Integrity',
      metric_tests: 'Verified Test Suite',

      workflow_tag: 'Practical Workflow',
      workflow_title: 'How to Use Weave Step-by-Step',
      workflow_desc: 'Follow this simple cycle to eliminate terminal noise, prevent context loss, and persist task memory between tools and agents.',

      step1_tab: '1. Health Check',
      step2_tab: '2. Wrap Commands',
      step3_tab: '3. Save Memory',
      step4_tab: '4. Measure Savings',

      step1_pill: 'Step 1: Diagnostics',
      step1_title: 'Verify Your Environment with `doctor`',
      step1_desc: 'Before starting, make sure your Node.js runtime, Git Bash, and plugin manifests are healthy. Weave validates write permissions in `.weave/` without modifying your project files.',

      step2_pill: 'Step 2: Execution',
      step2_title: 'Execute Commands Through `exec`',
      step2_desc: 'Run test runners, Git commands, or linters through Weave. If the command succeeds, hundreds of lines of noise collapse into a 2-line summary. If it fails, 100% of the stack trace and errors are kept intact.',

      step3_pill: 'Step 3: Context Memory',
      step3_title: 'Freeze & Hand Off Context with `memory`',
      step3_desc: 'Never re-explain architecture or rules across chat sessions. Save a snapshot of your task and load it into another session or another tool (Claude Code, Codex, or Antigravity) with zero token waste.',

      step4_pill: 'Step 4: Scoreboard',
      step4_title: 'Inspect Measured Token Savings with `gain`',
      step4_desc: 'Weave stores local metrics for all wrapped executions in `.weave/runs/`. Run `gain` to verify exactly how many bytes and tokens your project saved.',

      sample_output_label: 'Expected Terminal Output:',

      demo_tag: 'See it in action',
      demo_title: 'Terminal Intelligence in Real Time',
      demo_desc: 'Compare raw CLI output against Weave\'s filtered stream. Passing tests are condensed, but failing tests preserve 100% of stack traces.',

      toggle_weave_pass: 'With Weave (Passing)',
      toggle_raw: 'Raw Output (Noisy)',
      toggle_weave_fail: 'With Weave (On Failure)',

      demo_success_note: '✔ Clean summary delivered to coding agent (~1,850 tokens saved).',
      demo_noisy_note: '✖ 290 lines ingested into context window unnecessarily.',
      demo_failure_note: '✔ 100% Failure Integrity: Errors and diagnostics are never omitted.',

      cmd_tag: 'CLI Reference',
      cmd_title: 'Complete Command Reference',
      cmd_desc: 'Explore what each Weave command does, its exact syntax, real-world examples, and expected output.',

      badge_diag: 'Diagnostic',
      badge_core: 'Core',
      badge_context: 'Context',
      badge_metrics: 'Metrics',
      badge_audit: 'Audit',
      badge_policy: 'Policy',
      badge_analysis: 'Analysis',
      badge_prompt: 'SuperPrompt',

      cmd_syntax_label: 'Syntax:',
      cmd_example_label: 'Real Example:',

      cmd_doctor_desc: 'Verifies Node.js runtime (>=18), bash path, plugin manifests integrity, and directory write permissions.',
      cmd_exec_desc: 'Executes any shell command through output reduction filters. Preserves non-zero exit codes, errors, and stack traces 100% verbatim.',
      cmd_memory_desc: 'Saves, restores, lists, and manages named snapshots of `.weave/state.md` under `.weave/memories/` for cross-agent task handoff.',
      cmd_prompt_desc: 'Compiles a structured XML SuperPrompt with request contract, 5-pillar operational memory, bounded reasoning steps, reflection, reward scores, and 6 fidelity questions.',
      cmd_gain_desc: 'Calculates total byte reduction and approximate tokens saved across all wrapped runs in `.weave/runs/`.',
      cmd_recall_desc: 'Prints the full, raw captured output of any past command by its 12-character run ID, with automatic secret scrubbing.',
      cmd_mode_desc: 'Displays or updates the active engineering discipline policy in `.weave/mode`: `off`, `lite`, `full`, or `ultra`.',
      cmd_discover_desc: 'Parses past local Claude session transcripts (`.jsonl`) to retrospectively estimate compressible output missed before Weave was active.',

      setup_tag: 'Integration',
      setup_title: 'Connect to Your Coding Tool',
      setup_desc: 'Choose your developer environment and get set up in under 60 seconds.',

      claude_guide_desc: 'Installs as a native Claude Code plugin with automatic shell interception hooks and shared skills:',
      codex_guide_desc: 'Installs via Codex plugin manifest with engineering policy mode injection and shared skills:',
      agy_guide_desc: 'Integrates via native plugin install or shared skills and GEMINI.md policy:',
      rules_guide_desc: 'Use pre-generated rules that inject Weave\'s engineering policy into file-reading agents:',

      bench_tag: 'Verified Data',
      bench_title: 'Reproducible Output Benchmarks',
      bench_desc: 'Run npm run benchmark locally to verify these exact numbers on your own machine.',

      table_col_scenario: 'Scenario',
      table_col_original: 'Original',
      table_col_presented: 'Presented',
      table_col_reduction: 'Reduction',
      table_col_integrity: 'Integrity Guarantee',

      bench_test_passing: 'Passing Test Suite (300 lines)',
      bench_test_pass_desc: 'Final summary & count preserved',
      bench_git_status: 'Git Status (30 untracked files)',
      bench_git_status_desc: 'Section counts & changes preserved',
      bench_failure: 'Failing Assertion (Exit 1)',
      bench_failure_desc: '100% untouched (Stack trace & error intact)',
      bench_search: 'Code Search (50 grep matches)',
      bench_search_desc: 'Grouped by file, repetitive paths stripped',

      rel_tag: 'Updates & Releases',
      rel_title: 'Changelog & Release History',
      rel_desc: 'Track new features, bug fixes, and improvements across every Weave release.',

      rel_latest_tag: 'Latest Release',
      rel_061_title: 'Weave SuperPrompt Meta-Prompting Engine & Reasoning Protocol',
      rel_061_item1: 'SuperPrompt Engine: Compiles structured XML meta-prompts with request contracts, 5-pillar operational memory, step budgeting, reflection, quantitative reward scoring (0.0-1.0), and backtracking.',
      rel_061_item2: 'New weave prompt CLI & MCP Tool: Full command-line and stdio JSON-RPC tool support with strict decimal budget parsing and option termination (--).',
      rel_061_item3: 'New weave-prompt Skill: Specialized for portable task contracts, autonomous agent delegation, and cross-session handoffs.',
      rel_061_item4: 'Hardened XML 1.0 Legality: Sanitizes NUL and control bytes while normalizing lone surrogates, validated by 159 passing tests.',

      rel_051_title: 'Context Snapshots, Secret Redaction & Hook Hardening',
      rel_051_item1: 'Added weave memory CLI: Full context snapshot management (save, load, list, show, delete) with symlink and path traversal protection.',
      rel_051_item2: 'Hardened Secret Redaction: Added regex scrubbing for bare JSON Web Tokens (JWT) starting with eyJ without requiring a Bearer prefix.',
      rel_051_item3: 'BOM Header Handling: Fixed hooks silently failing on BOM-prefixed JSON stdin on Windows environments.',
      rel_051_item4: 'Test Suite Expansion: 128 passing unit and integration tests across Linux and Windows runners.',

      rel_050_title: 'Initial Triad Architecture Launch',
      rel_050_item1: 'Unified multi-tool workflow support for Claude Code, OpenAI Codex CLI, and Antigravity CLI.',
      rel_050_item2: 'Domain-specific output compression profiles for Git, Test Runners, Search, and Linters.',
      rel_050_item3: 'Lightweight request contract and working memory structure at .weave/state.md.',
      rel_050_item4: 'Zero-dependency stdio JSON-RPC MCP server in mcp/server.js.',

      footer_desc: 'Minimal workflow, terminal intelligence, and context continuity for developer tools and agents.',
      footer_col_project: 'Project',
      footer_issues: 'Issue Tracker',
      footer_docs: 'Documentation',
      footer_col_connect: 'Connect'
    },
    pt: {
      nav_workflow: 'Como Usar',
      nav_demo: 'Demonstração',
      nav_commands: 'Comandos',
      nav_setup: 'Integração',
      nav_benchmarks: 'Benchmarks',
      nav_releases: 'Versões',
      github_btn: 'Ver no GitHub',

      hero_badge: 'v0.6.1 · CLI Sem Dependências · Node.js 18+',
      hero_title: 'Inteligência de terminal e continuidade de contexto para agentes de código.',
      hero_subtitle: 'O Weave condensa saídas repetitivas de terminal em até <strong>96,4%</strong>, evita releituras redundantes de arquivos e sincroniza a memória de trabalho entre Claude Code, OpenAI Codex e Antigravity CLI. Node.js nativo com 100% de integridade em falhas.',
      copy_btn: 'Copiar',
      copied_btn: 'Copiado!',

      metric_deps: 'Dependências em Produção',
      metric_reduction: 'Redução em Testes',
      metric_integrity: 'Integridade em Falhas',
      metric_tests: 'Suíte de Testes Aprovada',

      workflow_tag: 'Fluxo Prático',
      workflow_title: 'Como Usar o Weave Passo a Passo',
      workflow_desc: 'Siga este ciclo prático para eliminar ruído de terminal, impedir perda de contexto e persistir o estado das tarefas entre ferramentas e sessões.',

      step1_tab: '1. Diagnóstico',
      step2_tab: '2. Executar Comandos',
      step3_tab: '3. Salvar Memória',
      step4_tab: '4. Medir Economia',

      step1_pill: 'Passo 1: Diagnóstico',
      step1_title: 'Verifique o Ambiente com `doctor`',
      step1_desc: 'Antes de começar, certifique-se de que a versão do Node.js, o Git Bash e os manifestos de plugins estão saudáveis. O Weave valida permissões de escrita em `.weave/` sem alterar os arquivos do seu projeto.',

      step2_pill: 'Passo 2: Execução com Filtro',
      step2_title: 'Execute Comandos Através do `exec`',
      step2_desc: 'Rode suítes de teste, Git ou linters através do Weave. Se o comando passar, centenas de linhas repetitivas são resumidas em 2 linhas. Se falhar, 100% do stack trace e dos erros são mantidos na íntegra.',

      step3_pill: 'Passo 3: Memória e Contexto',
      step3_title: 'Congele e Compartilhe Contexto com `memory`',
      step3_desc: 'Nunca precise reexplicar arquitetura ou regras entre sessões. Salve um snapshot da tarefa e carregue em outra sessão ou outro agente (Claude Code, Codex ou Antigravity) sem queimar tokens.',

      step4_pill: 'Passo 4: Placar de Economia',
      step4_title: 'Inspecione a Economia Real com `gain`',
      step4_desc: 'O Weave registra métricas locais em `.weave/runs/`. Execute `gain` para ver exatamente quantos bytes e tokens foram economizados no projeto.',

      sample_output_label: 'Saída Esperada no Terminal:',

      demo_tag: 'Veja em ação',
      demo_title: 'Inteligência de Terminal em Tempo Real',
      demo_desc: 'Compare a saída bruta de comandos contra o fluxo filtrado do Weave. Testes bem-sucedidos são condensados; erros preservam 100% do stack trace.',

      toggle_weave_pass: 'Com Weave (Passando)',
      toggle_raw: 'Saída Bruta (Poluída)',
      toggle_weave_fail: 'Com Weave (Em Falha)',

      demo_success_note: '✔ Resumo limpo entregue para o agente de código (~1.850 tokens economizados).',
      demo_noisy_note: '✖ 290 linhas ingeridas na janela de contexto desnecessariamente.',
      demo_failure_note: '✔ 100% Integridade em Falhas: Erros e diagnósticos nunca são omitidos.',

      cmd_tag: 'Referência da CLI',
      cmd_title: 'O Que Cada Comando Faz (Exemplos Práticos)',
      cmd_desc: 'Entenda a função de cada comando do Weave, sua sintaxe exata, exemplos reais de terminal e o resultado esperado.',

      badge_diag: 'Diagnóstico',
      badge_core: 'Núcleo',
      badge_context: 'Contexto',
      badge_metrics: 'Métricas',
      badge_audit: 'Auditoria',
      badge_policy: 'Política',
      badge_analysis: 'Análise',
      badge_prompt: 'SuperPrompt',

      cmd_syntax_label: 'Sintaxe:',
      cmd_example_label: 'Exemplo Real:',

      cmd_doctor_desc: 'Verifica versão do Node.js (>=18), executável bash, integridade dos manifestos e permissões de escrita.',
      cmd_exec_desc: 'Executa comandos no terminal aplicando filtros conservadores. Preserva saídas com erro, diagnósticos e stack traces 100% na íntegra.',
      cmd_memory_desc: 'Salva, restaura, lista e gerencia snapshots nomeados de `.weave/state.md` em `.weave/memories/` para continuidade entre sessões.',
      cmd_prompt_desc: 'Compila um SuperPrompt XML estruturado com contrato de requisição, memória operacional de 5 pilares, passos de raciocínio limitados, reflexão, pontuação de recompensa e 6 perguntas de fidelidade.',
      cmd_gain_desc: 'Calcula a redução total de bytes e a estimativa de tokens poupados em todas as execuções salvas em `.weave/runs/`.',
      cmd_recall_desc: 'Imprime a saída bruta completa de uma execução anterior pelo seu ID de 12 caracteres, com sanitização de credenciais.',
      cmd_mode_desc: 'Exibe ou atualiza a política ativa de engenharia em `.weave/mode`: `off`, `lite`, `full` ou `ultra`.',
      cmd_discover_desc: 'Analisa transcrições de sessões anteriores (`.jsonl`) para estimar quanta economia foi perdida antes de ativar o Weave.',

      setup_tag: 'Integração',
      setup_title: 'Conecte à Sua Ferramenta de Código',
      setup_desc: 'Escolha seu ambiente de desenvolvimento e configure em menos de 60 segundos.',

      claude_guide_desc: 'Instala como plugin nativo do Claude Code com hooks automáticos de intercepção e skills compartilhadas:',
      codex_guide_desc: 'Instala através do manifesto de plugins do Codex com injeção de política de engenharia:',
      agy_guide_desc: 'Integra via instalação nativa de plugin ou skills compartilhadas com regras em GEMINI.md:',
      rules_guide_desc: 'Utiliza arquivos de regras pré-gerados que injetam a política do Weave em editores com IA:',

      bench_tag: 'Dados Verificados',
      bench_title: 'Benchmarks de Redução Reproduzíveis',
      bench_desc: 'Execute npm run benchmark localmente para verificar esses mesmos números na sua própria máquina.',

      table_col_scenario: 'Cenário',
      table_col_original: 'Original',
      table_col_presented: 'Apresentado',
      table_col_reduction: 'Redução',
      table_col_integrity: 'Garantia de Integridade',

      bench_test_passing: 'Suíte de Testes Passando (300 linhas)',
      bench_test_pass_desc: 'Sumário final e contagem preservados',
      bench_git_status: 'Git Status (30 arquivos não rastreados)',
      bench_git_status_desc: 'Contagens de seção e alterações preservadas',
      bench_failure: 'Asserção Falhando (Código 1)',
      bench_failure_desc: '100% intacto (Stack trace e erro preservados)',
      bench_search: 'Busca de Código (50 matches em grep)',
      bench_search_desc: 'Agrupado por arquivo, caminhos repetidos removidos',

      rel_tag: 'Atualizações e Versões',
      rel_title: 'Histórico de Versões e Changelog',
      rel_desc: 'Acompanhe novas funcionalidades, correções de bugs e melhorias a cada versão do Weave.',

      rel_latest_tag: 'Versão Mais Recente',
      rel_061_title: 'Motor de Meta-Prompting Weave SuperPrompt & Protocolo de Raciocínio',
      rel_061_item1: 'Motor SuperPrompt: Compila meta-prompts em XML estruturado com contratos de requisição, memória operacional de 5 pilares, orçamento de passos, reflexão, pontuação de recompensa (0.0-1.0) e backtracking.',
      rel_061_item2: 'Novo comando CLI e Tool MCP weave prompt: Suporte completo em linha de comando e via stdio JSON-RPC com validação decimal estrita de orçamento e terminação de opções (--).',
      rel_061_item3: 'Nova Skill weave-prompt: Especializada para contratos de tarefas portáveis, delegação entre agentes autônomos e handoffs entre sessões.',
      rel_061_item4: 'Sanitização XML 1.0 Rigorosa: Remove bytes de controle e NUL enquanto normaliza substitutos isolados, comprovado por 159 testes aprovados.',

      rel_051_title: 'Snapshots de Memória, Redação de Segredos e Blindagem de Hooks',
      rel_051_item1: 'Adicionado comando weave memory: Gerenciamento completo de snapshots (save, load, list, show, delete) com proteção contra symlinks e path traversal.',
      rel_051_item2: 'Redação de Segredos Reforçada: Sanitização por regex de tokens JWT iniciando com eyJ mesmo sem prefixo Bearer.',
      rel_051_item3: 'Tratamento de Cabeçalho BOM: Corrigido problema com hooks falhando silenciosamente com entradas JSON contendo BOM no Windows.',
      rel_051_item4: 'Expansão de Testes: 128 testes unitários e de integração passando em ambientes Linux e Windows.',

      rel_050_title: 'Lançamento da Arquitetura de Tríade',
      rel_050_item1: 'Suporte unificado para fluxos em Claude Code, OpenAI Codex CLI e Antigravity CLI.',
      rel_050_item2: 'Perfis de compressão específicos para Git, Test Runners, Buscas e Linters.',
      rel_050_item3: 'Contrato de tarefa enxuto e memória de trabalho leve em .weave/state.md.',
      rel_050_item4: 'Servidor MCP sem dependências via stdio JSON-RPC em mcp/server.js.',

      footer_desc: 'Política mínima de engenharia, inteligência de terminal e continuidade de contexto para ferramentas de desenvolvimento.',
      footer_col_project: 'Projeto',
      footer_issues: 'Rastreador de Problemas',
      footer_docs: 'Documentação Completa',
      footer_col_connect: 'Contato'
    }
  };

  // ------------------------------------------------------------------------
  // 2. Language Switcher Engine
  // ------------------------------------------------------------------------
  let currentLang = localStorage.getItem('weave_lang') || 'en';

  const applyTranslations = (lang) => {
    currentLang = lang;
    localStorage.setItem('weave_lang', lang);

    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';

    // Update switcher buttons
    document.querySelectorAll('.lang-btn').forEach((btn) => {
      if (btn.getAttribute('data-lang') === lang) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const dict = translations[lang] || translations.en;

    // Replace text for all data-i18n elements
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (dict[key]) {
        if (dict[key].includes('<') && dict[key].includes('>')) {
          el.innerHTML = dict[key];
        } else {
          el.textContent = dict[key];
        }
      }
    });
  };

  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetLang = btn.getAttribute('data-lang');
      applyTranslations(targetLang);
    });
  });

  // Apply initially stored language
  applyTranslations(currentLang);

  // ------------------------------------------------------------------------
  // 3. Workflow Steps Switcher
  // ------------------------------------------------------------------------
  const workflowBtns = document.querySelectorAll('.workflow-step-btn');
  const workflowCards = document.querySelectorAll('.workflow-card');

  workflowBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      workflowBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const targetStep = btn.getAttribute('data-step');
      workflowCards.forEach((card) => {
        if (card.id === `card-${targetStep}`) {
          card.classList.add('active');
        } else {
          card.classList.remove('active');
        }
      });
    });
  });

  // ------------------------------------------------------------------------
  // 4. Install Snippet Switcher
  // ------------------------------------------------------------------------
  const installSnippets = {
    claude: 'claude plugin marketplace add GabrielKqw/weave --scope user\nclaude plugin install weave@weave --scope user',
    codex: 'codex plugin marketplace add GabrielKqw/weave\ncodex plugin add weave@weave',
    agy: 'git clone https://github.com/GabrielKqw/weave.git\ncd weave && agy plugin install ./',
    standalone: 'npm install --global weave-agent-workflow\n# Or run directly without installation:\nnpx weave-agent-workflow doctor'
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

  // ------------------------------------------------------------------------
  // 5. Copy Helpers
  // ------------------------------------------------------------------------
  const copyTextToClipboard = async (text, buttonElement) => {
    try {
      await navigator.clipboard.writeText(text);
      buttonElement.classList.add('copied');
      const dict = translations[currentLang] || translations.en;
      const originalText = buttonElement.textContent;
      buttonElement.textContent = dict.copied_btn || 'Copied!';
      setTimeout(() => {
        buttonElement.classList.remove('copied');
        buttonElement.textContent = originalText;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  if (copyInstallBtn) {
    copyInstallBtn.addEventListener('click', () => {
      copyTextToClipboard(installCode.textContent, copyInstallBtn);
    });
  }

  // Box copy buttons
  document.querySelectorAll('.btn-copy-box, .btn-copy-mini').forEach((btn) => {
    btn.addEventListener('click', () => {
      const text = btn.getAttribute('data-copy');
      if (text) {
        copyTextToClipboard(text, btn);
      }
    });
  });

  // ------------------------------------------------------------------------
  // 6. Terminal Scenario Switcher
  // ------------------------------------------------------------------------
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

  // ------------------------------------------------------------------------
  // 7. Agent Setup Guide Switcher
  // ------------------------------------------------------------------------
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
});
