// rag-prompt-builder - Compose RAG prompts from chunks with automatic metadata injection

export { buildPrompt, createBuilder } from './builder.js'
export { defineTemplate } from './templates.js'
export { defaultTokenCounter } from './token-counter.js'
export { formatSources } from './format-sources.js'

export type {
  RAGSource,
  RAGSourceMetadata,
  BuiltInTemplate,
  SourceFormat,
  OutputFormat,
  BuildPromptOptions,
  IncludedSource,
  BuiltPrompt,
} from './types.js'

export type { TemplateDefinition } from './templates.js'
export type { Builder } from './builder.js'

// Convenience shorthand helpers
import { buildPrompt } from './builder.js'
import type { RAGSource, BuildPromptOptions, BuiltPrompt } from './types.js'

type ShorthandOpts = Omit<BuildPromptOptions, 'template'>

export const qa = (query: string, sources: RAGSource[], opts?: ShorthandOpts): BuiltPrompt =>
  buildPrompt(query, sources, { ...opts, template: 'qa' })

export const summarize = (query: string, sources: RAGSource[], opts?: ShorthandOpts): BuiltPrompt =>
  buildPrompt(query, sources, { ...opts, template: 'summarize' })

export const compare = (query: string, sources: RAGSource[], opts?: ShorthandOpts): BuiltPrompt =>
  buildPrompt(query, sources, { ...opts, template: 'compare' })

export const extract = (query: string, sources: RAGSource[], opts?: ShorthandOpts): BuiltPrompt =>
  buildPrompt(query, sources, { ...opts, template: 'extract' })

export const conversational = (query: string, sources: RAGSource[], opts?: ShorthandOpts): BuiltPrompt =>
  buildPrompt(query, sources, { ...opts, template: 'conversational' })

export const cite = (query: string, sources: RAGSource[], opts?: ShorthandOpts): BuiltPrompt =>
  buildPrompt(query, sources, { ...opts, template: 'cite' })
