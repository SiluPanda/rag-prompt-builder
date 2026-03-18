# rag-prompt-builder — Tasks

## Phase 1: Core Infrastructure

### 1.1 Project Scaffolding

- [ ] **Install dev dependencies** — Add `typescript`, `vitest`, `@types/node`, and `eslint` to `devDependencies` in `package.json`. Run `npm install`. | Status: not_done
- [ ] **Configure vitest** — Add a `vitest.config.ts` (or verify `vitest` works with the existing `tsconfig.json`). Ensure `npm run test` discovers and runs tests from `src/__tests__/`. | Status: not_done
- [ ] **Configure eslint** — Set up an ESLint config file compatible with ESLint 9+ and TypeScript. Ensure `npm run lint` passes on an empty project. | Status: not_done
- [ ] **Create directory structure** — Create all directories specified in the spec: `src/templates/`, `src/formats/`, `src/__tests__/`, `src/__tests__/templates/`, `src/__tests__/formats/`. | Status: not_done

### 1.2 TypeScript Type Definitions (`src/types.ts`)

- [ ] **Define `RAGSource` interface** — Required `content: string`; optional `id?: string`, `tokens?: number`, `score?: number`, `metadata?: RAGSourceMetadata`. | Status: not_done
- [ ] **Define `RAGSourceMetadata` interface** — Optional fields: `title?: string`, `url?: string`, `date?: string`, `author?: string`, `page?: number | string`, `group?: string`, plus index signature `[key: string]: unknown`. | Status: not_done
- [ ] **Define `ConversationTurn` interface** — `role: 'user' | 'assistant'`, `content: string`. | Status: not_done
- [ ] **Define `BuiltInTemplate` type** — Union: `'qa' | 'summarize' | 'compare' | 'extract' | 'conversational' | 'cite'`. | Status: not_done
- [ ] **Define `TemplateName` type** — `BuiltInTemplate | string`. | Status: not_done
- [ ] **Define `TemplateDefinition` interface** — `systemPrompt: string`, `contextPlacement?: 'user' | 'system'`, `queryFraming: string`, `sourceFormat?: SourceFormat`, `citationStyle?: CitationStyle`. | Status: not_done
- [ ] **Define `BuiltInSourceFormat` and `SourceFormat` types** — `'numbered' | 'xml' | 'markdown' | 'json' | 'custom'`. | Status: not_done
- [ ] **Define `FormattedSource` interface** — `index: number`, `id: string`, `content: string`, `tokens: number`, `score?: number`, `metadata: RAGSourceMetadata`. | Status: not_done
- [ ] **Define `CustomFormatFn` type** — `(sources: FormattedSource[]) => string`. | Status: not_done
- [ ] **Define `OutputFormat` type** — `'openai' | 'anthropic' | 'text'`. | Status: not_done
- [ ] **Define `OpenAIMessage` interface** — `role: 'system' | 'user' | 'assistant'`, `content: string`. | Status: not_done
- [ ] **Define `AnthropicMessage` interface** — `role: 'user' | 'assistant'`, `content: string`. | Status: not_done
- [ ] **Define `MetadataConfig` interface** — Optional keys `title`, `url`, `date`, `author`, `page`, each typed `MetadataFieldConfig`. | Status: not_done
- [ ] **Define `MetadataFieldConfig` interface** — `show?: boolean` (default true), `label?: string`. | Status: not_done
- [ ] **Define `CitationStyle` type** — `'bracket' | 'paren' | 'superscript'`. | Status: not_done
- [ ] **Define `BuildPromptOptions` interface** — All options from spec section 9: `template`, `systemPrompt`, `sourceFormat`, `customFormat`, `metadata`, `showMetadata`, `customMetadataFields`, `outputFormat`, `contextBudget`, `budgetStrategy`, `budgetFn`, `tokenCounter`, `history`, `contextPlacement`, `citationStyle`, `schema`, `numberedFormat`, `xmlFormat`, `markdownFormat`, `jsonFormat`. Include JSDoc on each field. | Status: not_done
- [ ] **Define `BuilderConfig` type alias** — `BuildPromptOptions`. | Status: not_done
- [ ] **Define `BuiltPrompt` interface** — `system: string`, `messages: OpenAIMessage[] | AnthropicMessage[]`, `text?: string`, `tokenCount: number`, `template: TemplateName`, `sourceFormat: SourceFormat`, `sources: IncludedSource[]`, `droppedSources: DroppedSource[]`, `timestamp: string`. | Status: not_done
- [ ] **Define `IncludedSource` interface** — `index: number`, `id: string`, `tokens: number`, `truncated: boolean`, `originalTokens?: number`, `metadata: RAGSourceMetadata`. | Status: not_done
- [ ] **Define `DroppedSource` interface** — `id: string`, `tokens: number`, `reason: 'budget'`, `metadata: RAGSourceMetadata`. | Status: not_done
- [ ] **Define `Builder` interface** — Methods: `buildPrompt(query, sources, overrides?)`, `qa(...)`, `summarize(...)`, `compare(...)`, `extract(...)`, `conversational(...)`, `cite(...)`. Each returns `BuiltPrompt`. | Status: not_done

### 1.3 Error Handling (`src/errors.ts`)

- [ ] **Implement `PromptBuilderError` class** — Extends `Error` with `readonly code: PromptBuilderErrorCode` and `readonly details?: Record<string, unknown>`. | Status: not_done
- [ ] **Define `PromptBuilderErrorCode` type** — Union of: `'UNKNOWN_TEMPLATE'`, `'MISSING_CUSTOM_FORMAT'`, `'MISSING_BUDGET_FN'`, `'INVALID_CONTEXT_BUDGET'`, `'INVALID_SOURCES'`, `'EMPTY_QUERY'`, `'SCHEMA_REQUIRED'`, `'HISTORY_NOT_SUPPORTED'`, `'NO_SOURCES_FIT'`. | Status: not_done
- [ ] **Write tests for `PromptBuilderError`** — (`src/__tests__/errors.test.ts`) Verify error code is accessible, message is set, details are optional, and `instanceof Error` holds. | Status: not_done

### 1.4 Token Counter (`src/token-counter.ts`)

- [ ] **Implement default approximate token counter** — `Math.ceil(text.length / 4)`. Export as a named function. | Status: not_done
- [ ] **Implement `countTokens` helper** — Accept a string and an optional `tokenCounter` function. Use the provided function if given, otherwise fall back to the default approximate counter. | Status: not_done
- [ ] **Handle pre-computed `source.tokens`** — When `source.tokens` is set, use that value without calling the counter function. Document this behavior. | Status: not_done

### 1.5 Metadata Rendering (`src/metadata.ts`)

- [ ] **Implement metadata field rendering** — Given a `RAGSourceMetadata`, a `MetadataConfig`, `showMetadata` flag, and `customMetadataFields` list, produce an array of rendered metadata lines (e.g., `"Title: Attention Is All You Need"`). | Status: not_done
- [ ] **Respect `show: false` per field** — When a specific field's `show` is `false`, omit it from output. | Status: not_done
- [ ] **Respect `showMetadata: false` shorthand** — When the top-level `showMetadata` is `false`, omit all metadata regardless of per-field config. | Status: not_done
- [ ] **Apply custom labels** — When `label` is set on a field config, use it instead of the default capitalized field name. | Status: not_done
- [ ] **Omit absent fields** — Fields not present on the source's metadata are never rendered, regardless of config. | Status: not_done
- [ ] **Render custom metadata fields** — When `customMetadataFields` includes a key, render it with its key converted from camelCase/snake_case to Title Case. | Status: not_done
- [ ] **Write metadata rendering tests** — (`src/__tests__/metadata.test.ts`) Cover: all fields shown, all hidden, per-field hide, custom labels, absent fields not rendered, custom metadata fields rendered, `showMetadata: false` shorthand. | Status: not_done

### 1.6 Output Format Assembly (`src/output.ts`)

- [ ] **Implement OpenAI format assembly** — Given system string, user content, and optional history, produce `OpenAIMessage[]` with system message as first element (`role: 'system'`), history turns, then user message. | Status: not_done
- [ ] **Implement Anthropic format assembly** — Given system string, user content, and optional history, produce `AnthropicMessage[]` (no system role). System string returned separately via `BuiltPrompt.system`. Roles must alternate `user`/`assistant`. | Status: not_done
- [ ] **Implement text format assembly** — Concatenate all parts into a single string with `SYSTEM:` / `USER:` / `ASSISTANT:` section markers. Populate `BuiltPrompt.text`. Messages array is `[]`. | Status: not_done
- [ ] **Handle `contextPlacement: 'system'`** — When context is placed in the system message, append formatted sources to the system string. User message contains only query framing. | Status: not_done
- [ ] **Handle `contextPlacement: 'user'`** — When context is placed in the user message, prepend formatted sources to the user message before the query framing. | Status: not_done
- [ ] **Write output format tests** — (`src/__tests__/output.test.ts`) Cover: OpenAI format structure, Anthropic format (no system in messages), text format (single string), context placement in system vs. user, conversational with history for both OpenAI and Anthropic formats. | Status: not_done

---

## Phase 2: Source Formats

### 2.1 Numbered Format (`src/formats/numbered.ts`)

- [ ] **Implement numbered source formatting** — Render each source as `[N] content` (1-indexed). When metadata is present and enabled, render metadata lines between the citation marker and content. | Status: not_done
- [ ] **Support `numberPrefix` and `numberSuffix` config** — Default `'['` and `']'`. Allow customization (e.g., `'Source '` + `':'`). | Status: not_done
- [ ] **Support `separator` config** — Default `'\n\n'` between sources. | Status: not_done
- [ ] **Integrate metadata rendering** — Call metadata renderer to produce header lines for each source. Insert between citation marker and content. | Status: not_done
- [ ] **Write numbered format tests** — (`src/__tests__/formats/numbered.test.ts`) Cover: single source no metadata, single source full metadata, multiple sources, custom prefix/suffix, custom separator. | Status: not_done

### 2.2 XML Format (`src/formats/xml.ts`)

- [ ] **Implement XML source formatting** — Wrap all sources in `<sources>` root, each source in `<source>` with `id` attribute (1-indexed) and metadata as attributes. Content is the text content of the element. | Status: not_done
- [ ] **Implement XML content escaping** — Escape `&`, `<`, `>`, `"`, `'` in source content. Controlled by `escapeContent` option (default `true`). | Status: not_done
- [ ] **Support `rootElement` config** — Default `'sources'`. | Status: not_done
- [ ] **Support `sourceElement` config** — Default `'source'`. | Status: not_done
- [ ] **Support `escapeContent` config** — Default `true`. When `false`, content is inserted verbatim. | Status: not_done
- [ ] **Render metadata as XML attributes** — Only include enabled metadata fields that are present on the source. | Status: not_done
- [ ] **Write XML format tests** — (`src/__tests__/formats/xml.test.ts`) Cover: single source, full metadata as attributes, content escaping (special chars), `escapeContent: false`, custom root/source element names, multiple sources. | Status: not_done

### 2.3 Markdown Format (`src/formats/markdown.ts`)

- [ ] **Implement markdown source formatting** — Each source as a `##` section. Heading: `## Source {N}: {title}` when title present, else `## Source {N}`. Metadata fields as bold-labeled lines below heading. Content below metadata. Sources separated by `---`. | Status: not_done
- [ ] **Support `headingLevel` config** — Default `2` (`##`). Allow 1-6. | Status: not_done
- [ ] **Support `metadataStyle` config** — `'bold-labels'` (default): `**URL**: value`. `'list'`: `- URL: value`. `'none'`: no metadata lines. | Status: not_done
- [ ] **Write markdown format tests** — (`src/__tests__/formats/markdown.test.ts`) Cover: single source no metadata, full metadata with bold-labels, list style, none style, custom heading level, multiple sources separated by `---`, title in heading. | Status: not_done

### 2.4 JSON Format (`src/formats/json.ts`)

- [ ] **Implement JSON source formatting** — Produce a JSON array string. Each source is an object with `id`, enabled metadata fields, and `content` as top-level keys. | Status: not_done
- [ ] **Support `prettyPrint` config** — Default `true`. When `false`, produce minified JSON. | Status: not_done
- [ ] **Support `contentKey` config** — Default `'content'`. Customize the key for source content. | Status: not_done
- [ ] **Support `idField` config** — Default `'id'`. Customize the key for source ID. | Status: not_done
- [ ] **Write JSON format tests** — (`src/__tests__/formats/json.test.ts`) Cover: single source, multiple sources, pretty vs. minified, custom keys, verify output is valid JSON (`JSON.parse` succeeds), metadata fields included. | Status: not_done

### 2.5 Custom Format

- [ ] **Implement custom format dispatch** — When `sourceFormat` is `'custom'`, call the user-provided `customFormat` function with an array of `FormattedSource` objects. Return the string verbatim as the context section. | Status: not_done
- [ ] **Throw `MISSING_CUSTOM_FORMAT` error** — When `sourceFormat` is `'custom'` but no `customFormat` function is provided, throw a `PromptBuilderError`. | Status: not_done

### 2.6 Format Dispatcher (`src/formats/index.ts`)

- [ ] **Implement format dispatcher** — Given a `SourceFormat` value, route to the correct formatter (numbered, xml, markdown, json, custom). | Status: not_done
- [ ] **Pass format-specific options** — Forward `numberedFormat`, `xmlFormat`, `markdownFormat`, `jsonFormat` options to the respective formatter. | Status: not_done

---

## Phase 3: Templates

### 3.1 Template Registry (`src/registry.ts`)

- [ ] **Implement module-level template registry** — A `Map<string, TemplateDefinition>` that stores all registered templates. Pre-populate with the six built-in templates at module load time. | Status: not_done
- [ ] **Implement `defineTemplate(name, template)` function** — Adds or overwrites a template in the registry. Validates that `systemPrompt` and `queryFraming` are non-empty strings. | Status: not_done
- [ ] **Implement `getTemplate(name)` lookup** — Returns the `TemplateDefinition` for a given name. Throws `UNKNOWN_TEMPLATE` error if not found. | Status: not_done
- [ ] **Write registry tests** — (`src/__tests__/registry.test.ts`) Cover: all six built-in templates are present, `defineTemplate` adds a new template, registered template is retrievable, overwriting a template replaces it, unknown name throws `UNKNOWN_TEMPLATE`. | Status: not_done

### 3.2 QA Template (`src/templates/qa.ts`)

- [ ] **Define QA template** — System prompt as specified in spec section 5.1. Context placement: `'user'`. Query framing: `"Based on the sources above, please answer the following question:\n\n{query}"`. Default source format: `'numbered'`. | Status: not_done
- [ ] **Write QA template tests** — (`src/__tests__/templates/qa.test.ts`) Verify system prompt text, query framing with `{query}` replaced, context in user message, `systemPrompt` override replaces default but preserves framing. | Status: not_done

### 3.3 Summarize Template (`src/templates/summarize.ts`)

- [ ] **Define summarize template** — System prompt as specified in spec section 5.2. Context placement: `'user'`. Query framing: when query is empty, `"Please summarize the provided sources."`; when non-empty, `"Please summarize the provided sources, focusing on: {query}"`. | Status: not_done
- [ ] **Handle empty query** — The summarize template does NOT throw `EMPTY_QUERY` for empty queries. It uses the default framing instead. | Status: not_done
- [ ] **Write summarize template tests** — (`src/__tests__/templates/summarize.test.ts`) Verify system prompt, empty query produces default framing, non-empty query uses focus framing. | Status: not_done

### 3.4 Compare Template (`src/templates/compare.ts`)

- [ ] **Define compare template** — System prompt as specified in spec section 5.3. Context placement: `'user'`. Query framing: `"Using the sources above, compare and contrast the following: {query}"`. | Status: not_done
- [ ] **Implement source grouping** — When any source has `metadata.group`, switch to grouped rendering: sources sharing a `group` value are rendered consecutively under a group heading. Sources without a `group` go in an "Other" group at the end. | Status: not_done
- [ ] **Single group behavior** — When only one group exists (or no groups), skip the group heading. | Status: not_done
- [ ] **Write compare template tests** — (`src/__tests__/templates/compare.test.ts`) Verify system prompt, query framing, grouped rendering with multiple groups, "Other" group for ungrouped sources, single group skips heading. | Status: not_done

### 3.5 Extract Template (`src/templates/extract.ts`)

- [ ] **Define extract template** — System prompt as specified in spec section 5.4. Context placement: `'user'`. Query framing: `"From the sources above, extract the following information:\n\n{query}\n\nReturn the result as valid JSON."`. | Status: not_done
- [ ] **Implement schema injection** — When `schema` option is provided (JSON Schema object or string), append it to the query framing with instructions to follow the schema exactly. | Status: not_done
- [ ] **Write extract template tests** — (`src/__tests__/templates/extract.test.ts`) Verify system prompt, query framing, schema injection (object and string), JSON return instruction present. | Status: not_done

### 3.6 Conversational Template (`src/templates/conversational.ts`)

- [ ] **Define conversational template** — System prompt as specified in spec section 5.5. Context placement: `'user'` (configurable). Query framing: the query appears as the final user message unchanged (no framing prefix). | Status: not_done
- [ ] **Implement history insertion** — Insert `ConversationTurn[]` entries after the system message and before the context/query message. | Status: not_done
- [ ] **History token counting** — Include history tokens in the total `BuiltPrompt.tokenCount`. | Status: not_done
- [ ] **Budget interaction with history** — When history + context exceeds budget, reduce context first. History is never truncated by the builder. | Status: not_done
- [ ] **Throw `HISTORY_NOT_SUPPORTED`** — When `history` is provided to any template other than `conversational`, throw a `PromptBuilderError`. | Status: not_done
- [ ] **Write conversational template tests** — (`src/__tests__/templates/conversational.test.ts`) Verify system prompt, query with no framing, history turns in messages, empty history same as single-turn, history tokens in count, `HISTORY_NOT_SUPPORTED` error for non-conversational templates. | Status: not_done

### 3.7 Cite Template (`src/templates/cite.ts`)

- [ ] **Define cite template** — System prompt as specified in spec section 5.6. Context placement: `'user'`. Query framing: `"Using the numbered sources above, answer the following question and cite your sources inline:\n\n{query}"`. | Status: not_done
- [ ] **Enforce numbered format** — The `cite` template overrides `sourceFormat` to `'numbered'` regardless of the option passed by the caller. | Status: not_done
- [ ] **Implement citation style support** — `citationStyle` option controls how citation markers appear in the system prompt instruction: `'bracket'` (default, `[1]`), `'paren'` (`(1)`), `'superscript'` (uses `^1` notation). | Status: not_done
- [ ] **Write cite template tests** — (`src/__tests__/templates/cite.test.ts`) Verify system prompt, enforced numbered format, citation styles (bracket, paren, superscript) reflected in system prompt text. | Status: not_done

### 3.8 Template Dispatcher (`src/templates/index.ts`)

- [ ] **Implement template dispatcher** — Given a template name, look up the `TemplateDefinition` from the registry and apply it (return system prompt, query framing, context placement). | Status: not_done

---

## Phase 4: Budget Enforcement

### 4.1 Budget Strategies (`src/budget.ts`)

- [ ] **Implement `truncate-tail` strategy** — Include sources in order from head. Drop sources from the tail until the remaining sources fit within `contextBudget`. Dropped sources go to `droppedSources`. | Status: not_done
- [ ] **Implement `proportional` strategy** — Proportionally shorten all sources to fit within `contextBudget`. Truncate at sentence boundaries (not mid-sentence). All sources are included. | Status: not_done
- [ ] **Implement `truncate-longest` strategy** — Truncate the longest source first, re-evaluate. Repeat until total fits within budget. Produces more balanced source lengths. | Status: not_done
- [ ] **Implement `custom` strategy dispatch** — When `budgetStrategy` is `'custom'`, call the user-provided `budgetFn` with the sources array and budget. Return the result. | Status: not_done
- [ ] **Throw `MISSING_BUDGET_FN`** — When `budgetStrategy` is `'custom'` but no `budgetFn` is provided. | Status: not_done
- [ ] **Throw `INVALID_CONTEXT_BUDGET`** — When `contextBudget` is <= 0 or not finite. | Status: not_done
- [ ] **Throw `NO_SOURCES_FIT`** — When every individual source exceeds the budget (no single source fits). Include smallest source token count and budget in error details. | Status: not_done
- [ ] **Sentence boundary truncation** — When truncating source content (proportional and truncate-longest strategies), find the last sentence boundary that fits within the token limit. | Status: not_done
- [ ] **Write budget enforcement tests** — (`src/__tests__/budget.test.ts`) Cover: truncate-tail drops tail sources, proportional shortens all sources, truncate-longest shortens longest first, custom strategy called with correct args, `MISSING_BUDGET_FN` error, `INVALID_CONTEXT_BUDGET` error, `NO_SOURCES_FIT` error, Infinity budget includes all, pre-computed `source.tokens` used. | Status: not_done

---

## Phase 5: Core API

### 5.1 `buildPrompt` Function (`src/build-prompt.ts`)

- [ ] **Implement `buildPrompt(query, sources, options?)` orchestration** — Validate inputs, look up template, resolve options (merge defaults < template defaults < options), format sources, inject metadata, enforce budget, assemble output, compute token count, construct `BuiltPrompt`. Synchronous function. | Status: not_done
- [ ] **Validate `query` parameter** — For templates that require a non-empty query (`qa`, `compare`, `extract`, `cite`), throw `EMPTY_QUERY` if query is empty string. `summarize` and `conversational` allow empty queries. | Status: not_done
- [ ] **Validate `sources` parameter** — Must be an array. Each entry must have a `content` string. Throw `INVALID_SOURCES` if not. | Status: not_done
- [ ] **Assign default source IDs** — When `source.id` is absent, assign `"source-{index}"` (1-indexed). | Status: not_done
- [ ] **Compute token counts for sources** — Use `source.tokens` when available. Otherwise call the configured `tokenCounter`. | Status: not_done
- [ ] **Apply budget enforcement** — When `contextBudget` is set and finite, enforce the configured budget strategy before formatting. | Status: not_done
- [ ] **Format sources with chosen formatter** — Call the format dispatcher with resolved source format and format-specific options. | Status: not_done
- [ ] **Apply template** — Inject formatted sources and query into the template's structure (system prompt + context placement + query framing). | Status: not_done
- [ ] **Handle `systemPrompt` override** — When `systemPrompt` is provided in options, replace the template's system prompt but keep query framing and context placement. | Status: not_done
- [ ] **Handle empty sources** — When `sources` is an empty array, replace the context section with a placeholder string (default: `"No sources provided."`). Respect `noSourcesPlaceholder` option. | Status: not_done
- [ ] **Assemble output format** — Call the output assembler with the correct format (openai, anthropic, text). | Status: not_done
- [ ] **Compute total `tokenCount`** — Sum of: system prompt tokens + context section tokens + query framing tokens + history tokens (if conversational). | Status: not_done
- [ ] **Build `sources` manifest** — For each included source: `index`, `id`, `tokens`, `truncated`, `originalTokens` (if truncated), `metadata`. | Status: not_done
- [ ] **Build `droppedSources` array** — For each dropped source: `id`, `tokens`, `reason: 'budget'`, `metadata`. | Status: not_done
- [ ] **Set `timestamp`** — ISO 8601 string of when `buildPrompt()` was called. | Status: not_done
- [ ] **Set `template` and `sourceFormat`** — Reflect the actual template and source format used. | Status: not_done
- [ ] **Write `buildPrompt` integration tests** — (`src/__tests__/build-prompt.test.ts`) Cover: basic Q&A with numbered format, all template/format combinations, system prompt override, empty sources with placeholder, budget enforcement populating droppedSources, tokenCount accuracy, sources manifest correctness, timestamp validity, default values. | Status: not_done

### 5.2 Convenience Functions

- [ ] **Implement `qa()` convenience function** — Thin wrapper: `buildPrompt(query, sources, { ...options, template: 'qa' })`. | Status: not_done
- [ ] **Implement `summarize()` convenience function** — Thin wrapper: `buildPrompt(query, sources, { ...options, template: 'summarize' })`. | Status: not_done
- [ ] **Implement `compare()` convenience function** — Thin wrapper: `buildPrompt(query, sources, { ...options, template: 'compare' })`. | Status: not_done
- [ ] **Implement `extract()` convenience function** — Thin wrapper: `buildPrompt(query, sources, { ...options, template: 'extract' })`. | Status: not_done
- [ ] **Implement `conversational()` convenience function** — Thin wrapper: `buildPrompt(query, sources, { ...options, template: 'conversational' })`. | Status: not_done
- [ ] **Implement `cite()` convenience function** — Thin wrapper: `buildPrompt(query, sources, { ...options, template: 'cite' })`. | Status: not_done

### 5.3 Factory Function (`src/factory.ts`)

- [ ] **Implement `createBuilder(config)` factory** — Accept a `BuilderConfig` (same shape as `BuildPromptOptions`). Validate config at construction time. Return a `Builder` object. | Status: not_done
- [ ] **Implement option merging** — Per-call overrides > factory config > built-in defaults. Merge deeply for nested options (`metadata`, `numberedFormat`, etc.). | Status: not_done
- [ ] **Builder instance is stateless** — Multiple calls to the same builder with different queries/sources must not interfere. | Status: not_done
- [ ] **Expose all convenience methods on Builder** — `builder.buildPrompt()`, `builder.qa()`, `builder.summarize()`, `builder.compare()`, `builder.extract()`, `builder.conversational()`, `builder.cite()`. | Status: not_done
- [ ] **Write factory tests** — (`src/__tests__/factory.test.ts`) Cover: factory config applied, per-call overrides take precedence, all convenience methods work, builder is reusable/stateless, invalid config throws at construction. | Status: not_done

### 5.4 Public Exports (`src/index.ts`)

- [ ] **Export `buildPrompt`** — From `build-prompt.ts`. | Status: not_done
- [ ] **Export convenience functions** — `qa`, `summarize`, `compare`, `extract`, `conversational`, `cite`. | Status: not_done
- [ ] **Export `createBuilder`** — From `factory.ts`. | Status: not_done
- [ ] **Export `defineTemplate`** — From `registry.ts`. | Status: not_done
- [ ] **Export `PromptBuilderError`** — From `errors.ts`. | Status: not_done
- [ ] **Export all TypeScript types** — All interfaces, type aliases from `types.ts`. | Status: not_done

---

## Phase 6: CLI

### 6.1 CLI Implementation (`src/cli.ts`)

- [ ] **Implement CLI entry point** — Read JSON from stdin, parse it, extract `query` and `sources` (or `chunks`) fields. | Status: not_done
- [ ] **Implement flag parsing** — Parse all CLI flags without external dependencies (use `process.argv` parsing): `--template` / `-t`, `--source-format` / `-f`, `--output-format` / `-o`, `--context-budget` / `-b`, `--budget-strategy`, `--no-metadata`, `--system-prompt`, `--messages-only`, `--pretty` / `-p`, `--version`, `--help` / `-h`. | Status: not_done
- [ ] **Handle `--system-prompt` flag** — Accept either a file path (read file contents) or an inline string. | Status: not_done
- [ ] **Handle `--messages-only` flag** — When set, output only the `messages` array (not the full `BuiltPrompt` object). | Status: not_done
- [ ] **Handle `--pretty` flag** — Pretty-print JSON output with 2-space indentation. | Status: not_done
- [ ] **Handle `--version` flag** — Print the version from `package.json` and exit 0. | Status: not_done
- [ ] **Handle `--help` flag** — Print usage information and exit 0. | Status: not_done
- [ ] **Implement exit codes** — Exit 0 on success, exit 1 on input error (invalid JSON, missing fields), exit 2 on configuration error (unknown template, invalid flags). | Status: not_done
- [ ] **Write error messages to stderr** — All error messages go to stderr, not stdout. | Status: not_done
- [ ] **Support `chunks` alias for `sources`** — Accept `{ query, chunks }` in addition to `{ query, sources }` for compatibility with `context-packer` output. | Status: not_done
- [ ] **Register CLI binary in `package.json`** — Add `"bin": { "rag-prompt-builder": "dist/cli.js" }` and add a shebang line to `cli.ts`. | Status: not_done

### 6.2 CLI Tests (`src/__tests__/cli.test.ts`)

- [ ] **Test basic Q&A prompt assembly** — Spawn CLI with `--template qa`, pipe valid JSON, verify stdout is valid `BuiltPrompt` JSON, exit code 0. | Status: not_done
- [ ] **Test `--output-format anthropic`** — Verify `messages` array has no system role, exit code 0. | Status: not_done
- [ ] **Test `--messages-only`** — Verify stdout is a JSON array, not a full `BuiltPrompt` object. | Status: not_done
- [ ] **Test `--pretty`** — Verify output is indented. | Status: not_done
- [ ] **Test invalid JSON input** — Verify error message on stderr, exit code 1. | Status: not_done
- [ ] **Test unknown template** — `--template xyz`, verify error on stderr, exit code 2. | Status: not_done
- [ ] **Test `--version`** — Verify version string printed, exit code 0. | Status: not_done
- [ ] **Test `--help`** — Verify help text printed, exit code 0. | Status: not_done
- [ ] **Test `--no-metadata`** — Verify metadata is not rendered in the output. | Status: not_done
- [ ] **Test `--context-budget`** — Verify budget enforcement is applied. | Status: not_done
- [ ] **Test `chunks` alias** — Pipe input with `chunks` field instead of `sources`, verify it works. | Status: not_done

---

## Phase 7: Edge Cases and Error Handling

### 7.1 Input Validation Edge Cases

- [ ] **Empty query with `qa` template** — Throws `EMPTY_QUERY`. | Status: not_done
- [ ] **Empty query with `compare` template** — Throws `EMPTY_QUERY`. | Status: not_done
- [ ] **Empty query with `extract` template** — Throws `EMPTY_QUERY` (or `SCHEMA_REQUIRED` if no schema either). | Status: not_done
- [ ] **Empty query with `cite` template** — Throws `EMPTY_QUERY`. | Status: not_done
- [ ] **Empty query with `summarize` template** — Does NOT throw. Uses default framing. | Status: not_done
- [ ] **Empty query with `conversational` template** — Does NOT throw. Query is used as-is. | Status: not_done
- [ ] **Non-array `sources` parameter** — Throws `INVALID_SOURCES`. | Status: not_done
- [ ] **Source missing `content` field** — Throws `INVALID_SOURCES`. | Status: not_done
- [ ] **Unknown template name** — Throws `UNKNOWN_TEMPLATE`. | Status: not_done
- [ ] **`sourceFormat: 'custom'` without `customFormat`** — Throws `MISSING_CUSTOM_FORMAT`. | Status: not_done
- [ ] **`budgetStrategy: 'custom'` without `budgetFn`** — Throws `MISSING_BUDGET_FN`. | Status: not_done
- [ ] **`contextBudget <= 0`** — Throws `INVALID_CONTEXT_BUDGET`. | Status: not_done
- [ ] **`contextBudget` is NaN or non-finite** — Throws `INVALID_CONTEXT_BUDGET`. | Status: not_done

### 7.2 Content Edge Cases

- [ ] **Empty sources array** — Returns valid `BuiltPrompt` with placeholder text in context section. No error thrown. | Status: not_done
- [ ] **Single source with no metadata** — No metadata header rendered. Format output is minimal. | Status: not_done
- [ ] **Source content with XML special characters in `xml` format** — Characters `&`, `<`, `>`, `"`, `'` are properly escaped. | Status: not_done
- [ ] **Source content with markdown headings in `markdown` format** — No structural interference with the source section headings. | Status: not_done
- [ ] **Very long source content (1000+ tokens) with `proportional` strategy** — Truncated at sentence boundary, not mid-sentence. | Status: not_done
- [ ] **Unicode content (CJK, emoji, RTL)** — Content preserved intact through all formatting paths. | Status: not_done
- [ ] **All five metadata fields on all sources** — No rendering artifacts, all fields render correctly. | Status: not_done
- [ ] **Conversational template with empty history** — Same output structure as single-turn template. | Status: not_done
- [ ] **History that makes messages very long** — Builder includes all history; no truncation. Document that history management is caller's responsibility. | Status: not_done

---

## Phase 8: Integration and End-to-End Tests

### 8.1 Integration Tests

- [ ] **Test `buildPrompt` with realistic `PackedChunk[]` input** — Simulate output from `context-packer` (chunks with `content`, `id`, `score`, `tokens`, `metadata`). Verify valid `BuiltPrompt` produced. | Status: not_done
- [ ] **Test `buildPrompt` with `Chunk[]` mapped to `RAGSource`** — Simulate chunks from `chunk-smart` mapped to `RAGSource` format. | Status: not_done
- [ ] **Test `createBuilder` with config and per-call overrides** — Verify overrides take precedence over factory config. | Status: not_done
- [ ] **Test `buildPrompt` with empty sources** — Verify placeholder text in context, no error. | Status: not_done
- [ ] **Test `buildPrompt` with budget smaller than total** — Verify budget strategy kicks in, `droppedSources` populated. | Status: not_done
- [ ] **Test all six templates with all five source formats** — 30 combinations. Verify each produces valid output. | Status: not_done
- [ ] **Test all three output formats with each template** — 18 combinations. Verify correct message structure. | Status: not_done
- [ ] **Test `cite` template ignores `sourceFormat` override** — Always uses `numbered` regardless of option. | Status: not_done
- [ ] **Test custom template via `defineTemplate`** — Define a custom template, use it with `buildPrompt`, verify all fields work. | Status: not_done

### 8.2 `BuiltPrompt` Field Validation Tests

- [ ] **Test `tokenCount` accuracy** — Verify it equals sum of system + context + query + history tokens using the configured counter. | Status: not_done
- [ ] **Test `sources` manifest** — Verify `index`, `id`, `tokens`, `truncated`, `metadata` for each included source. | Status: not_done
- [ ] **Test `droppedSources` with budget enforcement** — Verify `id`, `tokens`, `reason: 'budget'`, `metadata` for each dropped source. | Status: not_done
- [ ] **Test `template` field** — Matches the template name used. | Status: not_done
- [ ] **Test `sourceFormat` field** — Matches the source format used. | Status: not_done
- [ ] **Test `timestamp` field** — Is a valid ISO 8601 string. | Status: not_done
- [ ] **Test `text` field** — Present only when `outputFormat: 'text'`. Undefined otherwise. | Status: not_done
- [ ] **Test `system` field** — Always present. Contains system prompt (and formatted sources when `contextPlacement: 'system'`). | Status: not_done

---

## Phase 9: Performance

- [ ] **Write performance benchmarks** — Create a benchmark script that measures assembly time for: minimal (5 sources, 100 tokens each, no metadata), typical (10 sources, 300 tokens each), large (20 sources, 500 tokens each, full metadata), budget enforcement (20 sources, 500 tokens each, proportional). | Status: not_done
- [ ] **Verify sub-millisecond targets** — Minimal < 0.1ms, typical < 0.5ms, large < 1ms, full metadata < 2ms, budget enforcement < 2ms. | Status: not_done
- [ ] **Optimize string assembly** — Use `Array.join` and template literals, not `+=` loops. Verify no regex in hot path. | Status: not_done
- [ ] **Lazy metadata rendering** — Only build metadata headers when at least one field is present and enabled. O(1) check per source. | Status: not_done

---

## Phase 10: Documentation and Publishing

- [ ] **Write README.md** — Comprehensive README with: installation, quick start, API reference for `buildPrompt`, convenience functions, `createBuilder`, `defineTemplate`. Usage examples for every template and format combination. Integration examples with `context-packer`, `context-budget`, `chunk-smart`, `rag-cite`. CLI usage section. | Status: not_done
- [ ] **Add JSDoc comments to all public exports** — `buildPrompt`, `qa`, `summarize`, `compare`, `extract`, `conversational`, `cite`, `createBuilder`, `defineTemplate`, `PromptBuilderError`, and all exported types. | Status: not_done
- [ ] **Bump version in `package.json`** — Follow semver per the implementation phase. | Status: not_done
- [ ] **Verify `package.json` fields** — Ensure `main`, `types`, `files`, `bin`, `engines`, `publishConfig` are correct. Add `keywords` (e.g., `rag`, `prompt`, `builder`, `llm`, `openai`, `anthropic`). | Status: not_done
- [ ] **Run full test suite** — `npm run test` passes all tests. | Status: not_done
- [ ] **Run lint** — `npm run lint` passes with no errors. | Status: not_done
- [ ] **Run build** — `npm run build` produces `dist/` with `.js`, `.d.ts`, `.d.ts.map`, `.js.map` files. | Status: not_done
- [ ] **Verify CLI works end-to-end** — Pipe JSON to `dist/cli.js`, verify correct output. | Status: not_done
