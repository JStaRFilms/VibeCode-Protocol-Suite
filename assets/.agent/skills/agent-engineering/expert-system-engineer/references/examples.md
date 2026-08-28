# Worked Examples & Operational Traces

Reference containing concrete case studies, inference execution traces, explanation dialogues, and knowledge acquisition sessions. Consult during **Phase 3**, **Phase 4**, and **Phase 6**.

---

## Example 1: CommonKADS Assessment Template (Housing Eligibility)

**Scenario**: Allocating public rental housing based on statutory income and family criteria.

### 1. Conceptual Model Configuration
- **Task**: `Assess-Housing-Eligibility`
- **Domain Concepts**: `Applicant`, `Residence`, `Household`, `Norm`
- **Dynamic Roles**: `Case-Data` (income, household size) → `Abstracted-Attributes` (household type, income tier) → `Evaluated-Norms` → `Decision`
- **Static Roles**: `Legal-Norm-System`, `Eligibility-Rules`

### 2. Inference Execution Trace
1. **Abstract**:
   - Input: `Household.size = 5`, `Applicant.income = 32,000`
   - Inference: Map raw numbers to qualitative domain categories.
   - Output: `Household.type = LARGE_FAMILY`, `Income.tier = LOW_INCOME`.
2. **Specify**:
   - Input: `Residence.type = APARTMENT_4_BEDROOM`
   - Inference: Retrieve applicable legal norms for 4-bedroom municipal housing.
   - Output: `Norm-1 (Min-Size = 4)`, `Norm-2 (Max-Income = 35,000)`.
3. **Evaluate**:
   - Compare `Household.type` against `Norm-1` $\rightarrow$ `SATISFIED`.
   - Compare `Income.tier` against `Norm-2` $\rightarrow$ `SATISFIED`.
4. **Match**:
   - Aggregate all evaluated norms. All norms satisfied $\rightarrow$ Conclude `ELIGIBLE`.

**Key Lesson**: Abstracting raw quantitative inputs into qualitative features separates static business rules from dynamic applicant data.

---

## Example 2: Goal-Directed Backward Chaining Trace with Certainty Factors

**Scenario**: Diagnosing organism identity (`IDENT`) for an acute blood infection.

### 1. Execution Trace
1. `FINDOUT` called on `ORGANISM-1.IDENT`.
2. Parameter is flagged `ASKFIRST: TRUE`. System queries user:
   ```text
   1) Enter the identity (genus) of ORGANISM-1:
   ** UNKNOWN
   ```
3. User enters `UNKNOWN`. `FINDOUT` retrieves candidate rules from `UPDATED-BY[IDENT]`: `[RULE035, RULE040, RULE084]`.
4. `RULE040` contains `IDENT` in premise and action (Self-Referencing) $\rightarrow$ Partitioned for deferred execution.
5. `MONITOR` evaluates `RULE035`:
   ```text
   PREMISE: ($AND (SAME CNTXT SITE BLOOD)
                  (SAME CNTXT MORPH ROD)
                  (SAME CNTXT GRAM GRAMNEG))
   ACTION:  (CONCLUDE CNTXT IDENT E.COLI TALLY 0.8)
   ```
6. `FINDOUT` evaluates each clause:
   - Clause 1: `SITE = BLOOD` ($CF = 1.0$) — established from initial case data.
   - Clause 2: `MORPH = ROD` ($CF = 0.8$) — queried from user.
   - Clause 3: `GRAM = GRAMNEG` ($CF = 1.0$) — queried from user.
7. `MONITOR` calculates premise tally:
   $$\text{TALLY} = \min(1.0, 0.8, 1.0) = 0.8$$
8. Since $\text{TALLY} = 0.8 > 0.2$, `CONCLUDE` computes rule contribution:
   $$Y = 0.8 \times 0.8 = 0.64$$
   `Val[ORGANISM-1, IDENT]` updated to `(E.COLI 0.64)`.
9. `MONITOR` evaluates next regular rule (`RULE084`), which concludes `(E.COLI 0.50)`.
10. `CF_COMBINE` merges the two independent findings:
    $$\text{CF}_{\text{combined}} = 0.64 + 0.50 \times (1 - 0.64) = 0.64 + 0.18 = 0.82$$
11. Finally, deferred self-referencing `RULE040` executes to apply final clinical utility adjustments.

**Outcome**: Final diagnosis established: `E.COLI (CF = 0.82)`.

---

## Example 3: Interactive WHY / HOW Explanation Dialogue

**Scenario**: User is asked a sensitive laboratory question during consultation and requests dynamic justification.

```text
22) Was penicillinase added to this culture (CULTURE-1)?
** WHY

[i.e. WHY is it important to determine whether penicillinase was added to CULTURE-1?]
[1.0] This will aid in determining whether ORGANISM-1 is a contaminant.
It has already been established that:
  [1.1] The site of CULTURE-1 is blood
  [1.2] The gram stain of ORGANISM-1 is grampos
Therefore, if:
  [1.3] Penicillinase was added to this culture
Then:
  There is weakly suggestive evidence (0.4) that ORGANISM-1 is a contaminant [RULE039]

** WHY

[i.e. WHY is it important to determine whether ORGANISM-1 is a contaminant?]
[2.0] ... In order to determine whether there is significant disease associated with ORGANISM-1.
It has already been established that:
  [2.1] CULTURE-1 was obtained from a normally sterile site
Therefore, if:
  [2.2] ORGANISM-1 is not a contaminant
Then:
  There is strongly suggestive evidence (0.9) that there is significant disease [RULE032]

** HOW 1.2

[i.e. HOW was it established that the gram stain of ORGANISM-1 is grampos?]
In answer to question 4 you specified that the gram stain of ORGANISM-1 is grampos (1.0).
```

**Key Lesson**: Explanations unwind the dynamic goal stack in real time without requiring hardcoded script branches.

---

## Example 4: Plan-Generate-and-Test Selection (Constrained Assignment)

**Scenario**: Selecting an optimal combination of 2 antimicrobial drugs covering 3 confirmed pathogens while respecting patient penicillin allergy and renal clearance.

```text
Pathogen Indications:
  - Organism 1 (Pseudomonas): Candidate rankings: [Tobramycin (Rank 1), Gentamicin (Rank 1), Carbenicillin (Rank 2)]
  - Organism 2 (Klebsiella):  Candidate rankings: [Cefazolin (Rank 1), Gentamicin (Rank 1), Chloramphenicol (Rank 2)]
  - Organism 3 (E. Coli):     Candidate rankings: [Ampicillin (Rank 1), Gentamicin (Rank 1), Cephalothin (Rank 2)]

Patient Constraints:
  - Penicillin Allergy = TRUE (rejects Ampicillin, Carbenicillin)
  - Creatinine Clearance = 45 mL/min (moderate renal impairment)

Generate-and-Test Loop:
  1. Proposal 1: [Ampicillin + Tobramycin] → Fails constraint test (Penicillin allergy).
  2. Proposal 2: [Tobramycin + Gentamicin] → Fails constraint test (Duplicate aminoglycoside toxicity).
  3. Proposal 3: [Cefazolin + Tobramycin]   → Passes coverage & allergy checks.

Dosage Formulation:
  - Calculate Cefazolin dose based on body surface area (1.0 g IV q8h).
  - Calculate Tobramycin modified dosing interval for CCr = 45 mL/min (80 mg IV q16h).
```

**Key Lesson**: Generate-and-test keeps local item ranking separate from multi-attribute constraint satisfaction.

---

## Example 5: Interactive Knowledge Acquisition & Debugging (TEIRESIAS Pattern)

**Scenario**: Domain expert notes system failed to conclude `ENTEROBACTERIACEAE` on a test case.

```text
Expert: "The system missed Enterobacteriaceae on Case 412."
System: Unwinding inference trace for Case 412...
        RULE184 failed because CATEGORY was unknown.
        No rules concluded CATEGORY was ENTEROBACTERIACEAE.

Expert enters new rule:
  "IF the infection is primary-bacteremia and the site is sterile,
   THEN the category is enterobacteriaceae (0.8)."

System parses rule against Rule Models:
  "I understand the rule as:
   IF:   1) INFECTION is PRIMARY-BACTEREMIA
         2) SITE is STERILE-SITES
   THEN: CATEGORY is ENTEROBACTERIACEAE (0.8)"

System applies Second-Guessing Model:
  "Most rules concluding CATEGORY that mention INFECTION and SITE
   also specify PORTAL-OF-ENTRY.
   Did you intend to specify PORTAL-OF-ENTRY?"

Expert: "Yes, PORTAL-OF-ENTRY is GASTROINTESTINAL."

System integrates updated rule RULE383, compiles indices, and re-executes Case 412:
  → ENTEROBACTERIACEAE successfully concluded (CF = 0.82).
```

**Key Lesson**: Statistical rule models assist human experts in identifying omitted premise conditions during interactive debugging.
