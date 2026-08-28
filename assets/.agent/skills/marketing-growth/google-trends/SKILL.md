---
name: google-trends
description: Automated Google Trends research via Node.js CLI. Search YouTube, Web, Images, News for rising/breakout queries. Use for Phase 1 Strategy research or any topic validation.
---

# Google Trends Skill

Automate Google Trends research without a browser. Query related topics, rising queries, and interest over time for any keyword across YouTube, Web, Images, or News.

## Prerequisites

Node.js 18+ and PNPM required.

```powershell
# Check Node
node --version

# Install dependencies (first-time only)
cd .agent/skills/google-trends/scripts
pnpm install
```

---

## Quick Start

```powershell
# Basic search (YouTube, Last 7 Days, Tech category)
node .agent/skills/google-trends/scripts/search.js -k "Claude AI"

# Search Web instead of YouTube
node .agent/skills/google-trends/scripts/search.js -k "AI agents" -p web

# Extended time range (1 month)
node .agent/skills/google-trends/scripts/search.js -k "VibeCoding" -t "now 1-m"

# Output as JSON for piping
node .agent/skills/google-trends/scripts/search.js -k "Cursor IDE" -o json
```

---

## CLI Reference

```
Usage: search.js [options]

Options:
  -k, --keyword <string>    Topic to search (required)
  -p, --property <string>   youtube | web | images | news | froogle (default: youtube)
  -t, --time <string>       now 7-d | now 1-m | today 3-m | today 12-m (default: now 7-d)
  -c, --category <number>   Google Trends category ID (default: 5 = Tech)
  -o, --output <string>     table | json | markdown (default: table)
  -f, --file <path>         Save output to file (optional)
  --interest                Include interest-over-time data (default: false)
  -h, --help                Show help
```

### Property Options

| Value | What It Searches |
|-------|------------------|
| `youtube` | YouTube Search trends |
| `web` | Google Web Search trends |
| `images` | Google Images trends |
| `news` | Google News trends |
| `froogle` | Google Shopping trends |

### Time Options

| Value | Period |
|-------|--------|
| `now 7-d` | Last 7 days |
| `now 1-m` | Last 30 days |
| `today 3-m` | Last 90 days |
| `today 12-m` | Last 12 months |

### Category IDs (Common)

| ID | Category |
|----|----------|
| 5 | Computers & Electronics (Tech) |
| 13 | Arts & Entertainment |
| 174 | Sports |
| 3 | Business & Industrial |

Full list: [Google Trends Categories](https://github.com/pat310/google-trends-api/wiki/Google-Trends-Categories)

---

## Example Workflows

### YouTube Phase 1 Research

Use this skill during `/youtube-phase1-strategy` to validate topics:

```powershell
# Check if "Claude Cowork" is rising on YouTube
node .agent/skills/google-trends/scripts/search.js -k "Claude Cowork" -p youtube -t "now 7-d"
```

**Signal:** Look for `BREAKOUT` or values > 100 in related queries.

### General Topic Validation

```powershell
# Is "RAG" still trending in AI?
node .agent/skills/google-trends/scripts/search.js -k "RAG AI" -p web -t "today 3-m" --interest
```

**Signal:** Check if interest-over-time is increasing or peaked.

---

## Output Formats

### Table (Default)
```
[TrendProbe] Searching: "Claude AI" on YouTube (Last 7 days)

--- Related Queries (Top) ---
1. claude ai assistant (100)
2. anthropic claude (81)
3. claude vs chatgpt (45)

--- Related Queries (Rising) ---
1. anthropic (BREAKOUT)
2. claude code (450%)
```

### JSON
```json
{
  "keyword": "Claude AI",
  "property": "youtube",
  "time": "now 7-d",
  "top": [...],
  "rising": [...]
}
```

### Markdown
```markdown
## Claude AI (YouTube, 7 days)
### Top Queries
1. claude ai assistant (100)
...
```

---

## Tips

1. **BREAKOUT = Gold.** A "BREAKOUT" query has grown > 5000% — this is a proven opportunity.
2. **Cross-validate.** Use with YouTube Studio Trends and Competitor VidIQ for 3-source validation.
3. **Try multiple keywords.** "Claude AI" vs "Claude Cowork" vs "Anthropic Claude" may reveal different signals.
4. **Category matters.** Category 5 (Tech) gives tech-focused results; omit `-c` for broader trends.
