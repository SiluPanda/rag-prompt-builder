export interface RAGSourceMetadata {
  title?: string
  url?: string
  date?: string
  author?: string
  page?: number | string
  group?: string
  [k: string]: unknown
}

export interface RAGSource {
  content: string
  id?: string
  tokens?: number
  score?: number
  metadata?: RAGSourceMetadata
}

export type BuiltInTemplate = 'qa' | 'summarize' | 'compare' | 'extract' | 'conversational' | 'cite'

export type SourceFormat = 'numbered' | 'xml' | 'markdown' | 'json' | 'custom'

export type OutputFormat = 'openai' | 'anthropic' | 'text'

export interface BuildPromptOptions {
  template?: BuiltInTemplate | string
  systemPrompt?: string
  sourceFormat?: SourceFormat
  customFormat?: (sources: RAGSource[]) => string
  showMetadata?: boolean
  outputFormat?: OutputFormat
  contextBudget?: number
  budgetStrategy?: 'truncate' | 'drop'
  tokenCounter?: (text: string) => number
}

export interface IncludedSource {
  index: number
  id: string
  tokens: number
  truncated: boolean
  metadata: RAGSourceMetadata
}

export interface BuiltPrompt {
  system: string
  query: string
  messages: Array<{ role: string; content: string }>
  text?: string
  tokenCount: number
  template: string
  sourceFormat: string
  sources: IncludedSource[]
  droppedSources: RAGSource[]
  timestamp: string
}
