import type {
  RAGSource,
  BuildPromptOptions,
  BuiltPrompt,
  IncludedSource,
  SourceFormat,
  OutputFormat,
} from './types.js'
import { defaultTokenCounter } from './token-counter.js'
import { formatSources } from './format-sources.js'
import { getTemplate } from './templates.js'

function applyBudget(
  sources: RAGSource[],
  budget: number,
  strategy: 'truncate' | 'drop',
  tokenCounter: (t: string) => number
): { fitted: RAGSource[]; dropped: RAGSource[] } {
  const fitted: RAGSource[] = []
  const dropped: RAGSource[] = []
  let used = 0

  for (const source of sources) {
    const tokens = source.tokens ?? tokenCounter(source.content)
    if (used + tokens <= budget) {
      fitted.push(source)
      used += tokens
    } else {
      const remaining = budget - used
      if (strategy === 'truncate' && remaining > 0) {
        // Truncate content to fit remaining budget (approx by char ratio)
        const ratio = remaining / tokens
        const truncatedContent = source.content.slice(0, Math.floor(source.content.length * ratio))
        const actualTokens = tokenCounter(truncatedContent)
        fitted.push({ ...source, content: truncatedContent, tokens: actualTokens })
        used += actualTokens
      } else {
        dropped.push(source)
      }
    }
  }

  return { fitted, dropped }
}

export function buildPrompt(
  query: string,
  sources: RAGSource[],
  options?: BuildPromptOptions
): BuiltPrompt {
  if (!query || query.trim() === '') {
    throw new Error('query must be a non-empty string')
  }
  if (!Array.isArray(sources) || sources.length === 0) {
    throw new Error('sources must be a non-empty array')
  }

  const templateName = options?.template ?? 'qa'
  const tokenCounter = options?.tokenCounter ?? defaultTokenCounter
  const sourceFormat: SourceFormat = options?.sourceFormat ?? 'numbered'
  const showMetadata = options?.showMetadata ?? false
  const outputFormat: OutputFormat = options?.outputFormat ?? 'openai'
  const budgetStrategy = options?.budgetStrategy ?? 'drop'

  // Apply token budget
  let fittedSources: RAGSource[] = sources
  let droppedSources: RAGSource[] = []

  if (options?.contextBudget != null) {
    const result = applyBudget(sources, options.contextBudget, budgetStrategy, tokenCounter)
    fittedSources = result.fitted
    droppedSources = result.dropped
  }

  // Format sources
  const formattedSources = formatSources(
    fittedSources,
    sourceFormat,
    showMetadata,
    options?.customFormat
  )

  const contextBlock = `Context:\n\n${formattedSources}`

  // Resolve template
  const templateDef = getTemplate(templateName)
  const systemContent = options?.systemPrompt ?? (templateDef?.system ?? '')
  const queryFraming = templateDef?.queryFraming ?? '{{query}}'
  const contextPlacement = templateDef?.contextPlacement ?? 'user'

  const framedQuery = queryFraming.replace('{{query}}', query)

  // Build user message content
  let userContent: string
  let systemMessage: string

  if (contextPlacement === 'system') {
    systemMessage = `${systemContent}\n\n${contextBlock}`
    userContent = framedQuery
  } else {
    systemMessage = systemContent
    userContent = `${contextBlock}\n\n${framedQuery}`
  }

  // Build messages array
  let messages: Array<{ role: string; content: string }>
  let text: string | undefined

  if (outputFormat === 'openai') {
    messages = [
      { role: 'system', content: systemMessage },
      { role: 'user', content: userContent },
    ]
  } else if (outputFormat === 'anthropic') {
    messages = [
      { role: 'user', content: userContent },
    ]
  } else {
    // text format
    messages = []
    text = `${systemMessage}\n\n${userContent}`
  }

  // Build IncludedSource list
  const includedSources: IncludedSource[] = fittedSources.map((s, i) => ({
    index: i + 1,
    id: s.id ?? String(i + 1),
    tokens: s.tokens ?? tokenCounter(s.content),
    truncated: s !== sources[i] && s.content !== sources[i]?.content,
    metadata: s.metadata ?? {},
  }))

  const totalTokenCount = tokenCounter(systemMessage) + tokenCounter(userContent)

  return {
    system: systemMessage,
    query,
    messages,
    text,
    tokenCount: totalTokenCount,
    template: templateName,
    sourceFormat,
    sources: includedSources,
    droppedSources,
    timestamp: new Date().toISOString(),
  }
}

export interface Builder {
  buildPrompt: (query: string, sources: RAGSource[], opts?: BuildPromptOptions) => BuiltPrompt
  qa: (query: string, sources: RAGSource[], opts?: Omit<BuildPromptOptions, 'template'>) => BuiltPrompt
  summarize: (query: string, sources: RAGSource[], opts?: Omit<BuildPromptOptions, 'template'>) => BuiltPrompt
  compare: (query: string, sources: RAGSource[], opts?: Omit<BuildPromptOptions, 'template'>) => BuiltPrompt
  extract: (query: string, sources: RAGSource[], opts?: Omit<BuildPromptOptions, 'template'>) => BuiltPrompt
  conversational: (query: string, sources: RAGSource[], opts?: Omit<BuildPromptOptions, 'template'>) => BuiltPrompt
  cite: (query: string, sources: RAGSource[], opts?: Omit<BuildPromptOptions, 'template'>) => BuiltPrompt
}

export function createBuilder(config?: BuildPromptOptions): Builder {
  const base = (template: string) =>
    (query: string, sources: RAGSource[], opts?: Omit<BuildPromptOptions, 'template'>): BuiltPrompt =>
      buildPrompt(query, sources, { ...config, ...opts, template })

  return {
    buildPrompt: (query, sources, opts) => buildPrompt(query, sources, { ...config, ...opts }),
    qa: base('qa'),
    summarize: base('summarize'),
    compare: base('compare'),
    extract: base('extract'),
    conversational: base('conversational'),
    cite: base('cite'),
  }
}
