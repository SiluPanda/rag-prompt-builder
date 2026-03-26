import { describe, it, expect, beforeEach } from 'vitest'
import { buildPrompt, createBuilder } from '../builder.js'
import { defineTemplate } from '../templates.js'
import { formatSources } from '../format-sources.js'
import type { RAGSource } from '../types.js'

const src1: RAGSource = {
  content: 'Paris is the capital of France.',
  id: 'doc-1',
  metadata: { title: 'Geography Guide', url: 'https://example.com/geo' },
}

const src2: RAGSource = {
  content: 'The Eiffel Tower is located in Paris.',
  id: 'doc-2',
  metadata: { title: 'Landmarks Guide', url: 'https://example.com/landmarks' },
}

describe('buildPrompt', () => {
  it('returns a BuiltPrompt with correct shape for 2 sources', () => {
    const result = buildPrompt('What is the capital of France?', [src1, src2])

    expect(result.query).toBe('What is the capital of France?')
    expect(result.template).toBe('qa')
    expect(result.sourceFormat).toBe('numbered')
    expect(result.sources).toHaveLength(2)
    expect(result.droppedSources).toHaveLength(0)
    expect(result.messages).toHaveLength(2)
    expect(result.messages[0].role).toBe('system')
    expect(result.messages[1].role).toBe('user')
    expect(result.timestamp).toBeTruthy()
    expect(result.tokenCount).toBeGreaterThan(0)
  })

  it('qa template includes "Based on the context" framing', () => {
    const result = buildPrompt('What is Paris known for?', [src1], { template: 'qa' })
    const userMsg = result.messages.find((m) => m.role === 'user')!
    expect(userMsg.content).toContain('Based on the context above, please answer:')
    expect(userMsg.content).toContain('What is Paris known for?')
  })

  it('cite template includes citation instruction', () => {
    const result = buildPrompt('Tell me about Paris.', [src1], { template: 'cite' })
    const userMsg = result.messages.find((m) => m.role === 'user')!
    expect(userMsg.content).toContain('[source number] notation')
    expect(result.system).toContain('citations')
  })

  it('summarize template does not add extra framing', () => {
    const result = buildPrompt('Summarize the documents.', [src1], { template: 'summarize' })
    const userMsg = result.messages.find((m) => m.role === 'user')!
    expect(userMsg.content).toContain('Summarize the documents.')
    expect(result.system).toContain('summarization assistant')
  })

  it('compare template prefixes query with "Using the sources provided"', () => {
    const result = buildPrompt('compare the two sources', [src1, src2], { template: 'compare' })
    const userMsg = result.messages.find((m) => m.role === 'user')!
    expect(userMsg.content).toContain('Using the sources provided, compare the two sources')
  })

  it('extract template prefixes query with "Extract from the context"', () => {
    const result = buildPrompt('all place names', [src1], { template: 'extract' })
    const userMsg = result.messages.find((m) => m.role === 'user')!
    expect(userMsg.content).toContain('Extract from the context: all place names')
  })

  it('conversational template leaves query unchanged', () => {
    const result = buildPrompt('Hello there!', [src1], { template: 'conversational' })
    const userMsg = result.messages.find((m) => m.role === 'user')!
    expect(userMsg.content).toContain('Hello there!')
  })

  it('uses custom systemPrompt when provided', () => {
    const result = buildPrompt('query', [src1], { systemPrompt: 'Custom system.' })
    expect(result.system).toBe('Custom system.')
  })

  it('anthropic output format produces messages without system role', () => {
    const result = buildPrompt('query', [src1], { outputFormat: 'anthropic' })
    expect(result.messages).toHaveLength(1)
    expect(result.messages[0].role).toBe('user')
  })

  it('text output format produces text field and empty messages array', () => {
    const result = buildPrompt('query', [src1], { outputFormat: 'text' })
    expect(result.messages).toHaveLength(0)
    expect(result.text).toBeTruthy()
  })

  it('throws on empty query', () => {
    expect(() => buildPrompt('', [src1])).toThrow('query')
  })

  it('throws on empty sources array', () => {
    expect(() => buildPrompt('query', [])).toThrow('sources')
  })
})

describe('formatSources', () => {
  it('numbered format produces [1] prefix', () => {
    const result = formatSources([src1], 'numbered', false)
    expect(result).toContain('[1]')
    expect(result).toContain('Paris is the capital')
  })

  it('numbered format includes metadata when showMetadata=true', () => {
    const result = formatSources([src1], 'numbered', true)
    expect(result).toContain('Source:')
    expect(result).toContain('Geography Guide')
  })

  it('xml format produces <source> tags', () => {
    const result = formatSources([src1], 'xml', false)
    expect(result).toMatch(/<source id="1">/)
    expect(result).toContain('</source>')
  })

  it('xml format includes metadata attributes when showMetadata=true', () => {
    const result = formatSources([src1], 'xml', true)
    expect(result).toContain('title="Geography Guide"')
    expect(result).toContain('url="https://example.com/geo"')
  })

  it('markdown format produces ## Source heading', () => {
    const result = formatSources([src1], 'markdown', false)
    expect(result).toContain('## Source 1')
    expect(result).toContain('---')
  })

  it('json format produces valid JSON array', () => {
    const result = formatSources([src1, src2], 'json', false)
    const parsed = JSON.parse(result) as unknown[]
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed).toHaveLength(2)
    expect((parsed[0] as { index: number }).index).toBe(1)
  })

  it('custom format calls the provided function', () => {
    const customFn = (srcs: RAGSource[]) => `CUSTOM:${srcs.length}`
    const result = formatSources([src1, src2], 'custom', false, customFn)
    expect(result).toBe('CUSTOM:2')
  })

  it('custom format throws when no function provided', () => {
    expect(() => formatSources([src1], 'custom', false)).toThrow('customFormat')
  })

  it('xml format escapes special characters in content', () => {
    const src: RAGSource = { content: 'Discount: <50% off & free "shipping">' }
    const result = formatSources([src], 'xml', false)
    expect(result).toContain('&lt;50% off &amp; free &quot;shipping&quot;&gt;')
    expect(result).not.toContain('<50%')
  })

  it('xml format escapes special characters in metadata attributes', () => {
    const src: RAGSource = {
      content: 'Hello',
      metadata: { title: 'Tom & Jerry\'s "Guide"', url: 'https://example.com?a=1&b=2' },
    }
    const result = formatSources([src], 'xml', true)
    expect(result).toContain('title="Tom &amp; Jerry&apos;s &quot;Guide&quot;"')
    expect(result).toContain('url="https://example.com?a=1&amp;b=2"')
  })
})

describe('token budget', () => {
  const bigSrc: RAGSource = { content: 'A'.repeat(400), id: 'big' }
  const smallSrc: RAGSource = { content: 'B'.repeat(40), id: 'small' }

  it('drop strategy drops sources that exceed budget', () => {
    // bigSrc needs 100 tokens, smallSrc needs 10 tokens
    // budget of 50 should drop bigSrc
    const result = buildPrompt('query', [bigSrc, smallSrc], {
      contextBudget: 50,
      budgetStrategy: 'drop',
    })
    expect(result.droppedSources).toHaveLength(1)
    expect(result.droppedSources[0].id).toBe('big')
    expect(result.sources).toHaveLength(1)
    expect(result.sources[0].id).toBe('small')
  })

  it('truncate strategy truncates last source that partially fits', () => {
    // bigSrc needs 100 tokens, budget=50 → truncated to 50 tokens worth
    const result = buildPrompt('query', [bigSrc], {
      contextBudget: 50,
      budgetStrategy: 'truncate',
    })
    expect(result.sources).toHaveLength(1)
    expect(result.droppedSources).toHaveLength(0)
    // Truncated content should be shorter than original
    const userMsg = result.messages.find((m) => m.role === 'user')!
    expect(userMsg.content.length).toBeLessThan(bigSrc.content.length + 200)
  })

  it('uses custom tokenCounter when provided', () => {
    const counter = (t: string) => t.split(' ').length
    const src: RAGSource = { content: 'one two three four five', id: 'five-words' }
    // 5 words, budget = 3 words → drop
    const result = buildPrompt('query', [src], {
      contextBudget: 3,
      budgetStrategy: 'drop',
      tokenCounter: counter,
    })
    expect(result.droppedSources).toHaveLength(1)
  })

  it('respects pre-computed tokens field in budget calculations', () => {
    // Source with 400 chars (100 tokens by default counter) but pre-computed as 10 tokens
    const src: RAGSource = { content: 'A'.repeat(400), id: 'precomputed', tokens: 10 }
    // Budget of 20 should fit this source (pre-computed 10 <= 20)
    const result = buildPrompt('query', [src], {
      contextBudget: 20,
      budgetStrategy: 'drop',
    })
    expect(result.sources).toHaveLength(1)
    expect(result.droppedSources).toHaveLength(0)
  })

  it('truncated source token count reflects actual content, not remaining budget', () => {
    const counter = (t: string) => Math.ceil(t.length / 4)
    const src: RAGSource = { content: 'A'.repeat(400), id: 'big' }
    // 400 chars = 100 tokens, budget 50 → truncated
    const result = buildPrompt('query', [src], {
      contextBudget: 50,
      budgetStrategy: 'truncate',
      tokenCounter: counter,
    })
    expect(result.sources).toHaveLength(1)
    // Token count should reflect actual truncated content, not the budget
    const reportedTokens = result.sources[0].tokens
    const userMsg = result.messages.find((m) => m.role === 'user')!
    // Extract approximate truncated content length from message
    expect(reportedTokens).toBeLessThanOrEqual(50)
    expect(reportedTokens).toBeGreaterThan(0)
    expect(userMsg.content.length).toBeLessThan(400 + 200)
  })

  it('non-truncated sources after dropped sources report truncated=false', () => {
    // Original: [A(100 tokens), B(100 tokens), C(10 tokens), D(10 tokens)]
    // Budget=25 with drop strategy: A is dropped (100>25), B is dropped (100>25),
    // C fits (10<=25), D fits (10+10=20<=25)
    // Bug: without fix, fittedSources[0]=C compared against sources[0]=A → wrong truncated=true
    const srcA: RAGSource = { content: 'A'.repeat(400), id: 'A' }
    const srcB: RAGSource = { content: 'B'.repeat(400), id: 'B' }
    const srcC: RAGSource = { content: 'C'.repeat(40), id: 'C' }
    const srcD: RAGSource = { content: 'D'.repeat(40), id: 'D' }

    const result = buildPrompt('query', [srcA, srcB, srcC, srcD], {
      contextBudget: 25,
      budgetStrategy: 'drop',
    })

    // A and B should be dropped
    expect(result.droppedSources).toHaveLength(2)
    expect(result.droppedSources.map((s) => s.id)).toEqual(['A', 'B'])

    // C and D should be included and NOT marked as truncated
    expect(result.sources).toHaveLength(2)
    expect(result.sources[0].id).toBe('C')
    expect(result.sources[0].truncated).toBe(false)
    expect(result.sources[1].id).toBe('D')
    expect(result.sources[1].truncated).toBe(false)
  })
})

describe('createBuilder', () => {
  it('factory chains correctly with preset config', () => {
    const builder = createBuilder({ showMetadata: true })
    const result = builder.qa('What is Paris?', [src1])
    expect(result.template).toBe('qa')
    // showMetadata was preset, so source metadata should appear
    const userMsg = result.messages.find((m) => m.role === 'user')!
    expect(userMsg.content).toContain('Geography Guide')
  })

  it('factory summarize shorthand uses summarize template', () => {
    const builder = createBuilder()
    const result = builder.summarize('Summarize.', [src1])
    expect(result.template).toBe('summarize')
  })

  it('factory cite shorthand uses cite template', () => {
    const builder = createBuilder()
    const result = builder.cite('Tell me about Paris.', [src1])
    expect(result.template).toBe('cite')
  })

  it('factory compare shorthand uses compare template', () => {
    const builder = createBuilder()
    const result = builder.compare('compare sources', [src1, src2])
    expect(result.template).toBe('compare')
  })

  it('factory extract shorthand uses extract template', () => {
    const builder = createBuilder()
    const result = builder.extract('place names', [src1])
    expect(result.template).toBe('extract')
  })

  it('factory conversational shorthand uses conversational template', () => {
    const builder = createBuilder()
    const result = builder.conversational('hello', [src1])
    expect(result.template).toBe('conversational')
  })
})

describe('defineTemplate', () => {
  beforeEach(() => {
    defineTemplate('custom-test', {
      system: 'Custom test system.',
      queryFraming: 'Custom framing: {{query}}',
      contextPlacement: 'user',
    })
  })

  it('registers and uses a custom template', () => {
    const result = buildPrompt('my question', [src1], { template: 'custom-test' })
    expect(result.template).toBe('custom-test')
    expect(result.system).toBe('Custom test system.')
    const userMsg = result.messages.find((m) => m.role === 'user')!
    expect(userMsg.content).toContain('Custom framing: my question')
  })
})
