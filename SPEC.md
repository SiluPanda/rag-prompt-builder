# rag-prompt-builder -- Specification

## 1. Overview

`rag-prompt-builder` is a prompt composition library for retrieval-augmented generation (RAG) pipelines. It takes an ordered array of retrieved source chunks -- the output of a retrieval or packing stage -- assembles them into a formatted context section, and constructs a complete LLM prompt using one of six built-in task templates (Q&A, summarization, comparison, extraction, conversational, cite-with-evidence). The result is a `BuiltPrompt` object containing the system message, a properly structured messages array in OpenAI or Anthropic format, the total token count, and a normalized sources manifest.

The gap this package fills is specific and well-defined. Every RAG tutorial, blog post, and open-source reference implementation contains a variant of the same function:

```javascript
function formatRAGContext(chunks) {
  return chunks
    .map((chunk, i) => `[${i + 1}] ${chunk.content}`)
    .join('\n\n');
}
```

This function gets copy-pasted across thousands of projects, extended in incompatible ways, and never published as a reusable primitive. The copies diverge immediately: some teams add source URLs, some add dates, some use XML tags, some number citations, some use markdown headers, some use JSON. There is no shared vocabulary for what "formatting RAG context" means, so every team invents their own representation. When the team changes models (from OpenAI to Anthropic), changes task (from Q&A to summarization), or wants to add source metadata to the citations, they must refactor a bespoke function that has become load-bearing infrastructure.

LangChain's `PromptTemplate` and `ChatPromptTemplate` are the most widely used alternatives, but they are tightly coupled to the LangChain framework, require `@langchain/core` as a peer dependency, and model prompts as template strings with variable interpolation rather than as composable semantic sections. They have no built-in concept of RAG context sections, token budgeting for the context block, source metadata injection, or citation formats. The Vercel AI SDK provides no prompt composition utilities at all -- only inference primitives. `@anthropic-ai/sdk` provides no prompt builder. OpenAI's SDK provides no prompt builder.

`rag-prompt-builder` is a standalone, zero-dependency package that solves exactly this problem. It provides six built-in templates covering the most common RAG task types, five source formatting styles (numbered, XML, markdown, JSON, custom), automatic injection of source metadata (title, URL, date, author, page number), token budget awareness so the context section fits within an allocated limit, and output in both OpenAI messages format and Anthropic messages format. The `buildPrompt(query, sources, options)` function is the single authoritative `formatRAGContext` replacement.

---

## 2. Goals and Non-Goals

### Goals

- Provide a `buildPrompt(query, sources, options?)` function that takes a user query and an array of source chunks and returns a `BuiltPrompt` object containing a fully assembled LLM prompt in the specified output format.
- Provide convenience shorthand functions -- `.qa()`, `.summarize()`, `.compare()`, `.extract()`, `.conversational()`, `.cite()` -- that call `buildPrompt` with the appropriate template pre-selected, for concise callsites.
- Provide a `createBuilder(config)` factory function that creates a configured builder instance with preset template, source format, and metadata options, for repeated use across many queries in the same application.
- Provide a `defineTemplate(name, template)` function for registering custom templates that are then available to `buildPrompt` and all convenience functions by name.
- Implement six built-in templates: `qa` (question answering), `summarize` (document summarization), `compare` (comparative analysis of multiple sources), `extract` (structured information extraction), `conversational` (multi-turn chat with context), and `cite` (answer with explicit numbered citations). Each template provides a system prompt, a context format, and query framing tuned for its task type.
- Implement five source formatting styles: `numbered` (citation markers like [1], [2]), `xml` (sources wrapped in `<source>` tags with attributes), `markdown` (sources as markdown sections with headings), `json` (sources as a JSON array embedded in the prompt), and `custom` (caller-supplied formatting function).
- Support automatic injection of source metadata into the formatted context: title, URL, date, author, and page number. Each metadata field is configurable -- show, hide, or format differently per field.
- Implement token budget awareness for the context section: given a total budget, compute and enforce a per-source token limit so the assembled context section does not overflow. When sources exceed the budget, truncate the least-relevant sources or truncate long sources at a sentence boundary.
- Return a `BuiltPrompt` object containing: the assembled `system` string, a `messages` array in the caller's chosen output format (OpenAI `{role, content}`, Anthropic `{role, content}`, or plain text), the total `tokenCount` for the assembled prompt, and a `sources` manifest listing each included source with its position and token count.
- Provide a CLI (`rag-prompt-builder`) that reads a query and sources JSON from stdin, assembles the prompt, and writes the `BuiltPrompt` to stdout.
- Support integration with `context-packer` (consuming `PackedChunk[]`), `context-budget` (consuming budget allocations), `chunk-smart` (consuming `Chunk[]`), and `rag-cite` (consuming citation references).
- Keep mandatory runtime dependencies at zero. All prompt assembly, metadata injection, token estimation, and formatting is implemented in pure JavaScript.
- Target Node.js 18 and above.

### Non-Goals

- **Not a retriever.** This package does not perform vector search, BM25 retrieval, reranking, or any other form of document retrieval. It receives pre-retrieved, pre-ordered sources and formats them. For retrieval, use a vector database SDK, `rerank-lite`, or `fusion-rank`.
- **Not a context packer.** This package does not select which chunks to include or enforce diversity. It formats the chunks it is given. For chunk selection, budget allocation, and ordering, use `context-packer`.
- **Not a budget allocator.** This package can enforce a token limit on the context section it assembles, but it does not allocate budgets across prompt sections (system, tools, RAG, conversation). For cross-section budget allocation, use `context-budget`.
- **Not an LLM client.** This package assembles a prompt but does not send it to any model. The caller passes the `BuiltPrompt.messages` to OpenAI, Anthropic, or any other provider SDK.
- **Not a tokenizer.** The package includes a rough approximate counter (characters divided by 4) as the default. For exact token counts, the caller provides a token counting function.
- **Not a citation verifier.** This package injects source metadata and citation instructions into the prompt. It does not verify that the model's response actually cites the provided sources, or check that citations are accurate. For citation verification, use `rag-cite`.
- **Not a conversation manager.** The `conversational` template supports prepending prior conversation turns to the messages array, but this package does not manage conversation state, session storage, or turn history. The caller provides the history.
- **Not a streaming assembler.** This package assembles prompts synchronously and completely. Streaming token-by-token assembly is out of scope.
- **Not a LangChain integration.** This package is framework-independent. It does not produce LangChain objects or depend on `@langchain/core`.

---

## 3. Target Users and Use Cases

### RAG Pipeline Builders

Developers building retrieval-augmented generation pipelines who have packed their chunks with `context-packer` and need to assemble a final prompt to send to a model. The standard integration is: `const prompt = buildPrompt(query, packedChunks.chunks, { template: 'qa' })`. The assembled `prompt.messages` goes directly to the model SDK.

### Application Developers Switching Models

Teams building applications that need to switch between OpenAI and Anthropic models -- or run prompts against multiple models for evaluation -- without rewriting their prompt construction logic. `rag-prompt-builder` produces either format from the same call: `buildPrompt(query, sources, { outputFormat: 'openai' })` or `buildPrompt(query, sources, { outputFormat: 'anthropic' })`.

### Teams Standardizing RAG Prompt Structure

Engineering teams that have multiple services independently implementing `formatRAGContext()` and want a single shared implementation. They configure a `createBuilder(config)` instance in a shared module, and each service calls `builder.qa(query, sources)` without needing to know the formatting details.

### Documentation and Knowledge Base Systems

Teams building documentation search, internal knowledge base Q&A, or customer support bots that retrieve chunks from company documentation. The `qa` template's system prompt is tuned for "answer from provided sources" behavior, and the `cite` template requires the model to include numbered citations in its response -- both patterns common in production knowledge base systems.

### Document Analysis and Summarization

Engineers building document summarization pipelines that retrieve the most relevant sections of a long document and synthesize them. The `summarize` template's system prompt directs the model to produce a structured summary from the provided sources, with appropriate framing for multi-source synthesis.

### Comparison and Research Tools

Products that retrieve information about two or more topics from a knowledge base and present a structured comparison. The `compare` template is designed for this: it formats sources grouped by entity or topic and instructs the model to produce a comparative analysis.

### Extraction Pipelines

Data engineering teams building structured information extraction from unstructured documents. The `extract` template instructs the model to extract specific fields from the provided sources according to a caller-defined schema, enabling structured output from RAG retrieval.

### Evaluation and Offline Testing

Engineers running offline evaluation of RAG pipeline quality. They use the CLI to assemble prompts from JSON-serialized sources, inspect the assembled prompt structure, count tokens, and verify that system prompt, context formatting, and query framing look correct before running live model evaluations.

---

## 4. Core Concepts

### Source

A source is a unit of retrieved text that the builder formats into the context section of the prompt. In `rag-prompt-builder`, a source is represented as a `RAGSource` object with a required `content` string, an optional `id` string, an optional `score` number (relevance score from the retriever), an optional `tokens` number (pre-computed token count), and an optional `metadata` record carrying title, URL, date, author, page, and any other fields the caller wants to inject into the formatted source header.

Sources arrive in the order determined by the upstream packing stage (`context-packer`) or retrieval stage. The builder does not reorder sources -- it formats them in the order it receives them.

### Template

A template defines the structure of the assembled prompt: a system prompt string, a context section format (how sources are grouped and labeled in the messages array), and a query framing string (how the user's question is presented to the model). The six built-in templates each embody a distinct task type. Custom templates can be defined and registered with `defineTemplate`.

### Context Section

The context section is the portion of the prompt that contains the formatted sources. It may appear as part of the system message (for models that support long system prompts), as a dedicated user message, or interleaved into the conversation history. The template determines where the context section appears; the source format determines how individual sources are rendered within it.

### Source Format

The source format controls how each individual source is rendered in the context section. Five formats are available: `numbered` (the most common copy-paste pattern, extended with metadata headers), `xml` (structured with attribute-rich `<source>` tags, common in Anthropic-style prompts), `markdown` (sources as `##` sections, good for readability), `json` (sources as a JSON array, good for extraction tasks), and `custom` (caller-supplied function). The source format is independent of the template -- any format can be combined with any template.

### Metadata Injection

Metadata injection controls which fields from `source.metadata` are rendered in the formatted source header. When a source carries a `title`, `url`, `date`, `author`, or `page` field, the builder can include it in the formatted output above the source content. Each field can be independently enabled, disabled, or given a custom label. Metadata injection is what separates `rag-prompt-builder` from the naive `[1] content` copy-paste pattern: it makes sources attributable, verifiable, and citable without any boilerplate in the application code.

### Token Budget

The token budget is the maximum number of tokens the assembled context section may consume. When the total token count of all sources exceeds the budget, the builder applies a budget enforcement strategy: either truncating the lowest-scoring sources from the tail (source truncation) or proportionally shortening all sources to fit (content truncation). The budget is typically provided by `context-budget`'s RAG section allocation or set manually. Token counting uses the same pluggable interface as `context-packer`.

### Built Prompt

The `BuiltPrompt` is the return value of `buildPrompt()`. It contains the assembled prompt in the caller's chosen output format, the total token count for the assembled prompt (system + context + query), and a sources manifest listing each source that was included (with its position, token count, and metadata). The `BuiltPrompt` is the boundary between prompt construction and model inference -- the caller passes it directly to the model SDK.

---

## 5. Built-In Templates

Each template is a complete specification of how to turn a query and a set of sources into a prompt for a specific task. Templates define: a system prompt, where the context section appears (in the system message or as a user message), and how the query is framed.

### 5.1 Template: `qa` (Question Answering)

**Purpose**: Answer a specific question using only the provided sources. The most common RAG task type.

**System prompt**:

```
You are a helpful assistant that answers questions based on the provided source documents.
Answer the question using only the information in the sources below. If the sources do not
contain enough information to answer the question, say so explicitly. Do not use prior
knowledge beyond what is provided.
```

**Context placement**: The formatted sources appear as a block in the user message, before the question.

**Query framing**:

```
Based on the sources above, please answer the following question:

{query}
```

**Messages structure (OpenAI format)**:

```json
[
  { "role": "system", "content": "<system prompt>" },
  { "role": "user",   "content": "<formatted sources>\n\n<query framing with question>" }
]
```

**When to use**: Single-turn Q&A against a knowledge base, documentation search, customer support bots. The explicit "only the information in the sources" instruction reduces hallucination compared to unrestricted generation.

**Behavioral notes**: The default system prompt can be replaced with a custom system string via the `systemPrompt` option. When `systemPrompt` is provided, it replaces the template's default system prompt entirely; the query framing and context placement are still applied.

---

### 5.2 Template: `summarize` (Summarization)

**Purpose**: Produce a structured synthesis of the provided sources. Used when the task is to distill content rather than answer a specific question.

**System prompt**:

```
You are an expert summarizer. You will be given a set of source documents. Your task is
to produce a clear, accurate summary that captures the key points from all provided
sources. Organize the summary logically. Attribute claims to sources when multiple
sources present different perspectives. Do not introduce information not present in
the sources.
```

**Context placement**: Formatted sources appear in the user message.

**Query framing**: The `query` parameter is used as the topic or focus instruction. If `query` is an empty string, the framing defaults to:

```
Please summarize the provided sources.
```

If `query` is non-empty, it is treated as a focus directive:

```
Please summarize the provided sources, focusing on: {query}
```

**Messages structure (OpenAI format)**:

```json
[
  { "role": "system", "content": "<system prompt>" },
  { "role": "user",   "content": "<formatted sources>\n\n<query framing>" }
]
```

**When to use**: Document summarization pipelines, executive summary generation, research synthesis from multiple retrieved documents. Works best with the `coverage` packing strategy in `context-packer`, which ensures the sources cover distinct sub-topics rather than repeating the same information.

---

### 5.3 Template: `compare` (Comparative Analysis)

**Purpose**: Analyze and compare multiple entities, options, or perspectives drawn from the provided sources.

**System prompt**:

```
You are an analytical assistant specializing in comparative analysis. You will be given
source documents describing multiple entities, options, or perspectives. Your task is to
produce a structured comparison that clearly identifies similarities, differences, and
trade-offs. Be precise, factual, and grounded in the provided sources.
```

**Context placement**: Formatted sources appear in the user message. When sources carry a `group` metadata field, the `compare` template renders sources grouped by their `group` value, with a group heading before each cluster. This allows the caller to pre-label sources as belonging to "Option A", "Option B", etc.

**Query framing**:

```
Using the sources above, compare and contrast the following: {query}
```

**Messages structure (OpenAI format)**:

```json
[
  { "role": "system", "content": "<system prompt>" },
  { "role": "user",   "content": "<formatted sources (grouped if metadata.group present)>\n\n<query framing>" }
]
```

**When to use**: Vendor comparison, technology evaluation, policy analysis, product feature comparison. Pass sources with `metadata.group` set to the entity name to enable automatic grouping ("OpenAI", "Anthropic", "Mistral").

**Source grouping**: When `source.metadata.group` is present on any source, the `compare` template switches to grouped rendering. Sources sharing a `group` value are rendered consecutively under a heading for that group. Sources without a `group` are placed in an "Other" group at the end.

---

### 5.4 Template: `extract` (Structured Extraction)

**Purpose**: Extract structured information from the provided sources according to a caller-defined schema.

**System prompt**:

```
You are a precise data extraction assistant. You will be given source documents and an
extraction schema. Your task is to extract the requested information from the sources and
return it in the specified format. Extract only what is explicitly present in the sources.
Use null for fields that are not found. Do not infer or guess values not stated in the sources.
```

**Context placement**: Formatted sources appear in the user message.

**Query framing**: The `query` parameter is the extraction instruction, typically including a schema or field list:

```
From the sources above, extract the following information:

{query}

Return the result as valid JSON.
```

**Messages structure (OpenAI format)**:

```json
[
  { "role": "system", "content": "<system prompt>" },
  { "role": "user",   "content": "<formatted sources>\n\n<extraction instruction>" }
]
```

**When to use**: Structured data extraction from documents, entity extraction (people, organizations, dates, prices), schema population from unstructured text. Pair with model function calling or JSON mode for guaranteed structured output.

**Schema integration**: The `extract` template accepts an optional `schema` option (a JSON Schema object or a TypeScript interface description string). When provided, the schema is appended to the query framing with instructions to follow it exactly.

---

### 5.5 Template: `conversational` (Multi-Turn Chat)

**Purpose**: Continue a multi-turn conversation with RAG context injected into each turn.

**System prompt**:

```
You are a helpful assistant with access to a set of reference documents. Answer questions
based on both the conversation history and the provided reference documents. If a question
can be answered from the conversation history, prefer that. If the reference documents
provide relevant information, incorporate it. Be concise and conversational.
```

**Context placement**: The formatted sources are injected as a system message supplement or as a prefixed block before the latest user message (configurable via `contextPlacement: 'system' | 'user'`, default `'user'`). Prior conversation turns are prepended to the messages array before the context block.

**Query framing**: The current user query appears as the final user message, unchanged. No framing prefix is added (unlike other templates) because the conversational register assumes the query is self-contained.

**Messages structure (OpenAI format, with history)**:

```json
[
  { "role": "system",    "content": "<system prompt>" },
  { "role": "user",      "content": "<prior user turn 1>" },
  { "role": "assistant", "content": "<prior assistant turn 1>" },
  { "role": "user",      "content": "<formatted sources>\n\n<current user query>" }
]
```

**When to use**: Chatbots and assistants that retrieve relevant context on each turn, customer support applications with session history, documentation assistants that remember prior questions.

**History parameter**: The `history` option accepts an array of `ConversationTurn` objects (`{ role: 'user' | 'assistant'; content: string }`). History turns are inserted after the system message and before the context block. Token counting includes history tokens toward the total `BuiltPrompt.tokenCount`. If `history` plus context exceeds the budget, context is reduced first (history is not truncated by the builder -- the caller is responsible for managing history length, e.g., using `context-budget`).

---

### 5.6 Template: `cite` (Answer with Citations)

**Purpose**: Answer a question while producing inline numbered citations that reference the provided sources.

**System prompt**:

```
You are a precise assistant that answers questions using provided sources and supports
every factual claim with a citation. When you use information from a source, cite it
inline using the source number in square brackets, e.g. [1] or [2, 3]. At the end of
your response, include a "References" section listing the cited sources by number.
Do not make claims that cannot be supported by the provided sources.
```

**Context placement**: Formatted sources appear in the user message with `numbered` format enforced (regardless of the `sourceFormat` option), so citation numbers in the model's response correspond to source numbers in the context.

**Query framing**:

```
Using the numbered sources above, answer the following question and cite your sources inline:

{query}
```

**Messages structure (OpenAI format)**:

```json
[
  { "role": "system", "content": "<system prompt>" },
  { "role": "user",   "content": "<numbered sources>\n\n<query framing with question>" }
]
```

**When to use**: Research assistants, legal and compliance tools, medical information systems -- any context where the model's answer must be traceable back to specific sources. The `numbered` format is mandatory for this template because the citation numbers in the instruction must correspond to the source numbers in the context.

**Citation format override**: The `citationStyle` option controls how citation numbers appear in the system prompt instruction. Options: `'bracket'` (default, `[1]`), `'paren'` (`(1)`), `'superscript'` (instruction says to use superscript notation `¹`). The instruction in the system prompt is updated accordingly.

---

## 6. Source Formatting

Source formatting controls how each individual source is rendered in the context section. The five built-in formats cover the range from minimal to fully structured. All formats include the source content. Metadata injection (title, URL, date, author, page) is applied on top of the chosen format when `metadata` fields are present and the corresponding metadata options are enabled.

### 6.1 Format: `numbered`

The default format. Sources are numbered sequentially starting from 1. Metadata fields appear as labeled lines below the citation number and above the content.

**With metadata disabled (minimal)**:

```
[1] The transformer architecture was introduced in "Attention Is All You Need" (Vaswani et al., 2017). It relies entirely on attention mechanisms, dispensing with recurrence and convolutions entirely.

[2] BERT (Bidirectional Encoder Representations from Transformers) pre-trains deep bidirectional representations from unlabeled text by jointly conditioning on both left and right context.
```

**With full metadata enabled**:

```
[1]
Title: Attention Is All You Need
URL: https://arxiv.org/abs/1706.03762
Date: 2017-06-12
Author: Vaswani et al.

The transformer architecture was introduced in "Attention Is All You Need"...

[2]
Title: BERT: Pre-training of Deep Bidirectional Transformers
URL: https://arxiv.org/abs/1810.04805
Date: 2018-10-11
Author: Devlin et al.

BERT (Bidirectional Encoder Representations from Transformers)...
```

**Configuration**:
- `numberPrefix`: string prefix before the number. Default `'['`. Use `'Source '` for `'Source 1:'` style.
- `numberSuffix`: string suffix after the number. Default `']'`.
- `separator`: string placed between sources. Default `'\n\n'`.

**When to use**: The most compatible format. Works with all templates. Required by the `cite` template (enforced automatically). Best for models fine-tuned on numbered citation patterns.

---

### 6.2 Format: `xml`

Sources are wrapped in `<source>` XML tags with metadata as attributes. This format is preferred for Anthropic Claude models, which are trained to parse XML-tagged context effectively. It is also the most parseable format for extraction tasks.

**With full metadata**:

```xml
<sources>
<source id="1" title="Attention Is All You Need" url="https://arxiv.org/abs/1706.03762" date="2017-06-12" author="Vaswani et al.">
The transformer architecture was introduced in "Attention Is All You Need"...
</source>
<source id="2" title="BERT: Pre-training of Deep Bidirectional Transformers" url="https://arxiv.org/abs/1810.04805" date="2018-10-11" author="Devlin et al.">
BERT (Bidirectional Encoder Representations from Transformers)...
</source>
</sources>
```

**Structural elements**:
- All sources are wrapped in a `<sources>` root element.
- Each source is a `<source>` element with `id` (1-indexed), and optional `title`, `url`, `date`, `author`, `page` attributes (present only when the corresponding metadata field exists and is enabled).
- Source content is the text content of the `<source>` element. Special XML characters in content are escaped (`&`, `<`, `>`, `"`, `'`).

**Configuration**:
- `rootElement`: name of the wrapping element. Default `'sources'`.
- `sourceElement`: name of each source element. Default `'source'`.
- `escapeContent`: whether to XML-escape source content. Default `true`. Set to `false` when content is already escaped or when injecting pre-formatted XML.

**When to use**: Anthropic Claude models. Any application where downstream parsing of the context section is needed (the XML structure is reliably parseable). Extraction tasks where the model needs to reference specific sources by tag.

---

### 6.3 Format: `markdown`

Sources are rendered as markdown sections with `##` headings. The heading is either the source title (if metadata.title is present) or `Source N`. This format produces the most human-readable output and works well when the assembled prompt will be displayed or logged.

**With full metadata**:

```markdown
## Source 1: Attention Is All You Need

**URL**: https://arxiv.org/abs/1706.03762
**Date**: 2017-06-12
**Author**: Vaswani et al.

The transformer architecture was introduced in "Attention Is All You Need"...

---

## Source 2: BERT: Pre-training of Deep Bidirectional Transformers

**URL**: https://arxiv.org/abs/1810.04805
**Date**: 2018-10-11
**Author**: Devlin et al.

BERT (Bidirectional Encoder Representations from Transformers)...
```

**Structural elements**:
- Each source is a `##` section. Heading format: `## Source {N}: {title}` when title is present, `## Source {N}` otherwise.
- Enabled metadata fields (URL, date, author, page) appear as bold-labeled lines below the heading.
- A horizontal rule (`---`) separates sources.

**Configuration**:
- `headingLevel`: markdown heading depth for source headings. Default `2` (`##`). Set to `3` (`###`) when the context section itself is under a `##` heading.
- `metadataStyle`: how metadata fields are rendered. `'bold-labels'` (default, `**URL**: value`), `'list'` (unordered list `- URL: value`), `'none'` (metadata in heading attributes only).

**When to use**: When prompt readability matters (human review, logging, evaluation). Works well with models that understand markdown structure. Not ideal for models that are confused by heavy markdown in the context.

---

### 6.4 Format: `json`

Sources are embedded as a JSON array string in the prompt. Each source is a JSON object with `id`, `content`, and any enabled metadata fields as top-level keys.

**Example output**:

```json
[
  {
    "id": 1,
    "title": "Attention Is All You Need",
    "url": "https://arxiv.org/abs/1706.03762",
    "date": "2017-06-12",
    "author": "Vaswani et al.",
    "content": "The transformer architecture was introduced..."
  },
  {
    "id": 2,
    "title": "BERT: Pre-training of Deep Bidirectional Transformers",
    "url": "https://arxiv.org/abs/1810.04805",
    "date": "2018-10-11",
    "author": "Devlin et al.",
    "content": "BERT (Bidirectional Encoder Representations from Transformers)..."
  }
]
```

**Configuration**:
- `prettyPrint`: whether to pretty-print the JSON. Default `true`.
- `contentKey`: key for the source content field. Default `'content'`.
- `idField`: key for the source ID field. Default `'id'`.

**When to use**: Extraction tasks where the model should reference sources by structured field. Models prompted to return JSON that references source IDs. Programmatic pipelines where the assembled prompt will be parsed by downstream tools.

---

### 6.5 Format: `custom`

The caller supplies a function that receives an array of `FormattedSource` objects (each carrying the source content, index, and resolved metadata) and returns a string. The returned string is inserted into the prompt as the context section verbatim.

```typescript
type CustomFormatFn = (sources: FormattedSource[]) => string;

interface FormattedSource {
  index: number;        // 1-based source number
  id: string;           // source ID (from RAGSource.id or auto-assigned)
  content: string;      // source content text
  tokens: number;       // source token count
  score?: number;       // source relevance score
  metadata: {
    title?: string;
    url?: string;
    date?: string;
    author?: string;
    page?: number | string;
    group?: string;
    [key: string]: unknown;
  };
}
```

**When to use**: Application-specific formats that none of the built-in styles cover. Domain-specific citation patterns (legal citation format, APA, MLA). Hybrid formats that combine multiple styles.

---

## 7. Metadata Injection

Metadata injection controls which metadata fields from each source are rendered in the formatted context. The five standard metadata fields are: `title`, `url`, `date`, `author`, and `page`. Each field is independently configurable.

### Standard Metadata Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `title` | `string` | Source document title | `"Attention Is All You Need"` |
| `url` | `string` | Source URL or file path | `"https://arxiv.org/abs/1706.03762"` |
| `date` | `string` | Publication or modification date (any string format) | `"2017-06-12"` |
| `author` | `string` | Author or authors | `"Vaswani et al."` |
| `page` | `number \| string` | Page number or range | `42` or `"42-45"` |

### Metadata Configuration

The `metadata` option is an object with a key for each field to configure:

```typescript
interface MetadataConfig {
  title?:  MetadataFieldConfig;
  url?:    MetadataFieldConfig;
  date?:   MetadataFieldConfig;
  author?: MetadataFieldConfig;
  page?:   MetadataFieldConfig;
}

interface MetadataFieldConfig {
  /** Whether to include this field in the formatted source. Default: true. */
  show?: boolean;
  /** Label to use for this field. Default: the field name capitalized (e.g., "Title"). */
  label?: string;
}
```

**Default behavior**: All metadata fields present on a source object are included with their capitalized field names as labels. Fields not present on the source are omitted.

**Disabling all metadata**:

```typescript
buildPrompt(query, sources, {
  metadata: {
    title:  { show: false },
    url:    { show: false },
    date:   { show: false },
    author: { show: false },
    page:   { show: false },
  },
});
```

Or equivalently, using the shorthand `showMetadata: false` top-level option.

**Custom labels**:

```typescript
buildPrompt(query, sources, {
  metadata: {
    url:    { label: 'Link' },
    date:   { label: 'Published' },
    author: { label: 'Written by' },
  },
});
```

### Custom Metadata Fields

Callers can pass arbitrary additional fields in `source.metadata`. These are not automatically rendered (to avoid injecting noise). To include a custom field, use the `customMetadataFields` option:

```typescript
buildPrompt(query, sources, {
  customMetadataFields: ['department', 'confidentiality'],
});
```

Custom fields are rendered with their key as the label (converted from camelCase or snake_case to Title Case).

### Metadata Token Cost

Metadata fields add tokens to the formatted source. When a token budget is set, the builder computes token counts for the metadata headers as part of the source token budget. Each metadata line contributes approximately 8-15 tokens (label + colon + value + newline). For sources with full five-field metadata, this overhead is roughly 60 tokens per source. When the budget is tight, consider disabling lower-priority metadata fields.

---

## 8. Token Budgeting

Token budgeting ensures the assembled context section fits within the token limit allocated to the RAG context block. This is distinct from the total prompt token count -- the budget applies only to the sources block.

### Budget Allocation

The `contextBudget` option sets the maximum token count for the assembled context section (all formatted sources combined, including metadata headers and separators). It does not include the system prompt, query framing, or conversation history in the count.

When `contextBudget` is set:

1. Each source's token count is computed (using `source.tokens` if pre-computed, otherwise the configured `tokenCounter`).
2. The total is compared against `contextBudget`.
3. If the total exceeds the budget, the configured `budgetStrategy` is applied.

### Budget Strategies

**`'truncate-tail'`** (default): Sources are included in order (preserving the upstream ordering from `context-packer`). Sources at the tail of the list are dropped entirely until the remaining sources fit within the budget. This strategy respects the upstream relevance ordering -- the most relevant sources (at the head) are always included.

```
Budget: 2000 tokens
Sources: [800, 700, 600, 500] tokens → total 2600

After truncate-tail:
  Include [800, 700, 600] = 2100 → still over
  Include [800, 700]      = 1500 → fits ✓
  Dropped: sources 3 and 4
```

**`'proportional'`**: Each source's content is proportionally shortened to fit the budget. All sources are included, but longer sources are truncated more aggressively than shorter ones. Truncation occurs at a sentence boundary (not mid-sentence). This strategy is useful when all sources are important and dropping any would be worse than having partial content.

```
Budget: 2000 tokens
Sources: [800, 700, 600, 500] tokens → total 2600
Ratio: 2000 / 2600 = 0.769

Each source is truncated to 76.9% of its original length:
  [800 → 615, 700 → 538, 600 → 461, 500 → 385] = 1999 tokens ✓
```

**`'truncate-longest'`**: The longest source is truncated first, then re-evaluated. Repeated until total fits. Produces a more balanced set of source lengths than truncate-tail. Useful when source lengths vary wildly and a single very long source should not crowd out all others.

**`'custom'`**: The caller supplies a `budgetFn` that receives the array of sources (with token counts) and the budget, and returns an array of `TruncatedSource` objects (sources with optionally shortened content). Full control over truncation logic.

### Integration with `context-packer`

When using `context-packer` with `chunkOverheadTokens` set, the overhead tokens account for the per-source metadata and separator tokens that `rag-prompt-builder` will add. This ensures the end-to-end token accounting is consistent:

```typescript
// In context-packer:
const result = pack(chunks, {
  budget: 4000,
  chunkOverheadTokens: 15,   // estimated tokens per source for metadata + separator
});

// In rag-prompt-builder:
const prompt = buildPrompt(query, result.chunks, {
  contextBudget: 4000,       // same budget; the overhead was already reserved
  template: 'qa',
});
```

### Built-In Approximate Counter

The default token counter is `Math.ceil(text.length / 4)`, matching the convention used by `context-packer` and `chunk-smart`. For production use with tight budgets, provide an exact counter via the `tokenCounter` option.

### Pre-Computed Token Counts

When `source.tokens` is set on a source (as it is for chunks from `context-packer`'s output), the builder uses that value without re-counting. This avoids duplicate token counting and ensures consistency with the upstream budget allocation.

---

## 9. API Surface

### Installation

```bash
npm install rag-prompt-builder
```

### Primary Export: `buildPrompt`

```typescript
import { buildPrompt } from 'rag-prompt-builder';

const prompt = buildPrompt(
  'What is the transformer attention mechanism?',
  retrievedSources,
  {
    template: 'qa',
    sourceFormat: 'numbered',
    outputFormat: 'openai',
  }
);

// Send to OpenAI
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: prompt.messages,
});
```

**Signature**:

```typescript
function buildPrompt(
  query: string,
  sources: RAGSource[],
  options?: BuildPromptOptions,
): BuiltPrompt;
```

The function is synchronous. All template application, source formatting, metadata injection, and token counting are performed in a single call. No I/O, no async operations.

---

### Convenience Template Functions

Each built-in template has a corresponding convenience function that calls `buildPrompt` with the template pre-selected. Additional options are passed through.

```typescript
import {
  qa,
  summarize,
  compare,
  extract,
  conversational,
  cite,
} from 'rag-prompt-builder';

// Q&A
const prompt = qa('What is BERT?', sources);

// Summarization
const prompt = summarize('', sources);  // empty query → "summarize all sources"
const prompt = summarize('key findings', sources);  // focused summary

// Comparison
const prompt = compare('Compare GPT-4 and Claude 3', sources);

// Extraction
const prompt = extract('Extract: name, date, location for each event', sources);

// Conversational
const prompt = conversational('What else can you tell me?', sources, {
  history: priorTurns,
});

// Cite
const prompt = cite('What evidence supports this claim?', sources);
```

**Signatures**:

```typescript
function qa(query: string, sources: RAGSource[], options?: Omit<BuildPromptOptions, 'template'>): BuiltPrompt;
function summarize(query: string, sources: RAGSource[], options?: Omit<BuildPromptOptions, 'template'>): BuiltPrompt;
function compare(query: string, sources: RAGSource[], options?: Omit<BuildPromptOptions, 'template'>): BuiltPrompt;
function extract(query: string, sources: RAGSource[], options?: Omit<BuildPromptOptions, 'template'>): BuiltPrompt;
function conversational(query: string, sources: RAGSource[], options?: Omit<BuildPromptOptions, 'template'>): BuiltPrompt;
function cite(query: string, sources: RAGSource[], options?: Omit<BuildPromptOptions, 'template'>): BuiltPrompt;
```

---

### Factory Export: `createBuilder`

Creates a configured builder instance with preset options, for repeated use across many queries.

```typescript
import { createBuilder } from 'rag-prompt-builder';

const builder = createBuilder({
  template: 'qa',
  sourceFormat: 'xml',
  outputFormat: 'anthropic',
  tokenCounter: myExactTokenCounter,
  metadata: {
    title: { show: true },
    url:   { show: true, label: 'Source' },
    date:  { show: false },
  },
});

// Reuse across many queries
const prompt1 = builder.buildPrompt(query1, sources1);
const prompt2 = builder.buildPrompt(query2, sources2);
const qaPrompt = builder.qa(query3, sources3);
```

**Signature**:

```typescript
function createBuilder(config: BuilderConfig): Builder;

interface Builder {
  buildPrompt(query: string, sources: RAGSource[], overrides?: Partial<BuildPromptOptions>): BuiltPrompt;
  qa(query: string, sources: RAGSource[], overrides?: Partial<BuildPromptOptions>): BuiltPrompt;
  summarize(query: string, sources: RAGSource[], overrides?: Partial<BuildPromptOptions>): BuiltPrompt;
  compare(query: string, sources: RAGSource[], overrides?: Partial<BuildPromptOptions>): BuiltPrompt;
  extract(query: string, sources: RAGSource[], overrides?: Partial<BuildPromptOptions>): BuiltPrompt;
  conversational(query: string, sources: RAGSource[], overrides?: Partial<BuildPromptOptions>): BuiltPrompt;
  cite(query: string, sources: RAGSource[], overrides?: Partial<BuildPromptOptions>): BuiltPrompt;
}
```

`createBuilder` validates the configuration at construction time. The returned `Builder` instance is reusable and stateless across calls.

---

### Template Registration: `defineTemplate`

Registers a custom template that is available to all subsequent `buildPrompt` calls by name.

```typescript
import { defineTemplate } from 'rag-prompt-builder';

defineTemplate('legal-brief', {
  systemPrompt: `You are a legal research assistant. You will be provided with case law
and statutory text. Analyze the sources and provide a legal analysis grounded in the
provided authorities. Cite sources using standard legal citation format.`,
  contextPlacement: 'user',
  queryFraming: 'Analyze the following legal question using the provided authorities:\n\n{query}',
  sourceFormat: 'numbered',    // default format for this template
  citationStyle: 'bracket',
});

// Now available by name
const prompt = buildPrompt(query, sources, { template: 'legal-brief' });
```

**Signature**:

```typescript
function defineTemplate(name: string, template: TemplateDefinition): void;
```

Registered templates are stored in a module-level registry. Templates registered with `defineTemplate` take precedence over built-in templates if the same name is used (though overriding built-in names is not recommended).

---

### TypeScript Type Definitions

```typescript
// ── Input Types ───────────────────────────────────────────────────────────

/** A retrieved source chunk to be formatted into the context section. */
interface RAGSource {
  /**
   * Unique identifier for this source. Used in BuiltPrompt.sources manifest.
   * If not provided, the builder assigns "source-{index}" (1-indexed).
   */
  id?: string;

  /** The text content of this source. Required. */
  content: string;

  /**
   * Pre-computed token count for this source's content.
   * If provided, the builder uses this value and skips counting.
   * If absent, the builder counts tokens using the configured tokenCounter.
   */
  tokens?: number;

  /**
   * Relevance score in [0, 1] from the upstream retriever/packer.
   * Used for budget enforcement (truncate-tail strategy drops lowest-scoring sources).
   * Present on chunks from context-packer's PackedChunk output.
   */
  score?: number;

  /** Source metadata for injection into the formatted context. */
  metadata?: RAGSourceMetadata;
}

/** Metadata fields that can be injected into the formatted source. */
interface RAGSourceMetadata {
  /** Document title. */
  title?: string;

  /** Source URL or file path. */
  url?: string;

  /** Publication or modification date (any string format). */
  date?: string;

  /** Author or authors string. */
  author?: string;

  /** Page number or range. */
  page?: number | string;

  /**
   * Grouping label for the 'compare' template's grouped rendering.
   * Sources sharing a group value are rendered consecutively under a group heading.
   */
  group?: string;

  /** Any other fields the caller wants to pass through. */
  [key: string]: unknown;
}

/** A prior conversation turn, for the 'conversational' template. */
interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

// ── Template Types ─────────────────────────────────────────────────────────

/** Built-in template identifiers. */
type BuiltInTemplate =
  | 'qa'             // Question answering from sources
  | 'summarize'      // Synthesis and summarization
  | 'compare'        // Comparative analysis
  | 'extract'        // Structured data extraction
  | 'conversational' // Multi-turn chat with RAG context
  | 'cite';          // Answer with numbered citations

/** Template identifier: built-in name or custom registered name. */
type TemplateName = BuiltInTemplate | string;

/** Definition for a custom template. */
interface TemplateDefinition {
  /**
   * The system prompt string for this template.
   * May include the placeholder {contextSection} to control where the context
   * section is injected within the system prompt itself.
   * If {contextSection} is absent and contextPlacement is 'system', the context
   * is appended after the system prompt.
   */
  systemPrompt: string;

  /**
   * Where the formatted sources block is placed in the messages array.
   * 'user': sources appear in the user message (default for most templates).
   * 'system': sources are appended to the system message.
   * Default: 'user'.
   */
  contextPlacement?: 'user' | 'system';

  /**
   * The framing string that introduces the user's query.
   * Must include the {query} placeholder.
   * Example: 'Based on the sources above, please answer:\n\n{query}'
   */
  queryFraming: string;

  /**
   * Default source format for this template.
   * Can be overridden per-call via BuildPromptOptions.sourceFormat.
   */
  sourceFormat?: SourceFormat;

  /**
   * Citation style for instruction text.
   * Only relevant for templates that include citation instructions.
   * Default: 'bracket'.
   */
  citationStyle?: CitationStyle;
}

// ── Source Format Types ────────────────────────────────────────────────────

/** Built-in source format identifiers. */
type BuiltInSourceFormat = 'numbered' | 'xml' | 'markdown' | 'json' | 'custom';

/** Source format identifier. */
type SourceFormat = BuiltInSourceFormat;

/** A source object passed to the custom format function. */
interface FormattedSource {
  index: number;
  id: string;
  content: string;
  tokens: number;
  score?: number;
  metadata: RAGSourceMetadata;
}

/** Custom format function type. */
type CustomFormatFn = (sources: FormattedSource[]) => string;

// ── Output Format Types ───────────────────────────────────────────────────

/** Target LLM message format. */
type OutputFormat = 'openai' | 'anthropic' | 'text';

/** A single message in OpenAI chat format. */
interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** A single message in Anthropic messages format. */
interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ── Options ────────────────────────────────────────────────────────────────

/** Options for buildPrompt() or createBuilder(). */
interface BuildPromptOptions {
  /**
   * Template to use for prompt construction.
   * Default: 'qa'.
   */
  template?: TemplateName;

  /**
   * Override the template's default system prompt.
   * When provided, replaces the template's system prompt entirely.
   * The query framing and context placement from the template are still applied.
   */
  systemPrompt?: string;

  /**
   * Source formatting style.
   * Default: template's default, or 'numbered' if the template has no default.
   */
  sourceFormat?: SourceFormat;

  /**
   * Custom format function. Required when sourceFormat is 'custom'.
   */
  customFormat?: CustomFormatFn;

  /**
   * Metadata field configuration.
   * Controls which metadata fields are rendered in each source's header.
   */
  metadata?: MetadataConfig;

  /**
   * Shorthand to disable all metadata rendering.
   * Equivalent to setting show: false on all metadata fields.
   * Default: false (metadata is shown when present).
   */
  showMetadata?: boolean;

  /**
   * Additional custom metadata field keys to render.
   * These are keys in source.metadata beyond the five standard fields.
   */
  customMetadataFields?: string[];

  /**
   * Output message format.
   * 'openai': returns OpenAIMessage[] (role: 'system' | 'user' | 'assistant').
   * 'anthropic': returns AnthropicMessage[] with system string separate.
   * 'text': returns a single concatenated string in BuiltPrompt.text.
   * Default: 'openai'.
   */
  outputFormat?: OutputFormat;

  /**
   * Maximum token count for the assembled context section.
   * When the total source tokens exceed this limit, budgetStrategy is applied.
   * Default: Infinity (no limit applied).
   */
  contextBudget?: number;

  /**
   * Budget enforcement strategy when sources exceed contextBudget.
   * Default: 'truncate-tail'.
   */
  budgetStrategy?: 'truncate-tail' | 'proportional' | 'truncate-longest' | 'custom';

  /**
   * Custom budget function. Required when budgetStrategy is 'custom'.
   */
  budgetFn?: (sources: FormattedSource[], budget: number) => FormattedSource[];

  /**
   * Token counting function. Receives a string and returns a token count.
   * Default: Math.ceil(text.length / 4).
   */
  tokenCounter?: (text: string) => number;

  /**
   * Prior conversation turns for the 'conversational' template.
   * Ignored for all other templates.
   */
  history?: ConversationTurn[];

  /**
   * Where the context section appears in the messages array.
   * Overrides the template's default contextPlacement.
   * 'user': context block prepended to the user message (most templates).
   * 'system': context block appended to the system message.
   */
  contextPlacement?: 'user' | 'system';

  /**
   * Citation style for templates that include citation instructions.
   * 'bracket': [1], [2] (default).
   * 'paren': (1), (2).
   * 'superscript': ¹, ² (instruction text only; actual rendering depends on model output).
   */
  citationStyle?: CitationStyle;

  /**
   * JSON Schema or schema description string for the 'extract' template.
   * When provided, appended to the query framing as a structured extraction target.
   */
  schema?: Record<string, unknown> | string;

  /**
   * Numbered source format configuration.
   */
  numberedFormat?: {
    numberPrefix?: string;   // Default: '['
    numberSuffix?: string;   // Default: ']'
    separator?: string;      // Default: '\n\n'
  };

  /**
   * XML source format configuration.
   */
  xmlFormat?: {
    rootElement?: string;    // Default: 'sources'
    sourceElement?: string;  // Default: 'source'
    escapeContent?: boolean; // Default: true
  };

  /**
   * Markdown source format configuration.
   */
  markdownFormat?: {
    headingLevel?: number;   // Default: 2
    metadataStyle?: 'bold-labels' | 'list' | 'none'; // Default: 'bold-labels'
  };

  /**
   * JSON source format configuration.
   */
  jsonFormat?: {
    prettyPrint?: boolean;   // Default: true
    contentKey?: string;     // Default: 'content'
    idField?: string;        // Default: 'id'
  };
}

/** Alias for full builder configuration (same shape as BuildPromptOptions). */
type BuilderConfig = BuildPromptOptions;

/** Metadata field configuration. */
interface MetadataConfig {
  title?:  MetadataFieldConfig;
  url?:    MetadataFieldConfig;
  date?:   MetadataFieldConfig;
  author?: MetadataFieldConfig;
  page?:   MetadataFieldConfig;
}

/** Configuration for a single metadata field. */
interface MetadataFieldConfig {
  show?: boolean;   // Default: true
  label?: string;   // Default: field name, Title Case
}

/** Citation style for numbered reference instructions. */
type CitationStyle = 'bracket' | 'paren' | 'superscript';

// ── Output Types ───────────────────────────────────────────────────────────

/** The assembled prompt returned by buildPrompt(). */
interface BuiltPrompt {
  /**
   * The system message content string.
   * Contains the template's system prompt (and, when contextPlacement is 'system',
   * the formatted sources block appended).
   */
  system: string;

  /**
   * The assembled messages array in the configured output format.
   * For 'openai' format: OpenAIMessage[] (includes the system message as role:'system').
   * For 'anthropic' format: AnthropicMessage[] (system is NOT included here; use
   *   BuiltPrompt.system as the Anthropic API's separate system parameter).
   * For 'text' format: [] (empty; use BuiltPrompt.text instead).
   */
  messages: OpenAIMessage[] | AnthropicMessage[];

  /**
   * For outputFormat 'text': the complete concatenated prompt as a single string.
   * For other formats: undefined.
   */
  text?: string;

  /**
   * Total estimated token count for the complete assembled prompt.
   * Includes: system prompt tokens + context section tokens + query framing tokens
   * + history tokens (if conversational template). Does NOT include the model's
   * response tokens.
   */
  tokenCount: number;

  /**
   * The template name used to build this prompt.
   * Useful for logging and debugging.
   */
  template: TemplateName;

  /**
   * The source format used to render the context section.
   */
  sourceFormat: SourceFormat;

  /**
   * Manifest of sources included in the context section.
   * In the same order as they appear in the formatted context.
   */
  sources: IncludedSource[];

  /**
   * Sources that were dropped due to budget enforcement.
   * Empty when contextBudget is not set or all sources fit.
   */
  droppedSources: DroppedSource[];

  /**
   * ISO 8601 timestamp of when buildPrompt() was called.
   */
  timestamp: string;
}

/** A source included in the assembled context section. */
interface IncludedSource {
  /** Position in the context section (1-indexed). */
  index: number;

  /** Source identifier. */
  id: string;

  /** Token count for this source (content + metadata header). */
  tokens: number;

  /**
   * True if this source's content was truncated to fit the context budget.
   * Only true when budgetStrategy is 'proportional' or 'truncate-longest'.
   */
  truncated: boolean;

  /**
   * Original token count before truncation, if truncated is true.
   */
  originalTokens?: number;

  /** The source's metadata as passed in. */
  metadata: RAGSourceMetadata;
}

/** A source dropped due to budget enforcement. */
interface DroppedSource {
  /** Source identifier. */
  id: string;

  /** Token count (that would have been used). */
  tokens: number;

  /** Reason: 'budget' (context budget exhausted). */
  reason: 'budget';

  /** The source's metadata as passed in. */
  metadata: RAGSourceMetadata;
}
```

---

## 10. Custom Templates

Custom templates allow application teams to define task-specific prompt structures that match their domain, style guide, or model fine-tuning, while reusing `rag-prompt-builder`'s source formatting, metadata injection, and token budgeting machinery.

### Defining a Custom Template

```typescript
import { defineTemplate, buildPrompt } from 'rag-prompt-builder';

defineTemplate('customer-support', {
  systemPrompt: `You are a customer support specialist for Acme Corp.
Answer customer questions using only the provided knowledge base articles.
Be friendly, concise, and empathetic. If the answer is not in the knowledge base,
say "I don't have information on that -- let me connect you with a specialist."
Do not speculate or provide information not in the articles.`,

  contextPlacement: 'user',

  queryFraming: `Knowledge base articles are provided above.

Customer question: {query}`,

  sourceFormat: 'numbered',
});

// Use the custom template
const prompt = buildPrompt(customerQuery, kbArticles, {
  template: 'customer-support',
  outputFormat: 'openai',
});
```

### Template Composition

Custom templates can build on built-in templates by starting with a built-in's `queryFraming` and `contextPlacement` and overriding only the `systemPrompt`:

```typescript
// A variation of 'qa' with a domain-specific system prompt
defineTemplate('medical-qa', {
  systemPrompt: `You are a medical information assistant. Answer questions based on
the provided clinical literature and guidelines. Always recommend consulting a healthcare
professional for personal medical decisions. Do not diagnose or prescribe.`,
  contextPlacement: 'user',
  queryFraming: 'Based on the clinical sources above, please answer:\n\n{query}',
  sourceFormat: 'numbered',
});
```

### Template Registry

Templates are registered in a module-level `Map<string, TemplateDefinition>` within `rag-prompt-builder`. All built-in templates are registered at module load time. `defineTemplate` adds to this map. The registry is shared across all builder instances in the same Node.js process.

For isolated registries (e.g., in tests or multi-tenant applications), use `createBuilder` with an inline `templateDefinition` option that provides a complete `TemplateDefinition` object rather than a registered name.

---

## 11. Output Formats

`rag-prompt-builder` supports three output formats controlled by the `outputFormat` option.

### OpenAI Format (`'openai'`)

The default output format. Produces a `messages` array compatible with the OpenAI chat completions API (`openai.chat.completions.create`). The system message is included as the first element with `role: 'system'`.

```typescript
const prompt = buildPrompt(query, sources, { outputFormat: 'openai' });

const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: prompt.messages,  // OpenAIMessage[]
});
```

Messages structure:
```json
[
  { "role": "system",    "content": "..." },
  { "role": "user",      "content": "...<sources>...\n\n<query framing>" }
]
```

For the `conversational` template with history:
```json
[
  { "role": "system",    "content": "..." },
  { "role": "user",      "content": "<prior user turn>" },
  { "role": "assistant", "content": "<prior assistant turn>" },
  { "role": "user",      "content": "<sources>\n\n<current query>" }
]
```

### Anthropic Format (`'anthropic'`)

Produces an `AnthropicMessage[]` array compatible with the Anthropic messages API (`anthropic.messages.create`). The system message is NOT included in the array -- it is exposed separately as `BuiltPrompt.system` and passed as the `system` parameter to the Anthropic API.

```typescript
const prompt = buildPrompt(query, sources, { outputFormat: 'anthropic' });

const response = await anthropic.messages.create({
  model: 'claude-opus-4-5',
  system: prompt.system,         // string, NOT in messages array
  messages: prompt.messages,     // AnthropicMessage[] with role: 'user' | 'assistant' only
  max_tokens: 1024,
});
```

Messages structure:
```json
[
  { "role": "user", "content": "<sources>\n\n<query framing>" }
]
```

For the `conversational` template with history, roles in `messages` alternate `user`/`assistant` as required by the Anthropic API.

### Plain Text Format (`'text'`)

Produces a single concatenated string in `BuiltPrompt.text`. Useful for models without a chat API, for logging, debugging, and inspection, and for passing to older completions-style APIs.

```typescript
const prompt = buildPrompt(query, sources, { outputFormat: 'text' });

console.log(prompt.text);
// SYSTEM: You are a helpful assistant...
//
// USER:
// [1] Source content...
//
// [2] Source content...
//
// Based on the sources above, please answer:
// What is the transformer attention mechanism?
```

The `messages` array is empty (`[]`) in text format. `BuiltPrompt.system` contains the system string as usual.

### Format and Context Placement Interaction

When `contextPlacement` is `'system'` (sources injected into the system message), the behavior across output formats is:

- **OpenAI**: The system message content is `systemPrompt + '\n\n' + formattedSources`. The user message contains only the query framing.
- **Anthropic**: The `system` string includes the sources. The messages array has only the user turn.
- **Text**: The SYSTEM section contains both the system prompt and sources.

---

## 12. Configuration Reference

All options with their defaults, types, and descriptions:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `template` | `TemplateName` | `'qa'` | Template for prompt structure. |
| `systemPrompt` | `string` | (template default) | Override the template's system prompt. |
| `sourceFormat` | `SourceFormat` | `'numbered'` | How sources are formatted in the context section. |
| `customFormat` | `CustomFormatFn` | (none) | Custom format function. Required when sourceFormat is `'custom'`. |
| `metadata` | `MetadataConfig` | (all fields shown) | Per-field metadata display configuration. |
| `showMetadata` | `boolean` | `true` | Shorthand to hide all metadata. Overridden by per-field `metadata` config. |
| `customMetadataFields` | `string[]` | `[]` | Additional custom metadata fields to render. |
| `outputFormat` | `OutputFormat` | `'openai'` | Target message format. |
| `contextBudget` | `number` | `Infinity` | Max tokens for the context section. |
| `budgetStrategy` | `string` | `'truncate-tail'` | Budget enforcement strategy. |
| `budgetFn` | `function` | (none) | Custom budget function. Required when budgetStrategy is `'custom'`. |
| `tokenCounter` | `function` | `(t) => Math.ceil(t.length / 4)` | Pluggable token counter. |
| `history` | `ConversationTurn[]` | `[]` | Prior turns for `conversational` template. |
| `contextPlacement` | `'user' \| 'system'` | (template default) | Where sources appear in the messages array. |
| `citationStyle` | `CitationStyle` | `'bracket'` | Citation marker style for `cite` template. |
| `schema` | `object \| string` | (none) | Extraction schema for `extract` template. |
| `numberedFormat.numberPrefix` | `string` | `'['` | Prefix before citation number. |
| `numberedFormat.numberSuffix` | `string` | `']'` | Suffix after citation number. |
| `numberedFormat.separator` | `string` | `'\n\n'` | Separator between numbered sources. |
| `xmlFormat.rootElement` | `string` | `'sources'` | XML root element name. |
| `xmlFormat.sourceElement` | `string` | `'source'` | XML source element name. |
| `xmlFormat.escapeContent` | `boolean` | `true` | XML-escape source content. |
| `markdownFormat.headingLevel` | `number` | `2` | Markdown heading depth (1-6). |
| `markdownFormat.metadataStyle` | `string` | `'bold-labels'` | Metadata rendering style in markdown. |
| `jsonFormat.prettyPrint` | `boolean` | `true` | Pretty-print JSON sources. |
| `jsonFormat.contentKey` | `string` | `'content'` | Key for source content in JSON. |
| `jsonFormat.idField` | `string` | `'id'` | Key for source ID in JSON. |

---

## 13. Integration

### With `context-packer`

`context-packer` selects, deduplicates, and orders chunks within a token budget. Its `PackedChunk[]` output is directly usable as `RAGSource[]` in `rag-prompt-builder`, since `PackedChunk` is a superset of `RAGSource` (it carries `content`, `id`, `score`, `tokens`, and `metadata`).

```typescript
import { pack } from 'context-packer';
import { buildPrompt } from 'rag-prompt-builder';

const packed = pack(retrievedChunks, {
  budget: 4000,
  strategy: 'mmr',
  ordering: 'u-shaped',
  chunkOverheadTokens: 12,  // reserve tokens for metadata + separator per source
});

const prompt = buildPrompt(userQuery, packed.chunks, {
  template: 'qa',
  sourceFormat: 'numbered',
  outputFormat: 'openai',
  contextBudget: 4000,  // matches the context-packer budget
});
```

The `chunkOverheadTokens` in `context-packer` and the `contextBudget` in `rag-prompt-builder` must be aligned. Set `chunkOverheadTokens` to the estimated tokens that the metadata header and separator will add per source, so the total assembled context section fits within `contextBudget` without triggering `rag-prompt-builder`'s budget enforcement.

### With `context-budget`

`context-budget` allocates token budgets across prompt sections. The RAG section's budget goes to `context-packer` for chunk selection and also to `rag-prompt-builder` as the `contextBudget`:

```typescript
import { createBudget } from 'context-budget';
import { pack } from 'context-packer';
import { buildPrompt } from 'rag-prompt-builder';

const budget = createBudget({ model: 'gpt-4o', outputReservation: 2048 });
const allocation = budget.allocate({
  system: 600,
  rag: Infinity,
  conversation: conversationTokens,
  currentMessage: queryTokens,
});

const packed = pack(chunks, { budget: allocation.sections.rag });
const prompt = buildPrompt(query, packed.chunks, {
  contextBudget: allocation.sections.rag,
  template: 'qa',
});
```

### With `chunk-smart`

`chunk-smart` produces `Chunk[]` from raw documents. After retrieval at query time, these chunks are passed to `rag-prompt-builder` directly. The heading context from `chunk-smart`'s metadata can be injected as a custom metadata field:

```typescript
import { chunk } from 'chunk-smart';
import { buildPrompt } from 'rag-prompt-builder';

const chunks = chunk(documentText);
const retrieved = await search(query, chunks);

const sources = retrieved.map(c => ({
  id: c.metadata.index.toString(),
  content: c.content,
  tokens: c.metadata.tokenCount,
  metadata: {
    title: c.metadata.headings.at(-1),  // innermost heading as title
    url: c.metadata.custom?.sourceUrl,
  },
}));

const prompt = buildPrompt(query, sources, { template: 'qa' });
```

### With `rag-cite`

`rag-cite` verifies that the model's response cites sources correctly. After building the prompt with the `cite` template and receiving the model's response, pass the response and the `BuiltPrompt.sources` manifest to `rag-cite` for citation verification:

```typescript
import { cite } from 'rag-prompt-builder';
import { verifyCitations } from 'rag-cite';

const prompt = cite(query, sources);
const response = await model.complete(prompt.messages);

const citationReport = verifyCitations(response.content, prompt.sources);
```

### With `prompt-optimize`

`prompt-optimize` analyzes prompt token usage and suggests optimizations. Pass the `BuiltPrompt` for analysis:

```typescript
import { buildPrompt } from 'rag-prompt-builder';
import { analyzePrompt } from 'prompt-optimize';

const prompt = buildPrompt(query, sources, { template: 'qa' });
const analysis = analyzePrompt(prompt);
// analysis.recommendations: ["Consider 'xml' format to reduce metadata token cost by ~15%"]
```

---

## 14. CLI

### Installation and Invocation

```bash
# Global install
npm install -g rag-prompt-builder
rag-prompt-builder --template qa --format openai < input.json

# npx (no install)
npx rag-prompt-builder --template qa < input.json

# As a pipeline stage
context-packer --budget 4000 < chunks.json | rag-prompt-builder --template qa
```

### Input Format

The CLI reads a JSON object from stdin with a `query` string and a `sources` array:

```json
{
  "query": "What is the transformer attention mechanism?",
  "sources": [
    {
      "id": "source-1",
      "content": "The attention mechanism allows the model to...",
      "tokens": 87,
      "score": 0.92,
      "metadata": {
        "title": "Attention Is All You Need",
        "url": "https://arxiv.org/abs/1706.03762",
        "date": "2017-06-12"
      }
    }
  ]
}
```

Alternatively, accepts a `chunks` array (from `context-packer` output format):

```bash
# Pipe from context-packer
context-packer --budget 4000 < scored_chunks.json | \
  jq '{ query: "What is attention?", sources: .chunks }' | \
  rag-prompt-builder --template qa
```

### Output Format

By default, writes the `BuiltPrompt` JSON object to stdout:

```json
{
  "system": "You are a helpful assistant...",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user",   "content": "[1]\nTitle: ...\n\nThe attention mechanism...\n\nBased on the sources above, please answer:\n\nWhat is the transformer attention mechanism?" }
  ],
  "tokenCount": 347,
  "template": "qa",
  "sourceFormat": "numbered",
  "sources": [
    { "index": 1, "id": "source-1", "tokens": 102, "truncated": false, "metadata": { "title": "..." } }
  ],
  "droppedSources": [],
  "timestamp": "2026-03-18T10:00:00.000Z"
}
```

With `--messages-only`, writes only the messages array to stdout (suitable for piping to a model client).

### Flags

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--template` | `-t` | string | `qa` | Template: qa, summarize, compare, extract, conversational, cite, or custom name. |
| `--source-format` | `-f` | string | `numbered` | Source format: numbered, xml, markdown, json. |
| `--output-format` | `-o` | string | `openai` | Output message format: openai, anthropic, text. |
| `--context-budget` | `-b` | number | (none) | Max tokens for context section. |
| `--budget-strategy` | | string | `truncate-tail` | Budget strategy: truncate-tail, proportional, truncate-longest. |
| `--no-metadata` | | boolean | false | Disable all metadata injection. |
| `--system-prompt` | | string | (template default) | Override system prompt (file path or inline string). |
| `--messages-only` | | boolean | false | Output only the messages array. |
| `--pretty` | `-p` | boolean | false | Pretty-print JSON output. |
| `--version` | | boolean | | Print version and exit. |
| `--help` | `-h` | boolean | | Print help and exit. |

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Prompt assembled successfully. |
| `1` | Input error. Invalid JSON, missing query or sources field. |
| `2` | Configuration error. Invalid flag values, unknown template name, custom format required but not provided. |

### CLI Examples

```bash
# Basic Q&A prompt from a JSON file
rag-prompt-builder --template qa < query_and_sources.json

# Summarization with Anthropic format
rag-prompt-builder --template summarize --output-format anthropic < input.json

# Extract messages only and send to model via curl
rag-prompt-builder --messages-only --pretty < input.json | \
  jq '{ model: "gpt-4o", messages: . }' | \
  curl -s -X POST https://api.openai.com/v1/chat/completions \
    -H "Authorization: Bearer $OPENAI_API_KEY" \
    -H "Content-Type: application/json" \
    -d @-

# Cite template with context budget
rag-prompt-builder --template cite --context-budget 3000 --source-format numbered < input.json

# Pipeline: context-packer → rag-prompt-builder
echo '{ "query": "What is attention?", "sources": [] }' | \
  jq --slurpfile packed packed_chunks.json '.sources = $packed[0].chunks' | \
  rag-prompt-builder --template qa --output-format openai --pretty
```

---

## 15. Error Handling

### `PromptBuilderError`

A `PromptBuilderError` is thrown when configuration is invalid or the input cannot be processed. It extends `Error` with a `code` field.

```typescript
class PromptBuilderError extends Error {
  readonly code: PromptBuilderErrorCode;
  readonly details?: Record<string, unknown>;
}

type PromptBuilderErrorCode =
  | 'UNKNOWN_TEMPLATE'          // Template name not in built-in or custom registry
  | 'MISSING_CUSTOM_FORMAT'     // sourceFormat='custom' but no customFormat provided
  | 'MISSING_BUDGET_FN'         // budgetStrategy='custom' but no budgetFn provided
  | 'INVALID_CONTEXT_BUDGET'    // contextBudget <= 0 or not finite
  | 'INVALID_SOURCES'           // sources is not an array or entries missing required fields
  | 'EMPTY_QUERY'               // query is empty string and template requires a query
  | 'SCHEMA_REQUIRED'           // extract template called without a query or schema
  | 'HISTORY_NOT_SUPPORTED'     // history provided to a non-conversational template
  | 'NO_SOURCES_FIT'            // All sources exceed contextBudget individually
```

### Empty Sources

When `sources` is an empty array, `buildPrompt` returns a valid `BuiltPrompt` with the context section replaced by a configurable placeholder string (default: `"No sources provided."`). This allows the application to call `buildPrompt` without special-casing empty results. The `noSourcesPlaceholder` option controls the placeholder text.

### All Sources Exceed Budget

When every individual source exceeds `contextBudget` (the budget is too small even for one source), a `PromptBuilderError` with code `'NO_SOURCES_FIT'` is thrown. The error `details` include the smallest source's token count and the configured budget.

---

## 16. Testing Strategy

### Unit Tests

**Template tests**: For each of the six built-in templates, verify:
- The system prompt string matches the template specification exactly.
- The query framing includes `{query}` replaced with the actual query.
- Context placement is correct: sources appear in the user message for `qa`, `summarize`, `compare`, `extract`, `cite`; history turns are placed correctly for `conversational`.
- `systemPrompt` override replaces the template's system prompt but preserves query framing and context placement.

**Source format tests**: For each format (`numbered`, `xml`, `markdown`, `json`):
- A single source with no metadata produces the minimal formatted output.
- A source with all five standard metadata fields produces a formatted header with all fields.
- Multiple sources are concatenated with the correct separator.
- All metadata fields can be independently disabled.
- Custom labels are applied correctly.
- For `xml`: special characters in content are XML-escaped.
- For `json`: output is valid JSON (`JSON.parse` succeeds).
- For `markdown`: heading level option is respected.

**Metadata injection tests**:
- `showMetadata: false` hides all metadata fields.
- Per-field `show: false` hides individual fields.
- Custom `label` values are used in output.
- Fields absent from `source.metadata` are not rendered.
- `customMetadataFields` causes custom fields to be rendered.

**Token budget tests**:
- `truncate-tail`: sources exceeding budget are dropped from the tail. Verify `droppedSources` in the output.
- `proportional`: all sources included but truncated proportionally. Verify total token count <= budget.
- `truncate-longest`: the longest source is truncated first. Verify the resulting token distribution.
- Pre-computed `source.tokens` is used without re-counting.
- `contextBudget: Infinity` (default) includes all sources with no truncation.

**Output format tests**:
- `openai`: system message is the first element with `role: 'system'`. User message contains sources and query framing.
- `anthropic`: `messages` array contains no system message. `BuiltPrompt.system` is populated.
- `text`: `BuiltPrompt.text` is a non-empty string. `messages` is `[]`.
- Anthropic format with `conversational` template: `messages` alternates `user`/`assistant`.

**`BuiltPrompt` fields tests**:
- `tokenCount` equals the sum of system prompt tokens + context section tokens + query framing tokens.
- `sources` manifest lists every included source with correct `index`, `id`, and `tokens`.
- `droppedSources` lists every dropped source when budget enforcement is active.
- `template` field matches the template used.
- `timestamp` is a valid ISO 8601 string.

### Template-Specific Tests

- **`compare` template**: sources with `metadata.group` are rendered in grouped format. Sources without a group are placed in "Other". A single group produces no group heading.
- **`extract` template**: `schema` option appends schema to query framing. JSON mode instruction is included.
- **`conversational` template**: history turns appear in messages array between system message and current user turn. History tokens are included in `tokenCount`. Empty history produces same output as non-conversational templates.
- **`cite` template**: `sourceFormat` is overridden to `'numbered'` regardless of the option value passed. System prompt includes citation instructions. Citation style option is reflected in the system prompt instruction.

### Custom Template Tests

- `defineTemplate` registers a template by name.
- Registered template is accessible by name in `buildPrompt`.
- `TemplateDefinition` fields (`systemPrompt`, `contextPlacement`, `queryFraming`, `sourceFormat`) all take effect.
- Overriding a custom template name with a second `defineTemplate` call replaces the first.
- `UNKNOWN_TEMPLATE` error is thrown for unregistered names.

### Integration Tests

End-to-end tests verifying the full pipeline:
- `buildPrompt` with `PackedChunk[]` from `context-packer` (real packing run) produces a valid `BuiltPrompt`.
- `buildPrompt` with `Chunk[]` from `chunk-smart` (mapped to `RAGSource`) produces a valid `BuiltPrompt`.
- `createBuilder` with config; overrides on `buildPrompt` take precedence over factory config.
- `buildPrompt` with empty sources produces a prompt with `noSourcesPlaceholder` in the context section.
- `buildPrompt` with `contextBudget` smaller than the total source tokens invokes the budget strategy.

### CLI Tests

Spawning the CLI process and verifying stdout/stderr/exit code:
- `--template qa < valid_input.json` produces valid `BuiltPrompt` JSON on stdout, exit 0.
- `--output-format anthropic` produces `messages` with no system role, exit 0.
- Invalid JSON input produces error message on stderr, exit 1.
- Unknown `--template xyz` produces error message on stderr, exit 2.
- `--messages-only` produces a JSON array, not a full `BuiltPrompt` object.

### Edge Case Tests

- Query is an empty string (handled by `summarize` template; throws `EMPTY_QUERY` for `qa`, `compare`, `extract`, `cite`).
- Sources array is empty (returns prompt with placeholder, no error).
- Single source with no metadata (no metadata header rendered).
- Source content containing XML special characters with `xml` format.
- Source content containing markdown headings with `markdown` format (no structural interference).
- Very long source content (1000+ tokens) with `proportional` budget strategy (truncated at sentence boundary).
- Unicode content: CJK characters, emoji, RTL text -- verify content is preserved intact through all formatting paths.
- All five metadata fields present on all sources -- verify no rendering artifacts.
- `conversational` template with empty history array (produces same structure as single-turn).
- History that causes the messages array to exceed typical API limits (builder includes all history; documentation warns that history management is the caller's responsibility).

### Test Framework

Tests use Vitest, matching the project's existing configuration.

---

## 17. Performance

### Design Constraints

`rag-prompt-builder` runs on every query in a live RAG pipeline. A typical call processes 5-20 sources with 50-500 tokens each. The assembled prompt is sent to a model within milliseconds of assembly. The target is sub-millisecond assembly for typical inputs.

### Performance Targets

| Input | Sources | Content Size | Expected Time |
|-------|---------|-------------|---------------|
| Minimal (no metadata) | 5 | 100 tokens each | < 0.1ms |
| Typical Q&A | 10 | 300 tokens each | < 0.5ms |
| Large context | 20 | 500 tokens each | < 1ms |
| All metadata, all fields | 20 | 500 tokens each | < 2ms |
| Budget enforcement, proportional | 20 | 500 tokens each | < 2ms |

Benchmarks measured on Node.js 22, Apple M3, using the default approximate token counter.

### Optimization Strategy

**No redundant string concatenation**: Source formatting uses `Array.join` and template literals rather than `+=` loops. For JSON format, `JSON.stringify` is called once on the assembled array.

**Pre-computed token counts**: When `source.tokens` is set (as it is for chunks from `context-packer`), token counting is skipped entirely. For the typical integration (`context-packer` → `rag-prompt-builder`), zero token counting calls are made in the builder.

**Lazy metadata rendering**: Metadata headers are built only when at least one metadata field is present and enabled. The check is O(1) per source (test `source.metadata` for non-null and at least one enabled field).

**No regex in hot path**: Source formatting uses string template literals and `Array.join`, not regex substitution.

---

## 18. Dependencies

### Runtime Dependencies

None. The package is implemented using pure JavaScript with no runtime npm dependencies. All functionality -- template management, source formatting, metadata injection, token counting, budget enforcement, output format assembly, and CLI argument parsing -- is implemented using Node.js built-in APIs.

### Development Dependencies

```json
{
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.6.0",
    "@types/node": "^20.0.0",
    "eslint": "^9.0.0"
  }
}
```

### Peer Dependencies

None. Callers may optionally use `tiktoken`, `gpt-tokenizer`, or `@anthropic-ai/sdk` for exact token counting, but none of these are required or depended upon by the package.

### Why Zero Dependencies

`rag-prompt-builder` is a string assembly library. Its core operations -- template string interpolation, array joining, JSON serialization, XML escaping -- are all native JavaScript operations. External dependencies would add installation weight, supply chain risk, and version compatibility concerns without providing capabilities that are not already available in Node.js built-ins.

---

## 19. File Structure

```
rag-prompt-builder/
├── src/
│   ├── index.ts               # Public API: exports buildPrompt, qa, summarize, compare,
│   │                          #   extract, conversational, cite, createBuilder,
│   │                          #   defineTemplate, PromptBuilderError, and all types
│   ├── types.ts               # All TypeScript interfaces and type aliases
│   ├── build-prompt.ts        # Core buildPrompt() function orchestration
│   ├── factory.ts             # createBuilder() factory function
│   ├── registry.ts            # Template registry: built-in templates + defineTemplate()
│   ├── templates/
│   │   ├── index.ts           # Template dispatcher (looks up template by name)
│   │   ├── qa.ts              # Q&A template definition
│   │   ├── summarize.ts       # Summarization template definition
│   │   ├── compare.ts         # Comparison template definition (with group handling)
│   │   ├── extract.ts         # Extraction template definition (with schema injection)
│   │   ├── conversational.ts  # Conversational template definition (with history)
│   │   └── cite.ts            # Citation template definition
│   ├── formats/
│   │   ├── index.ts           # Format dispatcher (selects formatter by name)
│   │   ├── numbered.ts        # Numbered [1], [2] format
│   │   ├── xml.ts             # XML <source> tag format
│   │   ├── markdown.ts        # Markdown ## heading format
│   │   └── json.ts            # JSON array format
│   ├── metadata.ts            # Metadata field rendering (inject into formatted source)
│   ├── budget.ts              # Budget enforcement strategies
│   ├── token-counter.ts       # Default approximate counter + pluggable interface
│   ├── output.ts              # Output format assembly (OpenAI, Anthropic, text)
│   ├── errors.ts              # PromptBuilderError class and error codes
│   └── cli.ts                 # CLI entry point: arg parsing, stdin/stdout
├── src/__tests__/
│   ├── build-prompt.test.ts   # Integration tests for buildPrompt()
│   ├── templates/
│   │   ├── qa.test.ts         # Q&A template tests
│   │   ├── summarize.test.ts  # Summarization template tests
│   │   ├── compare.test.ts    # Comparison template tests (incl. group rendering)
│   │   ├── extract.test.ts    # Extraction template tests (incl. schema injection)
│   │   ├── conversational.test.ts  # Conversational template tests (incl. history)
│   │   └── cite.test.ts       # Citation template tests
│   ├── formats/
│   │   ├── numbered.test.ts   # Numbered format tests
│   │   ├── xml.test.ts        # XML format tests (incl. escaping)
│   │   ├── markdown.test.ts   # Markdown format tests
│   │   └── json.test.ts       # JSON format tests
│   ├── metadata.test.ts       # Metadata injection tests
│   ├── budget.test.ts         # Budget enforcement strategy tests
│   ├── output.test.ts         # Output format tests (OpenAI, Anthropic, text)
│   ├── factory.test.ts        # createBuilder() tests
│   ├── registry.test.ts       # defineTemplate() tests
│   ├── errors.test.ts         # Error condition tests
│   └── cli.test.ts            # CLI integration tests (spawn process)
├── package.json
├── tsconfig.json
├── SPEC.md
└── README.md
```

---

## 20. Implementation Roadmap

### Phase 1: Core Infrastructure (v0.1.0)

Implement the types, error handling, token counting, metadata rendering, and output format assembly.

1. **Types**: Define all TypeScript types in `types.ts` -- `RAGSource`, `RAGSourceMetadata`, `BuildPromptOptions`, `BuiltPrompt`, `IncludedSource`, `DroppedSource`, `TemplateDefinition`, `FormattedSource`, `ConversationTurn`, and all union types.
2. **Errors**: Implement `PromptBuilderError` and `PromptBuilderErrorCode` in `errors.ts`.
3. **Token counter**: Implement the approximate counter and pluggable interface in `token-counter.ts`.
4. **Metadata rendering**: Implement per-field metadata rendering (show/hide, custom labels) in `metadata.ts`. Write unit tests.
5. **Output assembly**: Implement OpenAI, Anthropic, and text output format assembly in `output.ts`. Write tests for all three formats.

### Phase 2: Source Formats (v0.2.0)

Implement all five source formatting modes.

6. **Numbered format**: Implement `[N]` citation format with metadata header in `formats/numbered.ts`. Write tests.
7. **XML format**: Implement `<source>` tag format with attribute rendering and content escaping in `formats/xml.ts`. Write tests including XML escaping edge cases.
8. **Markdown format**: Implement `##` heading format with configurable heading level and metadata style in `formats/markdown.ts`. Write tests.
9. **JSON format**: Implement JSON array format with configurable field names in `formats/json.ts`. Write tests verifying valid JSON output.
10. **Format dispatcher**: Implement the format dispatcher in `formats/index.ts`, routing to the correct formatter by `sourceFormat` option.

### Phase 3: Templates (v0.3.0)

Implement all six built-in templates and the template registry.

11. **Template registry**: Implement the module-level registry and `defineTemplate()` in `registry.ts`. Write tests for registration and lookup.
12. **`qa` template**: Implement in `templates/qa.ts`. Write tests.
13. **`summarize` template**: Implement in `templates/summarize.ts`. Write tests for empty query and focus query cases.
14. **`compare` template**: Implement in `templates/compare.ts`, including `metadata.group`-based source grouping. Write tests.
15. **`extract` template**: Implement in `templates/extract.ts`, including schema injection into query framing. Write tests.
16. **`conversational` template**: Implement in `templates/conversational.ts`, including history insertion into messages array. Write tests for empty history and multi-turn history.
17. **`cite` template**: Implement in `templates/cite.ts`, including enforced `numbered` format and citation style options. Write tests.
18. **Template dispatcher**: Implement in `templates/index.ts`.

### Phase 4: Budget Enforcement (v0.4.0)

19. **Budget enforcement**: Implement all three built-in strategies (`truncate-tail`, `proportional`, `truncate-longest`) and the custom strategy hook in `budget.ts`. Write tests for each strategy, including the edge case where no sources fit.
20. **Budget integration**: Wire budget enforcement into `buildPrompt.ts`, populating `droppedSources` in the output.

### Phase 5: Core API (v1.0.0)

21. **`buildPrompt()` function**: Implement in `build-prompt.ts`: validate inputs, look up template, apply source format, inject metadata, enforce budget, assemble output, compute token count, construct `BuiltPrompt`. Write integration tests covering all template/format/output combinations.
22. **Convenience functions**: Implement `qa()`, `summarize()`, `compare()`, `extract()`, `conversational()`, `cite()` as thin wrappers in `index.ts`.
23. **`createBuilder()` factory**: Implement in `factory.ts` with option merging (per-call overrides > factory config > built-in defaults). Write tests.
24. **Public exports**: Wire all exports from `index.ts`.

### Phase 6: CLI (v1.1.0)

25. **CLI**: Implement argument parsing, stdin reading, `buildPrompt` invocation, and stdout writing in `cli.ts`. Support `--messages-only` and `--pretty` flags. Write CLI tests (spawn process, pipe JSON, verify stdout/exit code).
26. **Register CLI binary** in `package.json` under `bin`.

### Phase 7: Polish and Validation (v1.2.0)

27. **Edge case hardening**: Unicode content, empty sources, very large sources, all-metadata-disabled, extreme token budgets.
28. **Performance benchmarks**: Verify sub-millisecond targets. Optimize if any scenario misses.
29. **Documentation**: Comprehensive README with usage examples for every template and format combination.

---

## 21. Example Use Cases

### 21.1 Q&A Chatbot with Knowledge Base

A customer support chatbot retrieves relevant knowledge base articles for each user message and builds a Q&A prompt.

```typescript
import { pack } from 'context-packer';
import { qa } from 'rag-prompt-builder';
import OpenAI from 'openai';

const openai = new OpenAI();

async function handleSupportQuery(userMessage: string) {
  // Retrieve from knowledge base
  const results = await knowledgeBase.search(userMessage, { topK: 20 });

  // Pack into context budget
  const packed = pack(results, {
    budget: 3000,
    strategy: 'mmr',
    ordering: 'u-shaped',
    chunkOverheadTokens: 15,
  });

  // Build Q&A prompt
  const prompt = qa(userMessage, packed.chunks, {
    sourceFormat: 'numbered',
    outputFormat: 'openai',
    metadata: {
      title: { show: true },
      url:   { show: true, label: 'Article' },
      date:  { show: false },
    },
  });

  // Send to model
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: prompt.messages,
    max_tokens: 512,
  });

  return {
    answer: response.choices[0].message.content,
    sourcesUsed: prompt.sources.length,
    tokenCount: prompt.tokenCount,
  };
}
```

---

### 21.2 Document Summarizer with Source Attribution

A research tool summarizes multiple retrieved documents and attributes key points to specific sources.

```typescript
import { createBuilder } from 'rag-prompt-builder';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

// Configure builder once for the application
const builder = createBuilder({
  template: 'summarize',
  sourceFormat: 'xml',         // Claude handles XML context well
  outputFormat: 'anthropic',
  metadata: {
    title:  { show: true },
    url:    { show: true },
    date:   { show: true, label: 'Published' },
    author: { show: true },
  },
  contextBudget: 6000,
  budgetStrategy: 'truncate-tail',
});

async function summarizeResearchResults(topic: string, retrievedChunks: RAGSource[]) {
  const prompt = builder.summarize(topic, retrievedChunks);

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    system: prompt.system,       // system string separate for Anthropic API
    messages: prompt.messages,
    max_tokens: 2048,
  });

  return {
    summary: response.content[0].type === 'text' ? response.content[0].text : '',
    sourcesConsulted: prompt.sources.map(s => s.metadata.title).filter(Boolean),
    sourcesDropped: prompt.droppedSources.length,
    totalTokens: prompt.tokenCount,
  };
}
```

---

### 21.3 Multi-Source Comparison Tool

A technology evaluation tool retrieves documentation for multiple products and builds a structured comparison.

```typescript
import { compare } from 'rag-prompt-builder';
import { encode } from 'gpt-tokenizer';

// Sources retrieved per product, then merged with group labels
const sources: RAGSource[] = [
  ...openAISources.map(s => ({ ...s, metadata: { ...s.metadata, group: 'OpenAI' } })),
  ...anthropicSources.map(s => ({ ...s, metadata: { ...s.metadata, group: 'Anthropic' } })),
  ...mistraiSources.map(s => ({ ...s, metadata: { ...s.metadata, group: 'Mistral' } })),
];

const prompt = compare(
  'Compare the context window sizes, pricing models, and API features of these LLM providers',
  sources,
  {
    sourceFormat: 'markdown',
    outputFormat: 'openai',
    tokenCounter: (text) => encode(text).length,
    contextBudget: 8000,
    metadata: {
      title: { show: true },
      url:   { show: true },
      date:  { show: true },
    },
  }
);

// prompt.messages contains sources grouped by "OpenAI", "Anthropic", "Mistral"
// under the compare template's system prompt for comparative analysis
```

---

### 21.4 Structured Extraction Pipeline

A data engineering pipeline extracts structured event data from unstructured news articles.

```typescript
import { extract, defineTemplate } from 'rag-prompt-builder';

const eventSchema = {
  type: 'object',
  properties: {
    eventName:    { type: 'string' },
    date:         { type: 'string', format: 'date' },
    location:     { type: 'string' },
    participants: { type: 'array', items: { type: 'string' } },
    outcome:      { type: 'string', nullable: true },
  },
  required: ['eventName', 'date', 'location'],
};

async function extractEvents(articleChunks: RAGSource[]) {
  const prompt = extract(
    'Extract all events from the provided articles.',
    articleChunks,
    {
      schema: eventSchema,
      sourceFormat: 'json',        // JSON format helps model reason about structured extraction
      outputFormat: 'openai',
      showMetadata: false,         // metadata not useful for extraction task
    }
  );

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: prompt.messages,
    response_format: { type: 'json_object' },
    max_tokens: 2048,
  });

  return JSON.parse(response.choices[0].message.content ?? '{}');
}
```

---

### 21.5 Multi-Turn Conversational Assistant

An AI assistant maintains conversation history and retrieves fresh context on every turn.

```typescript
import { createBuilder } from 'rag-prompt-builder';

const builder = createBuilder({
  template: 'conversational',
  sourceFormat: 'numbered',
  outputFormat: 'openai',
  contextBudget: 4000,
  metadata: {
    title: { show: true },
    url:   { show: false },
    date:  { show: false },
  },
});

// Conversation session state
const history: ConversationTurn[] = [];

async function chat(userMessage: string) {
  // Retrieve context relevant to this turn
  const retrieved = await vectorDB.search(userMessage, { topK: 10 });

  // Build prompt with conversation history
  const prompt = builder.conversational(userMessage, retrieved, {
    history,
  });

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: prompt.messages,
    max_tokens: 512,
  });

  const assistantReply = response.choices[0].message.content ?? '';

  // Update history for next turn
  history.push({ role: 'user',      content: userMessage });
  history.push({ role: 'assistant', content: assistantReply });

  // Keep history bounded (caller's responsibility)
  if (history.length > 20) history.splice(0, 2);

  return assistantReply;
}
```

---

### 21.6 CLI Offline Evaluation

An engineer inspects assembled prompts during RAG pipeline evaluation without running live model inference.

```bash
# Retrieve and pack chunks using other pipeline tools, save to file
context-packer --budget 4000 --strategy mmr < retrieved_chunks.json > packed.json

# Assemble the Q&A prompt and inspect its structure
jq '{ query: "What is the transformer attention mechanism?", sources: .chunks }' packed.json | \
  rag-prompt-builder --template qa --source-format numbered --pretty > prompt.json

# Check token count
jq '.tokenCount' prompt.json

# Inspect the user message (context + query)
jq '.messages[] | select(.role == "user") | .content' prompt.json

# Count sources included vs. dropped
jq '{ included: (.sources | length), dropped: (.droppedSources | length) }' prompt.json

# Try Anthropic format for the same input
jq '{ query: "What is the transformer attention mechanism?", sources: .chunks }' packed.json | \
  rag-prompt-builder --template qa --output-format anthropic --pretty

# Compare token counts across formats
for fmt in numbered xml markdown json; do
  echo -n "$fmt: "
  jq '{ query: "What is attention?", sources: .chunks }' packed.json | \
    rag-prompt-builder --source-format "$fmt" | jq '.tokenCount'
done
```
