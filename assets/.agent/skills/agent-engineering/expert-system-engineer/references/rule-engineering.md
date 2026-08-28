# Rule Engineering Guide (MYCIN/EMYCIN Patterns)

Reference for constructing, calculating, and verifying rule-based expert systems. Consult during **Phase 4 (Knowledge Representation & Rule Engineering)** and **Phase 5 (Verification & Validation)**.

---

## 1. Context Trees & Domain Entity Modeling

The Context Tree organizes domain objects into a strict hierarchy to manage multi-object scope and quantification.

```
       PATIENT (Root Node)
          │
     ┌────┴─────────┐
     ▼              ▼
  CULTURE        TREATMENT
     │
     ▼
  ORGANISM
```

### Context-Type Definition Template
```text
Context-Type: ORGANISM
  ASSOCWITH: CULTURE
  INITIALDATA: [STAIN, MORPHOLOGY]
  MAINPROPS: [IDENT, AEROBICITY, GRAM]
  PROMPT1: "Enter the identity or morphology of the first organism:"
  PROMPT2: "Enter the next organism found in this culture:"
```

---

## 2. Parameter Dictionary Specifications

Every parameter bound to a context must have precise validation properties:

| Property | Description | Example Values |
|---|---|---|
| `TYPE` | Exclusivity of values | `SINGLE-VALUED`, `MULTI-VALUED`, `YES-NO` |
| `EXPECT` | Valid value domain | `(YN)`, `(NUMB)`, `(ONEOF MALE FEMALE)`, `(ANY)` |
| `ASKFIRST` | Query precedence | `TRUE` (prompt user before tracing rules) |
| `TRANS` | Translation pattern | `("the stain of *" ORGANISM)` |

### Exclusivity Rules
- **Single-Valued**: Confirming a hypothesis with certainty ($CF = 1.0$) immediately forces all alternative values for that parameter to $CF = -1.0$.
- **Multi-Valued**: Hypotheses accumulate independent belief without competing against each other.
- **Yes-No**: Binary parameter where $CF(NO) \equiv -CF(YES)$.

---

## 3. Production Rule Syntax & Predicate Functions

Rules are encoded in a standardized modular format:

```text
RULE035
PREMISE: ($AND (SAME CNTXT SITE BLOOD)
               (SAME CNTXT MORPH ROD)
               (SAME CNTXT GRAM GRAMNEG))
ACTION:  (CONCLUDE CNTXT IDENT E.COLI TALLY 0.8)
```

### Standard Predicate Evaluators
- `(SAME CNTXT PARAM VALUE)`: Evaluates true if `PARAM` has `VALUE` with $CF \ge 0.2$.
- `(NOTSAME CNTXT PARAM VALUE)`: Evaluates true if $CF \le -0.2$.
- `(KNOWN CNTXT PARAM)`: Evaluates true if any value has been established ($|CF| \ge 0.2$).
- `(NOTKNOWN CNTXT PARAM)`: Evaluates true if no value has been established.
- `(DEFINITE CNTXT PARAM VALUE)`: Evaluates true if $CF = 1.0$.
- `(MIGHTBE CNTXT PARAM VALUE)`: Evaluates true if hypothesis is not definitively disproven ($CF > -0.8$).

---

## 4. Certainty Factor (CF) Calculus

Certainty Factors quantify evidential weight on a continuous scale $[-1.0, +1.0]$.

### 1. Premise Evaluation ($AND Minimization)
For a rule with conjuncts $C_1, C_2, \dots, C_n$:
$$\text{TALLY} = \min(CF(C_1), CF(C_2), \dots, CF(C_n))$$
- If $\text{TALLY} \le 0.2$, the premise is considered **FALSE**; evaluation terminates immediately (**Threshold Guardrail**).

### 2. Rule Conclusion Strength
$$Y = \text{TALLY} \times CF_{\text{rule}}$$

### 3. Evidence Combination (`CF_COMBINE`)
To combine existing cumulative certainty $X$ with new independent rule contribution $Y$:

$$\text{CF}_{\text{combined}}(X, Y) = \begin{cases} 
X + Y(1 - X) & \text{if } X > 0, Y > 0 \\
-(-X + (-Y)(1 - (-X))) & \text{if } X < 0, Y < 0 \\
\dfrac{X + Y}{1 - \min(|X|, |Y|)} & \text{if } X \times Y < 0 
\end{cases}$$

---

## 5. Backward-Chaining Execution Mechanics

```
┌────────────────────────────────────────────────────────┐
│                        FINDOUT                         │
│  1. Check if parameter is ASKFIRST → Prompt user       │
│  2. If unknown → Retrieve rules from UPDATED-BY list   │
│  3. Separate non-self-referencing & self-referencing   │
│  4. Apply PREVIEW filter (discard known-false rules)   │
│  5. Check LOOP GUARD (halt recursive self-calls)       │
│  6. Pass candidate rules to MONITOR                    │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                        MONITOR                         │
│  1. Evaluate premise clauses sequentially via $AND     │
│  2. For unknown clauses → Recursively invoke FINDOUT   │
│  3. If TALLY > 0.2 → Execute CONCLUDE                  │
│  4. Combine CF via CF_COMBINE into parameter store     │
│  5. If CF = 1.0 (Unity Path) → Bypass remaining rules   │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│              SELF-REFERENCING RULE RUN                 │
│  Execute rules with parameter in premise and action    │
│  only after regular rules complete                     │
└────────────────────────────────────────────────────────┘
```

---

## 6. Static Knowledge Base Verification

Analyze rule partitions before runtime execution to ensure structural integrity:

### 1. Conflict Detection
Two rules in the same partition with identical premises concluding contradictory values:
$$\text{Rule 1: } A \land B \rightarrow C \quad (CF = 0.8)$$
$$\text{Rule 2: } A \land B \rightarrow \neg C \quad (CF = 0.8)$$
**Resolution**: Clarify differentiating conditions with expert or reconcile contradictory evidence weights.

### 2. Redundancy Detection
Two rules with identical condition sets concluding the exact same value and certainty.
**Resolution**: Eliminate the duplicate rule.

### 3. Subsumption Detection
Rule 1 contains a strict subset of conditions of Rule 2 and reaches the identical conclusion:
$$\text{Rule 1: } A \rightarrow C$$
$$\text{Rule 2: } A \land B \rightarrow C$$
**Resolution**: Rule 2 is subsumed unless $B$ substantially alters the certainty factor.

### 4. Completeness Matrix Check
Construct a condition-action table for all valid attribute values. Flag all condition combinations lacking rule coverage to determine whether they represent domain omissions or impossible physical states.
