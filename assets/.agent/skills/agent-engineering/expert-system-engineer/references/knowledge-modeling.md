# Knowledge Modeling Guide (CommonKADS Framework)

Reference for constructing conceptual knowledge models independent of implementation software. Consult during **Phase 3 (Conceptual Knowledge Modeling)**.

---

## 1. The Three-Layer Architecture

A complete Knowledge Model cleanly separates three distinct types of knowledge:

```
┌────────────────────────────────────────────────────────┐
│                      TASK LAYER                        │
│  Reasoning goals, task decompositions, control flow    │
└───────────────────────────┬────────────────────────────┘
                            │ controls
┌───────────────────────────▼────────────────────────────┐
│                    INFERENCE LAYER                     │
│  Primitive inference steps & domain-independent roles  │
└───────────────────────────┬────────────────────────────┘
                            │ applies to
┌───────────────────────────▼────────────────────────────┐
│                     DOMAIN LAYER                       │
│  Static schemas (concepts, relations) & instances      │
└────────────────────────────────────────────────────────┘
```

---

## 2. Domain Knowledge Specification

Domain knowledge captures the static facts, schemas, and structural dependencies of the field.

### Concepts & Attributes
Define concepts as classes with typed attributes:
```
Concept: Applicant
  Attributes:
    age: Integer
    income: Currency
    credit_score: Integer
    employment_status: {employed, self_employed, unemployed}
```

### Relations
Define binary and n-ary relations between concepts:
```
Relation: owns(Applicant, Property)
Relation: qualifies_for(Applicant, LoanType)
```

### Rule Types
Specify structural dependencies between domain assertions:
```
Rule-Type: Risk-Category-Derivation
  Antecedent: Applicant.credit_score < 600 AND Applicant.employment_status = unemployed
  Consequent: Applicant.risk_level = high
  Cardinality: Many-to-one
  Connection-Type: Definitional / Heuristic
```

---

## 3. Inference Knowledge & Knowledge Roles

Inferences are the primitive building blocks of reasoning. They transform dynamic knowledge inputs into outputs using static domain knowledge.

### Rules of Inference Design
- **Declarative black box**: An inference specifies *what* is computed, not algorithmic steps or control flow. If internal steps are needed, promote it to a subtask.
- **Knowledge Roles**: Decouple inference definitions from domain terms.
  - **Dynamic Roles**: Inputs and outputs that change during a consultation (e.g., `Complaint`, `Candidate-Hypothesis`, `Selected-Therapy`).
  - **Static Roles**: Stable background domain knowledge consulted during inference (e.g., `Causal-Model`, `Eligibility-Norms`, `Sensitivity-Grid`).

### Transfer Functions
Define boundary interactions with external agents:
- **Obtain**: System requests information from human/sensor.
- **Receive**: External entity volunteers information without prompt.
- **Present**: System displays information to user.
- **Provide**: System delivers output upon external request.

---

## 4. Task Template Catalog

Select a standard problem-solving pattern from the catalog to accelerate conceptual modeling.

### Analytic Task Templates (Interpreting Existing Data)

#### 1. Classification
Map case features directly to predefined output categories.
- **Inferences**: `Match` (features to classes).
- **Dynamic Roles**: `Case-Features` → `Category`.
- **Static Roles**: `Classification-Hierarchy`.

#### 2. Assessment
Compare a case instance against explicit norms or regulatory standards.
- **Inferences**: `Abstract` (raw data → abstracted features), `Specify` (select applicable norms), `Evaluate` (test norms against case), `Match` (aggregate evaluations to final decision).
- **Dynamic Roles**: `Case-Data` → `Abstracted-Features` → `Norm-Evaluations` → `Assessment-Decision`.
- **Static Roles**: `Norm-System`, `Decision-Rules`.

#### 3. Diagnosis
Determine the root cause of observed discrepancies or faults.
- **Variants**:
  - *Heuristic Classification*: `Abstract` symptoms → `Heuristic-Match` to disease categories → `Refine` to specific diagnosis.
  - *Causal / Model-Based*: `Cover` (find all faults explaining symptom) → `Select` hypothesis → `Specify` test → `Verify` candidate.
- **Dynamic Roles**: `Symptom/Observation` → `Fault-Hypothesis` → `Differential-Set` → `Confirmed-Fault`.
- **Static Roles**: `Causal-Network`, `Fault-Model`.

#### 4. Monitoring
Continually compare streaming case states against dynamic expected thresholds.
- **Inferences**: `Receive` current state → `Compare` against expectation range → `Detect-Discrepancy` → `Classify-Alarm`.
- **Dynamic Roles**: `Sensor-Value` → `Expected-Range` → `Discrepancy` → `Alarm-Status`.

---

### Synthetic Task Templates (Constructing Solutions)

#### 1. Configuration Design
Assemble a functional artifact from predefined components under structural constraints.
- **Inferences**: `Select-Requirement` → `Identify-Components` → `Check-Constraints` → `Evaluate-Assembly`.
- **Dynamic Roles**: `Requirements` → `Partial-Design` → `Violations` → `Completed-Configuration`.
- **Static Roles**: `Component-Catalog`, `Constraint-Set`.

#### 2. Assignment / Matching
Map elements from one set to another (e.g., jobs to workers, students to courses) optimizing cost/preference.
- **Inferences**: `Rank-Candidates` → `Match-Pairs` → `Evaluate-Capacity`.
- **Dynamic Roles**: `Demands`, `Resources` → `Allocations`.

#### 3. Planning & Scheduling
Formulate an ordered sequence of operations (Planning) and assign specific time slots and resources to operations (Scheduling).
- **Inferences**: `Select-Goal` → `Decompose-Action` → `Order-Steps` → `Allocate-Time/Resource` → `Resolve-Bottlenecks`.

---

## 5. Model Construction Strategies

Choose one of three construction routes:

1. **Top-Down (Template-Driven)**: Select a catalog task template first, specialize knowledge roles, then instantiate the domain schema to fit the roles. Optimal for standard diagnostic or assessment tasks.
2. **Bottom-Up (Data-Driven)**: Build the domain schema from expert transcripts first, group into concepts and relations, then identify recurring inference patterns. Optimal for novel domains.
3. **Middle-Out (Balanced)**: Draft core concepts and identify 2–3 key inferences simultaneously, then bridge upward into task methods and downward into schemas. Recommended for most projects.
