export type FrameworkId = 'maccms' | 'wordpress' | 'hugo' | 'hexo' | 'ghost' | 'generic'

export type PaginationPattern =
  | { kind: 'query-param'; param: string }
  | { kind: 'path-segment'; template: string }
  | { kind: 'next-link' }

export interface FrameworkHint {
  framework: FrameworkId
  paginationPattern: PaginationPattern
  categories?: { title: string; url: string }[]
  searchTemplate?: string
}
