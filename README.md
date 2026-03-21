# rag-prompt-builder

Compose RAG (Retrieval-Augmented Generation) prompts from document chunks with automatic metadata injection, token budget management, and multi-format output.

## Install

```bash
npm install rag-prompt-builder
```

Zero runtime dependencies.

## Quick Start

```typescript
import { buildPrompt } from 'rag-prompt-builder'

const sources = [
  {
    content: 'Paris is the capital of France.',
    id: 'doc-1',
    metadata: { title: 'Geography Guide', url: 'https://example.com/geo' },
  },
  {
    content: 'The Eiffel Tower is located in Paris.',
    id: 'doc-2',
    metadata: { title: 'Landmarks Guide' },
  },
]

const prompt = buildPrompt('What is the capital of France?', sources)

// prompt.messages → ready to pass to OpenAI / Anthropic
// prompt.system   → system message content
// prompt.sources  → metadata about included sources
```

## Templates

Six built-in templates control the system prompt and query framing:

| Template | Description |
|---|---|
| `qa` (default) | Answer from context only; frames query with "Based on the context above, please answer:" |
| `summarize` | Concise, accurate summaries |
| `compare` | Objective comparison across sources |
| `extract` | Structured data extraction |
| `conversational` | Natural responses incorporating context |
| `cite` | Answer with `[1]`, `[2]` source citations |

```typescript
import { qa, summarize, compare, extract, conversational, cite } from 'rag-prompt-builder'

const result = cite('What are the main findings?', sources)
```

Or pass `template` in options:

```typescript
buildPrompt('query', sources, { template: 'summarize' })
```

### Custom Templates

```typescript
import { defineTemplate, buildPrompt } from 'rag-prompt-builder'

defineTemplate('legal', {
  system: 'You are a legal research assistant. Cite jurisdiction where applicable.',
  queryFraming: 'Research question: {{query}}',
  contextPlacement: 'user',
})

buildPrompt('What are the liability limits?', sources, { template: 'legal' })
```

## Source Formats

Five ways to format retrieved chunks in the prompt:

| Format | Description |
|---|---|
| `numbered` (default) | `[1] content` then `Source: title \| url` |
| `xml` | `<source id="1" title="..." url="...">content</source>` |
| `markdown` | `## Source 1: title` heading, then content, then `---` |
| `json` | JSON array with `{index, content, title?, url?}` |
| `custom` | Call your own formatter function |

```typescript
buildPrompt('query', sources, {
  sourceFormat: 'xml',
  showMetadata: true,
})

// Custom formatter
buildPrompt('query', sources, {
  sourceFormat: 'custom',
  customFormat: (srcs) => srcs.map((s, i) => `--- ${i + 1} ---\n${s.content}`).join('\n\n'),
})
```

## Token Budget

Prevent context overflow by setting a token budget (measured in approximate tokens via `Math.ceil(text.length / 4)` by default):

```typescript
// Drop sources that don't fit
buildPrompt('query', sources, {
  contextBudget: 1000,
  budgetStrategy: 'drop',  // default
})

// Truncate the last source to use remaining tokens
buildPrompt('query', sources, {
  contextBudget: 1000,
  budgetStrategy: 'truncate',
})

// Custom token counter (e.g. tiktoken)
buildPrompt('query', sources, {
  contextBudget: 1000,
  tokenCounter: (text) => myTiktoken.encode(text).length,
})
```

Dropped sources are returned in `result.droppedSources`.

## Output Formats

```typescript
// OpenAI (default) — system + user messages
buildPrompt('query', sources, { outputFormat: 'openai' })
// → { messages: [{role:'system',...}, {role:'user',...}] }

// Anthropic — user message only (pass system separately)
buildPrompt('query', sources, { outputFormat: 'anthropic' })
// → { messages: [{role:'user',...}], system: '...' }

// Plain text — system + context + query as a single string
buildPrompt('query', sources, { outputFormat: 'text' })
// → { text: '...', messages: [] }
```

## createBuilder

Pre-configure options once and reuse:

```typescript
import { createBuilder } from 'rag-prompt-builder'

const builder = createBuilder({
  sourceFormat: 'xml',
  showMetadata: true,
  outputFormat: 'anthropic',
  contextBudget: 2000,
})

const result = builder.qa('What is Paris?', sources)
const summary = builder.summarize('Summarize these docs.', sources)
const cited = builder.cite('What are the findings?', sources)
```

The builder exposes `qa`, `summarize`, `compare`, `extract`, `conversational`, `cite`, and the generic `buildPrompt`.

## API

### `buildPrompt(query, sources, options?): BuiltPrompt`

| Option | Type | Default | Description |
|---|---|---|---|
| `template` | `string` | `'qa'` | Built-in or custom template name |
| `systemPrompt` | `string` | template default | Override the system message |
| `sourceFormat` | `SourceFormat` | `'numbered'` | How to format sources |
| `customFormat` | `(sources) => string` | — | Custom formatter (requires `sourceFormat: 'custom'`) |
| `showMetadata` | `boolean` | `false` | Include title/url/date/author/page in formatted sources |
| `outputFormat` | `OutputFormat` | `'openai'` | Shape of the messages array |
| `contextBudget` | `number` | — | Max tokens for context block |
| `budgetStrategy` | `'drop'\|'truncate'` | `'drop'` | What to do when budget exceeded |
| `tokenCounter` | `(text) => number` | `ceil(len/4)` | Custom token counting function |

### `BuiltPrompt`

```typescript
{
  system: string           // system message content
  query: string            // original query
  messages: Message[]      // ready-to-send messages array
  text?: string            // populated when outputFormat='text'
  tokenCount: number       // approximate total tokens
  template: string         // template used
  sourceFormat: string     // source format used
  sources: IncludedSource[] // metadata for included sources
  droppedSources: RAGSource[] // sources dropped due to budget
  timestamp: string        // ISO 8601 timestamp
}
```

## License

MIT
