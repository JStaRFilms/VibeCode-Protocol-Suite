---
name: expert-system-engineer
description: Use when engineering knowledge-based expert systems using CommonKADS methodology, MYCIN/EMYCIN rule patterns, certainty factors, or backward-chaining inference engines.
author: J StaR Films / Takomi
coauthored: J StaR Films / Takomi
version: 1.0.0
---

# Expert System Engineering

Full lifecycle methodology for engineering knowledge-based expert systems. Upstream phases use CommonKADS for organizational scoping and conceptual modeling. Downstream phases use generalized MYCIN/EMYCIN patterns for rule-based implementation. Follow all phases in order.

For domain terminology, see [terminology.md](references/terminology.md).

---

## Phase 0: Suitability Assessment

Determine whether the problem warrants an expert system before committing to the methodology.

1. **Classify the problem type**:
   - **Analytic** (classification, diagnosis, assessment, monitoring) — system interprets existing data
   - **Synthetic** (configuration, planning, scheduling, design) — system constructs a solution from components
   - **Neither** — redirect to a different approach

2. **Evaluate expert-system fit against alternatives**:

   | Criterion | Expert System Fit | Alternative |
   |---|---|---|
   | Domain has identifiable human experts | Required | If no experts → data-driven ML |
   | Knowledge is heuristic, judgmental | Strong fit | If purely algorithmic → conventional software |
   | Reasoning must be explainable | Strong fit | If black-box acceptable → ML/statistical |
   | Domain is bounded and well-scoped | Required | If open-ended → LLM-based approaches |
   | Decisions involve uncertainty | Strong fit (CF/rules) | If precise probabilities needed → Bayesian networks |
   | Training data is limited | Advantage over ML | If large labeled datasets exist → ML |

3. Make an explicit **go/no-go decision**. Document the rationale.

### Completion gate
- [ ] Problem type classified (analytic or synthetic)
- [ ] Fit evaluated against at least three alternatives
- [ ] Go/no-go decision documented with rationale

---

## Phase 1: Organizational Scoping & Feasibility

Scrutinize the organizational environment, isolate the knowledge bottleneck, and confirm feasibility before technical work begins.

1. **Map organizational context** (OM-1): Document business mission, drivers, problems, opportunities, and candidate solution directions.

2. **Analyze variant aspects** (OM-2): Map organizational structure, business processes (activity diagrams), people, resources, and culture/power dynamics.

3. **Decompose into tasks** (OM-3): Break business processes into discrete tasks. For each, record the performing agent, knowledge assets used, knowledge-intensity (1–5), and business significance.

4. **Assess knowledge assets** (OM-4): For each asset, evaluate whether it is in the right **form**, right **place**, right **time**, and right **quality**.

5. **Produce feasibility decision** (OM-5): Score business, technical, and project feasibility. Identify the specific knowledge bottleneck the system will address.

### Completion gate
- [ ] Knowledge bottleneck identified and scoped
- [ ] Feasibility scored across all three dimensions
- [ ] Project focus confirmed (which task, which knowledge asset)

---

## Phase 2: Task Analysis & Knowledge Acquisition

Analyze the target task and begin eliciting domain expertise.

### Task Analysis

1. **Characterize the task** (TM-1): Specify goal, value-add, inputs, outputs, control structure, resources, and quality criteria.

2. **Identify knowledge bottlenecks** (TM-2): For each knowledge item the task requires, assess nature (heuristic, formal, procedural, tacit), availability, and the specific bottleneck.

3. **Model agents** (AM-1): For each agent involved, catalogue competencies, responsibilities, communication links, and constraints.

### Knowledge Elicitation

4. **Select elicitation technique** matched to the target knowledge type:

   | Target Knowledge | Technique |
   |---|---|
   | Orientation, scope, terminology | Unstructured interview |
   | Heuristic rules, decision criteria | Structured interview (probes P1–P6) |
   | Dynamic reasoning, problem-solving trace | Protocol analysis (think-aloud) |
   | Concept hierarchies, taxonomies | Laddering |
   | Latent dimensions, attribute discovery | Concept sorting / repertory grids |

5. **Execute elicitation sessions** with recording and realistic problem scenarios.

6. **Code transcripts** against the knowledge model structure: mark up concepts, attributes, values, inferences, and candidate rules.

7. **Validate findings** with the domain expert using teach-back.

### Completion gate
- [ ] Task goal, inputs, outputs, and quality criteria specified
- [ ] Knowledge bottlenecks identified with nature and availability
- [ ] At least one elicitation session executed and coded
- [ ] Findings validated with domain expert

---

## Phase 3: Conceptual Knowledge Modeling

Construct an implementation-independent model of domain, inference, and task knowledge. **Model before rules** — do not encode rules until this model is stable.

For detailed construction procedures and the full task template catalog, see [knowledge-modeling.md](references/knowledge-modeling.md).

### Domain Layer

1. **Build the domain schema**: Identify concepts, attributes, value types, relations, and subtype hierarchies. This is the static structure of the domain — independent of any reasoning task.

2. **Define rule types**: Specify logical dependencies between domain expressions (antecedent → consequent) with cardinality and connection type.

### Inference Layer

3. **Specify inferences**: Define each primitive reasoning step as a declarative specification with named input and output knowledge roles. Inferences are black boxes — they must not contain internal control flow.

4. **Map knowledge roles to domain**: Connect dynamic roles (run-time inputs/outputs) and static roles (stable knowledge base references) to domain schema elements.

5. **Define transfer functions**: Specify interaction points with external agents — obtain (system asks), receive (agent volunteers), present (system reports), provide (agent requests).

### Task Layer

6. **Select a task template** matching the problem type:
   - **Analytic**: Classification, Assessment, Diagnosis, Monitoring
   - **Synthetic**: Configuration Design, Assignment, Planning, Scheduling

7. **Specify task methods**: Define how each task decomposes into subtasks and inferences, with explicit control structures (sequence, iteration, selection).

### Validation

8. **Walk through scenarios**: Trace at least 2 realistic cases through the complete model (domain → inference → task) on paper. Verify no missing inferences, unmapped roles, or dead-end paths.

### Completion gate
- [ ] Domain schema specified (concepts, relations, rule types)
- [ ] Inference layer specified (all inferences, knowledge role mappings)
- [ ] Task template selected, methods defined with control structures
- [ ] At least 2 scenarios traced through the full model without gaps

---

## Phase 4: Knowledge Representation & Rule Engineering

Choose a representation and encode the conceptual model into executable knowledge structures.

For detailed rule engineering patterns (context trees, parameter types, certainty factor calculus, rule syntax, backward chaining mechanics), see [rule-engineering.md](references/rule-engineering.md).

### Representation Selection

1. **Choose representation based on the knowledge model**:

   | Knowledge Characteristics | Representation |
   |---|---|
   | Heuristic associations, evidential reasoning | Production rules + certainty factors |
   | Structured entities with inheritance | Frames / object hierarchies |
   | Taxonomic relationships, shared vocabulary | Ontologies / semantic networks |
   | Tabular decision logic, bounded conditions | Decision tables |
   | Similarity-based reasoning | Case libraries |
   | Multiple knowledge types | Hybrid combination |

### Rule-Based Encoding (when production rules selected)

2. **Define the domain entity hierarchy**: Organize entities into a context tree with parent-child relationships and specify properties for each node.

3. **Classify domain parameters**: For each attribute, specify value type and bounds, exclusivity (single-valued / multi-valued / binary), and acquisition method (ask user, deduce from rules, or both).

4. **Encode production rules**: Each rule is a standalone modular conditional — a conjunction of predicate functions over parameters concluding a parameter value with a certainty weight.

5. **Assign certainty factors**: Attach evidential strength CF ∈ [-1.0, +1.0] to each rule action. Positive values increase belief; negative values increase disbelief.

6. **Build knowledge tables**: Consolidate repetitive multi-rule mappings into static lookup tables accessed via standardized predicates.

7. **Index rules**: Compile cross-reference indices — UPDATED-BY (rules concluding about each parameter) and LOOKAHEAD (rules referencing each parameter in their premise).

### Completion gate
- [ ] Representation selected with rationale
- [ ] Domain entity hierarchy defined
- [ ] All parameters classified with types and value bounds
- [ ] Rules encoded in modular form with certainty factors
- [ ] Cross-reference indices compiled

---

## Phase 5: Verification & Validation

Verify the knowledge base for consistency and completeness before deployment.

### Static Verification

1. **Partition rules** into clusters concluding about the same parameter within the same context.

2. **Build condition-action matrices**: Enumerate all condition value combinations and map to concluded action values.

3. **Run consistency checks**:
   - **Conflict**: Identical conditions → contradictory conclusions
   - **Redundancy**: Identical conditions → identical conclusions
   - **Subsumption**: Rule A's conditions ⊂ Rule B's conditions, same conclusion

4. **Run completeness checks**: Identify condition combinations with no rule mapping. Determine if each gap is a genuine missing rule or an impossible domain state.

5. **Resolve anomalies** with the domain expert: distinguish real bugs from intentional domain shortcuts.

### Dynamic Validation

6. **Assemble a test case library** with known expert-determined outcomes.

7. **Run consultation traces** and compare outputs against expert determinations.

8. **Trace failures**: For each discrepancy, unwind the reasoning chain to identify the root cause (missing rule, incorrect CF, wrong inference path, unmapped parameter).

### Completion gate
- [ ] Zero unresolved rule conflicts
- [ ] Missing rule combinations reviewed and resolved
- [ ] Test case library exercised with documented results
- [ ] Failure root causes identified and addressed

---

## Phase 6: Design, Implementation & Explanation

Map the verified knowledge model into a working system with explanation and maintenance facilities.

### Architecture

1. **Apply structure-preserving design**: The domain/inference/task distinctions from the knowledge model must appear explicitly in the software architecture. Flattening them destroys transparency, maintainability, and explanation capability.

2. **Decompose via Model-View-Controller**:
   - **Model**: Knowledge base access, inference execution, task control
   - **View**: User interface, explanation display
   - **Controller**: Session management, event dispatch, dialogue flow

3. **Design the inference engine**:
   - Select chaining strategy (backward / forward / hybrid)
   - Implement rule preview (discard rules with known-false premises before evaluation)
   - Implement threshold guardrails (halt low-yield branches when premise tally ≤ 0.2)
   - Partition self-referencing rules for deferred execution

### Explanation Facility

4. **Record reasoning trace**: Log the full goal stack, rules evaluated, evidence contributions, and conclusions during each consultation (history tree).

5. **Support interactive explanation**:
   - **WHY**: Unwind one level up the goal stack — show current goal, parent goal, linking rule, and premise status
   - **HOW**: Descend one level into a subgoal — show rules evaluated and evidence tallies

6. **Support retrospective queries**: Parse post-consultation questions to retrieve reasoning traces, rule citations, and data provenance.

### Maintenance Loop

7. **Interactive knowledge acquisition**: When a test case fails, trace the history tree to locate the fault, solicit a new rule from the expert, validate against existing rules (subsumption, conflict, tautology), and rerun the test library.

8. **Case-based refinement**: Failed cases feed back into elicitation (Phase 2), model refinement (Phase 3), and re-verification (Phase 5).

### Completion gate
- [ ] Architecture preserves knowledge model structure
- [ ] Inference engine handles chaining, pruning, thresholds, and self-referencing rules
- [ ] Explanation facility supports WHY, HOW, and retrospective queries
- [ ] Knowledge acquisition loop operational for incremental refinement

---

## Worked Examples

For worked examples illustrating each phase (housing eligibility assessment, bacterial infection diagnosis, backward chaining traces, interactive explanation dialogues, and knowledge acquisition sessions), see [examples.md](references/examples.md).
