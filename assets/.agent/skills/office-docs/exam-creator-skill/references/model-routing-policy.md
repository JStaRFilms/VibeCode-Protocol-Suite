# Exam Creator Model Routing Policy

Use this routing policy for the exam-creation workflow unless the user overrides it.

## Terminology Rule

When the user says **Gemini**, interpret that as **Gemini via the agy CLI** unless the user explicitly says otherwise.

## Default Routing

- **Orchestrator:** parent assistant / orchestrator
- **Drafting agent:** **Gemini via agy CLI**
- **Marking agent:** **Gemini via agy CLI**
- **Verification agent:** **GPT**

## Why This Is The Default

- Drafting and marking are the highest-volume steps.
- Gemini is preferred there because it is cheaper and faster.
- Verification is the quality gate, so GPT is preferred for the final correctness check.

## Escalation Rule For Drafting

Upgrade the **drafting agent** from Gemini via agy CLI to **GPT 5.4 High** when any of these are true:

- the source notes are messy or inconsistent
- the subject requires tighter wording judgment
- ambiguity risk is high
- the diagram/question structure is more delicate than usual
- the paper is Mathematics or English and extra care is desired

## Practical Modes

### Default cheap/fast mode
- Orchestrator → parent assistant
- Drafting → Gemini via agy CLI
- Marking → Gemini via agy CLI
- Verification → GPT

### Escalated drafting mode
- Orchestrator → parent assistant
- Drafting → GPT 5.4 High
- Marking → Gemini via agy CLI
- Verification → GPT

## Guiding Principle

Use **Gemini via agy CLI for drafting and marking by default**, **GPT for verification**, and only upgrade drafting to **GPT 5.4 High** when the paper is tricky enough to justify the extra cost.
