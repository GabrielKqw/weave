---
name: weave-review
description: Review the current code diff for avoidable complexity, duplicated mechanisms, speculative abstractions, and dependencies that native features or the standard library can replace. Use when the user asks for a Weave review, simplification review, or what can be removed from the current change.
---

# Weave Review

Inspect only the current diff and its direct callers. Do not edit files.

Report confirmed findings in descending impact as:

`file:line - remove or simplify - smallest adequate replacement`

Skip style preferences and hypothetical future issues. If nothing material can be removed, say so directly.
