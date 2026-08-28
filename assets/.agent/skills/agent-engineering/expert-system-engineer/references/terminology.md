# Terminology

## Architecture & Modeling

**Knowledge Model**:
An implementation-independent conceptual specification of the knowledge and reasoning requirements for a knowledge-intensive task, structured into domain, inference, and task layers.
_Avoid_: rule base, expert system code, database schema

**Domain Knowledge**:
The static information structures of an application domain — concepts, relations, rule types (schema level) and factual/rule instances (knowledge base level).
_Avoid_: data model, ontology file

**Inference Knowledge**:
The specification of primitive reasoning steps (inferences) and the functional roles (knowledge roles) that domain objects play during reasoning, independent of control flow.
_Avoid_: algorithms, methods, functions

**Task Knowledge**:
The specification of reasoning goals and the strategies (task methods) that achieve them through hierarchical decomposition into subtasks and inferences, including control structures.
_Avoid_: procedural code, execution scripts

**Knowledge Role**:
A functional placeholder specifying the role a domain entity plays in a reasoning process. Dynamic roles are run-time variables; static roles reference stable knowledge bases.
_Avoid_: variable, data parameter

**Transfer Function**:
A primitive unit representing interaction between the reasoning system and an external agent, categorized by who holds the information and who initiates the exchange (obtain, receive, present, provide).
_Avoid_: I/O subroutine, UI call

**Structure-Preserving Design**:
The principle that conceptual distinctions from the knowledge model (domain/inference/task layers) must appear explicitly in the software architecture.
_Avoid_: direct compilation, flattened coding

## Knowledge Representation

**Production Rule**:
A modular conditional statement mapping a conjunction of premise predicates over domain parameters to a conclusion with an associated certainty weight.
_Avoid_: procedural branch, if-then-else script, hardcoded logic

**Rule Type**:
A schema construct representing the logical dependency between domain expressions, characterized by antecedent, consequent, cardinality, and connection symbol.
_Avoid_: if-then production rule, coded statement

**Context Tree**:
A hierarchical data structure organizing domain entities (context-types and instances) for multi-object quantification, parameter scoping, and consultation progression.
_Avoid_: flat variable space, global object graph

**Domain Parameter**:
A specific attribute characterizing an entity in the context tree, classified by value type, exclusivity (single-valued, multi-valued, binary), and acquisition method.
_Avoid_: property key, slot name, untyped variable

**Knowledge Base**:
A container of factual assertions and rule instances authored against a validated domain schema.
_Avoid_: database, data store, config file

**Knowledge Table**:
A static lookup table consolidating repetitive multi-rule mappings into an indexed grid accessed via standardized predicates.
_Avoid_: lookup array, hardcoded map

## Inference & Reasoning

**Certainty Factor (CF)**:
A numerical measure in [-1.0, +1.0] representing evidential support for a hypothesis. Positive values increase belief; negative values increase disbelief. Not a probability.
_Avoid_: Bayesian posterior, fuzzy truth value, confidence percentage

**Tally**:
The combined certainty of a rule's premise, calculated as the minimum CF across all conjuncts.
_Avoid_: premise weight, rule threshold

**Backward Chaining**:
Goal-directed inference that recursively traces from a target conclusion back through rules to establish supporting evidence.
_Avoid_: reverse search, goal solver

**Forward Chaining**:
Data-driven inference that starts from known facts and applies rules to derive new conclusions.
_Avoid_: forward propagation, trigger chain

**Rule Preview**:
A pre-evaluation filter that scans all clauses of a rule to immediately discard it if any clause is already known false.
_Avoid_: early exit, lazy evaluation

**Self-Referencing Rule**:
A rule referencing the same parameter in both premise and action. Must be partitioned and executed only after all non-self-referencing rules complete to prevent circular reasoning.
_Avoid_: recursive rule, circular rule

**Unity Path**:
A deterministic chain of rules each with CF = 1.0, establishing a conclusion with absolute certainty. When a single-valued parameter reaches CF = 1.0, all competing hypotheses are set to CF = -1.0.
_Avoid_: certain chain, deterministic shortcut

**Threshold Guardrail**:
The rule that a premise tally ≤ 0.2 halts further backward chaining on that rule, preventing combinatorial explosion and irrelevant questioning.
_Avoid_: cutoff, early termination

## Explanation & Maintenance

**History Tree**:
The dynamic record of all goals pursued, rules evaluated, and conclusions reached during a consultation — the foundation for WHY and HOW explanations.
_Avoid_: execution log, call stack trace

**Explanation Facility**:
The system component providing interactive (WHY/HOW during consultation) and retrospective (post-consultation queries) justifications of reasoning.
_Avoid_: runtime debugger, trace inspector

**Meta-Rule**:
A rule whose subject is other rules, used to prune or reorder the rule evaluation sequence before object-level rules fire.
_Avoid_: control script, scheduling algorithm

**Rule Model**:
An automatically computed statistical generalization of a rule subset, describing typical premise-action parameter clusters. Used to second-guess expert-proposed rules during knowledge acquisition.
_Avoid_: rule schema, template

## Methodology

**Knowledge Engineering**:
The discipline of eliciting, structuring, formalizing, and verifying domain expertise into an explicit, validated knowledge base.
_Avoid_: expert programming, AI customization

**Task Template**:
A reusable, domain-independent pattern of inference structures and task decompositions for a recognized problem class (classification, diagnosis, assessment, etc.).
_Avoid_: algorithm blueprint, generic framework

**CommonKADS Model Suite**:
Six interrelated aspect models answering Why (Organization, Task, Agent), What (Knowledge, Communication), and How (Design) for specifying and constructing a knowledge system.
_Avoid_: system specifications, documentation templates
