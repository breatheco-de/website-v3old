# Polling System — YAML Specification

## Overview

A polling system defined in YAML that presents a series of questions to the user and redirects them to a URL (or shows a message) based on their answers. The routing strategy depends on the `aggregation_method`.

---

## Top-Level Structure

```yaml
aggregation_method: concat | sum
questions: []
routes: []
```

| Field | Required | Description |
|---|---|---|
| `aggregation_method` | Yes | How answers are aggregated to determine the route. Either `concat` or `sum`. |
| `questions` | Yes | Ordered list of questions to present to the user. |
| `routes` | Yes | Routing rules evaluated after all questions are answered. |

---

## Questions

Each question in the `questions` list has the following structure:

```yaml
questions:
  - id: 1
    label: "How much experience do you have?"
    options:
      - id: 1
        label: "A lot"
        action:
          next_question: 2
      - id: 2
        label: "Some"
        action:
          url: "/pricing/basic"
```

| Field | Required | Description |
|---|---|---|
| `id` | Yes | Unique integer identifier for the question. Used to build route keys and for `next_question` references. |
| `label` | Yes | The question text displayed to the user. |
| `options` | Yes | List of answer options. Must have at least one. |

---

## Options

Each option inside a question has the following structure:

```yaml
options:
  - id: 1
    label: "Yes"
    action:
      next_question: 2
```

| Field | Required | Description |
|---|---|---|
| `id` | Yes | Unique integer identifier for the option within its question. Used to build route keys. |
| `label` | Yes | The answer text displayed to the user. |
| `action` | Yes | Defines what happens when this option is selected. |

---

## Action

The `action` object controls what happens after an option is selected. Fields are mutually exclusive in terms of priority — only the highest-priority field present is applied.

```yaml
action:
  next_question: 2   # continue the flow
  url: "/pricing"    # override redirect
  message: "Sorry, this is not for you."  # show message instead
```

| Field | Priority | Description |
|---|---|---|
| `url` | 1 (highest) | Immediately redirects the user. Overrides `routes` and `message`. |
| `message` | 2 | Shows a message to the user. Stays on the same page. No redirect occurs. |
| `next_question` | 3 | ID of the next question to show. Continues the flow. |

If none of the above are present on a leaf option, the flow completes and routing is resolved via the `routes` map.

### Priority Chain

```
url > message > next_question > routes
```

### URL Format

The `url` field supports standard URL formats:

| Format | Example | Behavior |
|---|---|---|
| Full path | `/pricing/enterprise` | Redirects to that page |
| Path + hash | `/pricing#enterprise-plan` | Redirects to page and scrolls to anchor |
| Hash only | `#contact-modal` | Stays on current page, scrolls/opens element |
| External | `https://example.com` | Full external redirect |

---

## Aggregation Methods

### `concat`

Concatenates the selected option IDs into a path key, then matches against a `routes` map.

**Path key format:** `q{question_id}o{option_id}-q{question_id}o{option_id}-...`

**Example:** User selects option 1 on question 1, then option 2 on question 2 → key is `q1o1-q2o2`.

```yaml
aggregation_method: concat

questions:
  - id: 1
    label: "How much experience do you have?"
    options:
      - id: 1
        label: "A lot"
        action:
          next_question: 2
      - id: 2
        label: "None"
        action:
          next_question: 2

  - id: 2
    label: "How much time can you dedicate?"
    options:
      - id: 1
        label: "Full time"
        action:
          next_question: null
      - id: 2
        label: "Part time"
        action:
          next_question: null

routes:
  "q1o1-q2o1":
    url: "/pricing/enterprise"
  "q1o1-q2o2":
    url: "/pricing/basic"
  "q1o2-q2o1":
    message: "You may not be ready yet. Check our intro course."
  "q1o2-q2o2":
    url: "/blog/getting-started"
```

> **Note:** Route keys are system-generated from user selections — authors only need to fill in the `url` or `message` for each path.

Each route entry supports:

| Field | Description |
|---|---|
| `url` | Redirect the user to this URL (supports path, path+hash, hash-only, external). |
| `message` | Show a message instead of redirecting. |

---

### `sum`

Each option has a numeric `value`. The values are summed across all answers and matched against ordered threshold ranges in `routes`.

```yaml
aggregation_method: sum

questions:
  - id: 1
    label: "How much experience do you have?"
    options:
      - id: 1
        label: "A lot"
        value: 3
        action:
          next_question: 2
      - id: 2
        label: "Some"
        value: 2
        action:
          next_question: 2
      - id: 3
        label: "None"
        value: 1
        action:
          next_question: 2

  - id: 2
    label: "How much time can you dedicate?"
    options:
      - id: 1
        label: "Full time"
        value: 3
        action:
          next_question: null
      - id: 2
        label: "Part time"
        value: 2
        action:
          next_question: null
      - id: 3
        label: "Very little"
        value: 1
        action:
          next_question: null

routes:
  - until: 3
    message: "You may not be ready yet. Check our intro course."
  - until: 5
    url: "/pricing/basic"
  - until: 6
    url: "/pricing/enterprise"
  - fallback:
    url: "/contact"
```

#### `sum` Routes

Routes are an ordered list of thresholds. The engine picks the **first** entry whose `until` value is greater than or equal to the total score.

| Field | Description |
|---|---|
| `until` | Upper bound (inclusive) for this threshold range. |
| `url` | Redirect URL if this threshold is matched. |
| `message` | Message to display if this threshold is matched. |
| `fallback` | Catch-all entry if no `until` threshold is matched. |

> **Note:** Each route entry supports both `url` and `message` with the same semantics as `action`.

---

## Action Override

Regardless of `aggregation_method`, any option can short-circuit the flow with a `url` or `message` in its `action`. This takes priority over `routes`.

```yaml
- id: 2
  label: "No"
  action:
    message: "This product may not be the right fit for you."
```

```yaml
- id: 1
  label: "Yes, urgent"
  action:
    url: "#contact-modal"   # bypasses routes entirely
```

---

## Full Example — `concat`

```yaml
aggregation_method: concat

questions:
  - id: 1
    label: "Are you looking to change careers?"
    options:
      - id: 1
        label: "Yes"
        action:
          next_question: 2
      - id: 2
        label: "No, just upskilling"
        action:
          next_question: 2

  - id: 2
    label: "Do you have prior coding experience?"
    options:
      - id: 1
        label: "Yes"
        action:
          next_question: null
      - id: 2
        label: "No"
        action:
          next_question: null

routes:
  "q1o1-q2o1":
    url: "/programs/part-time"
  "q1o1-q2o2":
    url: "/programs/full-time"
  "q1o2-q2o1":
    url: "/programs/advanced"
  "q1o2-q2o2":
    message: "You may not be ready yet. Check our intro course."
```

## Full Example — `sum`

```yaml
aggregation_method: sum

questions:
  - id: 1
    label: "How much experience do you have?"
    options:
      - id: 1
        label: "A lot"
        value: 3
        action:
          next_question: 2
      - id: 2
        label: "Some"
        value: 2
        action:
          next_question: 2
      - id: 3
        label: "None"
        value: 1
        action:
          next_question: 2

  - id: 2
    label: "How much time can you dedicate?"
    options:
      - id: 1
        label: "Full time"
        value: 3
        action:
          next_question: null
      - id: 2
        label: "Part time"
        value: 2
        action:
          next_question: null
      - id: 3
        label: "Very little"
        value: 1
        action:
          next_question: null

routes:
  - until: 2
    message: "You may not be ready yet. Check our intro course."
  - until: 4
    url: "/pricing/basic"
  - until: 6
    url: "/pricing/enterprise"
  - fallback:
    url: "/contact"
```

---

## Validation Rules

- `aggregation_method` must be `concat` or `sum`.
- Every question must have a unique `id`.
- Every option must have a unique `id` within its question.
- Every question and option must have a non-empty `label`.
- `sum` mode requires a `value` field on every option.
- `concat` mode `routes` must be a map of path key strings to objects with either `url` or `message`.
- `sum` mode `routes` must be an ordered list with `until` values in ascending order.
- `url` and `message` are mutually exclusive in any `action` or route entry.
- A `fallback` entry in `sum` routes is recommended but not required.
