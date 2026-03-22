# rag-prompt-builder

Compose RAG prompts from retrieved chunks with automatic metadata injection, token budget management, and multi-format output.

[![npm version](https://img.shields.io/npm/v/rag-prompt-builder.svg)](https://www.npmjs.com/package/rag-prompt-builder)
[![license](https://img.shields.io/npm/l/rag-prompt-builder.svg)](https://github.com/SiluPanda/rag-prompt-builder/blob/master/LICENSE)
[![node](https://img.shields.io/node/v/rag-prompt-builder.svg)](https://nodejs.org)

---

## Description

Every RAG pipeline contains a variant of the same function: format retrieved chunks into a context block, prepend a system prompt, frame the user query, and assemble a messages array for the model. This function gets copy-pasted, extended in incompatible ways, and never published as a reusable primitive.

`rag-prompt-builder` replaces that pattern with a single, well-tested function. It provides six built-in task templates (Q&A, summarization, comparison, extraction, conversational, citation), five source formatting styles (numbered, XML, markdown, JSON, custom), automatic metadata injection (title, URL, date, author, page), token budget enforcement with drop or truncate strategies, and output in OpenAI, Anthropic, or plain text format.

Zero runtime dependencies. Pure TypeScript. Node.js 18+.

---

## Installation

```bash
npm install rag-prompt-builder
```

---

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
    metadata: { title: 'Landmarks Guide', url: 'https://example.com/landmarks' },
  },
]

const prompt = buildPrompt('What is the capital of France?', sources)

// prompt.messages  -> ready to pass to OpenAI / Anthropic SDK
// prompt.system    -> system message content
// prompt.sources   -> metadata about each included source
// prompt.tokenCount -> approximate total token count
```

---

## Features

- **Six built-in templates** -- qa, summarize, compare, extract, conversational, cite -- each with a tuned system prompt and query framing.
- **Five source formats** -- numbered, XML, markdown, JSON, custom -- controlling how retrieved chunks appear in the prompt.
- **Metadata injection** -- Automatically include title, URL, date, author, and page from source metadata in the formatted context.
- **Token budget enforcement** -- Set a maximum token budget for the context block. Drop sources that exceed the budget or truncate the last source to fit.
- **Multi-format output** -- Produce OpenAI-style messages (system + user), Anthropic-style messages (user only, system separate), or plain text.
- **Custom templates** -- Register your own templates with `defineTemplate` and reference them by name.
- **Custom token counter** -- Plug in tiktoken or any other tokenizer. Default uses `Math.ceil(text.length / 4)`.
- **Factory builder** -- Pre-configure options once with `createBuilder` and reuse across many queries.
- **Zero dependencies** -- Pure TypeScript, no runtime dependencies.
- **Full TypeScript support** -- All types exported. Strict mode compatible.

---

## API Reference

### `buildPrompt(query, sources, options?)`

The primary function. Takes a user query, an array of retrieved source chunks, and optional configuration. Returns a `BuiltPrompt` object.

```typescript
import { buildPrompt } from 'rag-prompt-builder'

const result = buildPrompt('What is the capital of France?', sources, {
  template: 'qa',
  sourceFormat: 'numbered',
  showMetadata: true,
  outputFormat: 'openai',
  contextBudget: 2000,
  budgetStrategy: 'drop',
})
```

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `query` | `string` | Yes | The user query. Must be non-empty. |
| `sources` | `RAGSource[]` | Yes | Array of retrieved source chunks. Must be non-empty. |
| `options` | `BuildPromptOptions` | No | Configuration options (see below). |

**Options (`BuildPromptOptions`):**

| Option | Type | Default | Description |
|---|---|---|---|
| `template` | `BuiltInTemplate \| string` | `'qa'` | Built-in or custom template name. |
| `systemPrompt` | `string` | Template default | Override the system message entirely. |
| `sourceFormat` | `SourceFormat` | `'numbered'` | How to format sources in the context block. |
| `customFormat` | `(sources: RAGSource[]) => string` | -- | Custom formatter function. Required when `sourceFormat` is `'custom'`. |
| `showMetadata` | `boolean` | `false` | Include title, URL, date, author, page in formatted sources. |
| `outputFormat` | `OutputFormat` | `'openai'` | Shape of the output messages array. |
| `contextBudget` | `number` | -- | Maximum tokens for the context block. When omitted, no budget is enforced. |
| `budgetStrategy` | `'drop' \| 'truncate'` | `'drop'` | What to do when sources exceed the budget. |
| `tokenCounter` | `(text: string) => number` | `Math.ceil(text.length / 4)` | Custom token counting function. |

**Returns: `BuiltPrompt`**

```typescript
interface BuiltPrompt {
  system: string              // System message content
  query: string               // Original query string
  messages: Message[]         // Ready-to-send messages array
  text?: string               // Populated only when outputFormat is 'text'
  tokenCount: number          // Approximate total tokens (system + user content)
  template: string            // Template name used
  sourceFormat: string        // Source format used
  sources: IncludedSource[]   // Metadata for each included source
  droppedSources: RAGSource[] // Sources dropped due to budget constraints
  timestamp: string           // ISO 8601 timestamp of prompt assembly
}
```

---

### `createBuilder(config?)`

Factory function that returns a pre-configured builder instance. All options passed to `createBuilder` become defaults for every call on the returned builder. Per-call options override the defaults.

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

**Returns: `Builder`**

The builder exposes the following methods, each returning a `BuiltPrompt`:

| Method | Description |
|---|---|
| `buildPrompt(query, sources, opts?)` | Generic prompt builder with full options. |
| `qa(query, sources, opts?)` | Build a Q&A prompt. |
| `summarize(query, sources, opts?)` | Build a summarization prompt. |
| `compare(query, sources, opts?)` | Build a comparison prompt. |
| `extract(query, sources, opts?)` | Build an extraction prompt. |
| `conversational(query, sources, opts?)` | Build a conversational prompt. |
| `cite(query, sources, opts?)` | Build a citation prompt. |

---

### `defineTemplate(name, definition)`

Register a custom template that can be referenced by name in `buildPrompt` or any builder method.

```typescript
import { defineTemplate, buildPrompt } from 'rag-prompt-builder'

defineTemplate('legal', {
  system: 'You are a legal research assistant. Cite jurisdiction where applicable.',
  queryFraming: 'Research question: {{query}}',
  contextPlacement: 'user',
})

const result = buildPrompt('What are the liability limits?', sources, {
  template: 'legal',
})
```

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `name` | `string` | Template name for later reference. |
| `definition` | `TemplateDefinition` | Template specification (see below). |

**`TemplateDefinition`:**

```typescript
interface TemplateDefinition {
  system: string                      // System prompt text
  queryFraming: string                // Query framing with {{query}} placeholder
  contextPlacement: 'user' | 'system' // Where the context block appears
}
```

When `contextPlacement` is `'user'`, the formatted sources appear in the user message before the framed query. When `contextPlacement` is `'system'`, the formatted sources are appended to the system message.

---

### `formatSources(sources, format, showMetadata, customFn?)`

Low-level function that formats an array of sources into a string. Called internally by `buildPrompt`, but exported for direct use when you need formatted context without the full prompt assembly.

```typescript
import { formatSources } from 'rag-prompt-builder'

const formatted = formatSources(sources, 'xml', true)
```

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `sources` | `RAGSource[]` | Array of source chunks. |
| `format` | `SourceFormat` | One of `'numbered'`, `'xml'`, `'markdown'`, `'json'`, `'custom'`. |
| `showMetadata` | `boolean` | Whether to include metadata fields in the output. |
| `customFn` | `(sources: RAGSource[]) => string` | Required when `format` is `'custom'`. |

**Returns:** `string` -- the formatted context block.

---

### `defaultTokenCounter(text)`

The default token estimation function. Returns `Math.ceil(text.length / 4)` as an approximation of GPT-style token counts.

```typescript
import { defaultTokenCounter } from 'rag-prompt-builder'

const tokens = defaultTokenCounter('Hello, world!')
// -> 4
```

---

### Shorthand Functions

Six shorthand functions are exported for convenience. Each calls `buildPrompt` with the corresponding template pre-selected.

```typescript
import { qa, summarize, compare, extract, conversational, cite } from 'rag-prompt-builder'

const result = qa('What is the capital of France?', sources)
const summary = summarize('Summarize the documents.', sources)
const comparison = compare('Compare the two sources.', sources)
const extracted = extract('Extract all place names.', sources)
const chat = conversational('Tell me about Paris.', sources)
const cited = cite('What are the main findings?', sources)
```

Each shorthand accepts `(query, sources, opts?)` where `opts` is `BuildPromptOptions` without the `template` field.

---

## Configuration

### Templates

Six built-in templates control the system prompt and query framing:

| Template | System Prompt Summary | Query Framing |
|---|---|---|
| `qa` (default) | Answer from context only; say so if insufficient | `Based on the context above, please answer: {{query}}` |
| `summarize` | Concise, accurate summaries from context | `{{query}}` (no additional framing) |
| `compare` | Objective comparison across sources | `Using the sources provided, {{query}}` |
| `extract` | Structured data extraction from context | `Extract from the context: {{query}}` |
| `conversational` | Natural responses incorporating context | `{{query}}` (no additional framing) |
| `cite` | Answer with numbered source citations | `{{query}}` + citation instruction appended |

### Source Formats

Five ways to format retrieved chunks in the prompt context block:

**Numbered** (default):
```
[1] Paris is the capital of France.

Source: Geography Guide | https://example.com/geo

[2] The Eiffel Tower is located in Paris.

Source: Landmarks Guide | https://example.com/landmarks
```

**XML**:
```xml
<source id="1" title="Geography Guide" url="https://example.com/geo">
Paris is the capital of France.
</source>

<source id="2" title="Landmarks Guide" url="https://example.com/landmarks">
The Eiffel Tower is located in Paris.
</source>
```

**Markdown**:
```markdown
## Source 1: Geography Guide

Paris is the capital of France.

_Geography Guide | https://example.com/geo_

---

## Source 2: Landmarks Guide

The Eiffel Tower is located in Paris.

_Landmarks Guide | https://example.com/landmarks_

---
```

**JSON**:
```json
[
  {
    "index": 1,
    "content": "Paris is the capital of France.",
    "title": "Geography Guide",
    "url": "https://example.com/geo"
  },
  {
    "index": 2,
    "content": "The Eiffel Tower is located in Paris.",
    "title": "Landmarks Guide",
    "url": "https://example.com/landmarks"
  }
]
```

**Custom**:
```typescript
buildPrompt('query', sources, {
  sourceFormat: 'custom',
  customFormat: (srcs) =>
    srcs.map((s, i) => `--- ${i + 1} ---\n${s.content}`).join('\n\n'),
})
```

### Output Formats

**OpenAI** (default) -- system message + user message:
```typescript
buildPrompt('query', sources, { outputFormat: 'openai' })
// result.messages -> [{role: 'system', content: '...'}, {role: 'user', content: '...'}]
```

**Anthropic** -- user message only (system returned separately via `result.system`):
```typescript
buildPrompt('query', sources, { outputFormat: 'anthropic' })
// result.messages -> [{role: 'user', content: '...'}]
// result.system   -> '...'
```

**Text** -- single concatenated string, empty messages array:
```typescript
buildPrompt('query', sources, { outputFormat: 'text' })
// result.text     -> '...'
// result.messages -> []
```

### Token Budget

Set a maximum token budget for the context block. Sources are processed in order. When the budget is exceeded, the configured strategy determines what happens:

```typescript
// Drop strategy (default): sources that don't fit are dropped entirely
buildPrompt('query', sources, {
  contextBudget: 1000,
  budgetStrategy: 'drop',
})

// Truncate strategy: the last source that partially fits is truncated to fill remaining budget
buildPrompt('query', sources, {
  contextBudget: 1000,
  budgetStrategy: 'truncate',
})
```

Dropped sources are available in `result.droppedSources`. Truncated sources are marked with `truncated: true` in `result.sources`.

### Custom Token Counter

The default token counter estimates tokens as `Math.ceil(text.length / 4)`. For precise counts, provide a custom counter:

```typescript
import { encode } from 'gpt-tokenizer'

buildPrompt('query', sources, {
  contextBudget: 1000,
  tokenCounter: (text) => encode(text).length,
})
```

---

## Error Handling

`buildPrompt` throws standard `Error` instances in the following cases:

| Condition | Error Message |
|---|---|
| Empty or whitespace-only query | `query must be a non-empty string` |
| Empty sources array or non-array | `sources must be a non-empty array` |
| `sourceFormat: 'custom'` without `customFormat` | `customFormat function must be provided when sourceFormat is "custom"` |
| Unknown source format | `Unknown source format: <format>` |

All errors are thrown synchronously. There are no asynchronous operations in this package.

---

## Advanced Usage

### Pre-configured Builder with Factory

Use `createBuilder` to set defaults once for an entire application:

```typescript
import { createBuilder } from 'rag-prompt-builder'

const builder = createBuilder({
  sourceFormat: 'xml',
  showMetadata: true,
  outputFormat: 'anthropic',
  contextBudget: 4000,
  tokenCounter: (text) => myTokenizer.count(text),
})

// Every call inherits the factory defaults
const qaResult = builder.qa('What is X?', sources)
const summary = builder.summarize('Summarize.', sources)

// Per-call overrides still work
const openaiResult = builder.qa('What is X?', sources, { outputFormat: 'openai' })
```

### Custom Templates

Register domain-specific templates and reference them by name:

```typescript
import { defineTemplate, buildPrompt } from 'rag-prompt-builder'

defineTemplate('medical', {
  system: 'You are a medical information assistant. Always include disclaimers about consulting healthcare professionals. Answer based only on the provided clinical sources.',
  queryFraming: 'Clinical question: {{query}}',
  contextPlacement: 'user',
})

defineTemplate('code-review', {
  system: 'You are a code review assistant. Analyze the provided code snippets and provide actionable feedback.',
  queryFraming: 'Review request: {{query}}',
  contextPlacement: 'system',
})

const result = buildPrompt('What are the side effects?', sources, {
  template: 'medical',
})
```

### System Prompt Override

Replace the template system prompt while keeping the template's query framing and context placement:

```typescript
const result = buildPrompt('What is X?', sources, {
  template: 'qa',
  systemPrompt: 'You are a technical support agent for Acme Corp. Answer using only the provided documentation.',
})
// result.system -> 'You are a technical support agent for Acme Corp...'
// Query framing still uses the qa template's "Based on the context above, please answer:"
```

### Context Placement in System Message

When using a custom template with `contextPlacement: 'system'`, the formatted sources are appended to the system message instead of the user message:

```typescript
defineTemplate('system-context', {
  system: 'You are an assistant with access to the following reference material.',
  queryFraming: '{{query}}',
  contextPlacement: 'system',
})

const result = buildPrompt('What is X?', sources, { template: 'system-context' })
// result.system includes both the system prompt and the formatted sources
// The user message contains only the query
```

### Inspecting Dropped Sources

When using a token budget, inspect which sources were dropped and why:

```typescript
const result = buildPrompt('query', manyLargeSources, {
  contextBudget: 500,
  budgetStrategy: 'drop',
})

console.log(`Included: ${result.sources.length} sources`)
console.log(`Dropped: ${result.droppedSources.length} sources`)
console.log(`Total tokens: ${result.tokenCount}`)

for (const dropped of result.droppedSources) {
  console.log(`Dropped: ${dropped.id} (${dropped.metadata?.title})`)
}
```

---

## TypeScript

All types are exported from the package entry point:

```typescript
import type {
  RAGSource,
  RAGSourceMetadata,
  BuiltInTemplate,
  SourceFormat,
  OutputFormat,
  BuildPromptOptions,
  IncludedSource,
  BuiltPrompt,
  TemplateDefinition,
  Builder,
} from 'rag-prompt-builder'
```

### `RAGSource`

```typescript
interface RAGSource {
  content: string                // Required. The text content of the retrieved chunk.
  id?: string                    // Optional. Unique identifier for the source.
  tokens?: number                // Optional. Pre-computed token count.
  score?: number                 // Optional. Relevance score from the retriever.
  metadata?: RAGSourceMetadata   // Optional. Metadata fields for the source.
}
```

### `RAGSourceMetadata`

```typescript
interface RAGSourceMetadata {
  title?: string
  url?: string
  date?: string
  author?: string
  page?: number | string
  group?: string
  [k: string]: unknown           // Arbitrary additional fields
}
```

### `IncludedSource`

```typescript
interface IncludedSource {
  index: number                  // 1-based position in the formatted context
  id: string                     // Source ID (assigned or from RAGSource.id)
  tokens: number                 // Token count for this source
  truncated: boolean             // Whether the source was truncated to fit the budget
  metadata: RAGSourceMetadata    // Source metadata
}
```

### Type Aliases

```typescript
type BuiltInTemplate = 'qa' | 'summarize' | 'compare' | 'extract' | 'conversational' | 'cite'
type SourceFormat = 'numbered' | 'xml' | 'markdown' | 'json' | 'custom'
type OutputFormat = 'openai' | 'anthropic' | 'text'
```

---

## License

MIT
