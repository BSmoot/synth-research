# Example: CRISPR + Reinforcement Learning Cross-Domain Synthesis

This example demonstrates how Synthesis Labs generates hypotheses by finding connections between CRISPR gene editing and reinforcement learning.

## Query

```
How can we improve CRISPR guide RNA design using machine learning?
```

## Target Domain

computational-biology

## Expected Flow

### Stage 1: Domain Analysis

Extract concepts from computational biology focused on CRISPR:

**Concepts**:
- Guide RNA (gRNA): Short RNA sequence directing Cas9 to target DNA
- Off-target effects: Unintended DNA cuts at similar sequences
- PAM sequence: Required DNA motif for Cas9 binding
- Specificity score: Metric predicting gRNA precision

**Methods**:
- Rule-based scoring: Hand-crafted feature combinations
- Sequence alignment: Finding similar target sites
- Activity prediction: Estimating cutting efficiency

**Open Problems**:
- Off-target prediction accuracy (~70% current state-of-art)
- Context-dependent activity variation
- Delivery efficiency optimization

### Stage 2: Cross-Pollination

Find connections to ML/AI domain:

**Connection 1**: Attention mechanisms (similarity: 4/5)
- Source: Transformer attention for sequence modeling
- Target: gRNA-DNA binding prediction
- Type: transferable-method
- Explanation: Both involve sequence-to-sequence relevance scoring

**Connection 2**: Reinforcement learning (similarity: 4/5)
- Source: RL for sequential decision making
- Target: Guide RNA optimization
- Type: analogous-problem
- Explanation: Designing gRNA is an optimization over discrete space

**Connection 3**: Graph neural networks (similarity: 3/5)
- Source: GNN for molecular property prediction
- Target: RNA secondary structure effects
- Type: shared-structure
- Explanation: Both represent structural dependencies

### Stage 3: Hypothesis Synthesis

**Hypothesis 1**: Attention-Based Off-Target Prediction
```
By applying transformer attention mechanisms from NLP to CRISPR guide RNA design,
we hypothesize that position-dependent binding patterns can be learned to achieve
>85% off-target prediction accuracy, because attention naturally models which
nucleotide positions matter most for specificity.
```

**Hypothesis 2**: RL-Guided gRNA Optimization
```
By framing guide RNA design as a reinforcement learning problem where the agent
optimizes for high on-target activity and low off-target potential, we hypothesize
that RL can discover novel gRNA sequences that outperform rule-based designs,
because RL can explore the discrete sequence space more efficiently than enumeration.
```

### Stage 4: Validation

**Hypothesis 1 Scores**:
- Specificity: 4/5 (testable with clear metrics)
- Novelty: 3/5 (related work exists but attention-specific less explored)
- Connection Validity: 4/5 (strong structural parallel)
- Feasibility: 4/5 ($50K-100K, 6-12 months)
- Grounding: 3/5 (1 verified citation)
- **Composite: 3.65 - PASS**

**Hypothesis 2 Scores**:
- Specificity: 4/5 (testable)
- Novelty: 4/5 (less explored for CRISPR)
- Connection Validity: 4/5 (genuine problem isomorphism)
- Feasibility: 3/5 (requires significant compute)
- Grounding: 3/5 (1 verified citation)
- **Composite: 3.65 - PASS**

## Output

```json
{
  "traceId": "abc-123",
  "query": "How can we improve CRISPR guide RNA design using machine learning?",
  "domain": "computational-biology",
  "hypotheses": [
    {
      "rank": 1,
      "title": "Attention-Based CRISPR Off-Target Prediction",
      "statement": "Transformer attention mechanisms can improve CRISPR off-target prediction accuracy to >85% by learning position-dependent nucleotide binding patterns.",
      "scores": { "composite": 3.65 },
      "verdict": "pass"
    },
    {
      "rank": 2,
      "title": "Reinforcement Learning for Guide RNA Sequence Optimization",
      "statement": "RL agents can discover novel gRNA sequences that outperform rule-based designs by efficiently exploring the discrete sequence space.",
      "scores": { "composite": 3.65 },
      "verdict": "pass"
    }
  ],
  "metadata": {
    "totalGenerated": 3,
    "totalValidated": 2,
    "totalRejected": 1
  }
}
```

## Running This Example

```bash
# Set your API key
export ANTHROPIC_API_KEY=your-key-here

# Run the synthesis
npm run dev -- "How can we improve CRISPR guide RNA design using machine learning?" --domain=computational-biology
```

## Notes

- The actual output will vary based on LLM responses
- Citation verification requires web search capability
- Hypotheses should be independently validated before research investment
