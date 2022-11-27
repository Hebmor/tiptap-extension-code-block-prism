import CodeBlock, { CodeBlockOptions } from '@tiptap/extension-code-block'

import { PrismPlugin } from './prism-plugin'

export interface CodeBlockPrismOptions extends CodeBlockOptions {
  defaultLanguage: string | null | undefined,
}

export const CodeBlockPrism = CodeBlock.extend<CodeBlockPrismOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      defaultLanguage: null,
    }
  },

  addProseMirrorPlugins() {
    return [
      ...this.parent?.() || [],
      PrismPlugin({
        name: this.name,
        defaultLanguage: this.options.defaultLanguage,
      }),
    ]
  },
})