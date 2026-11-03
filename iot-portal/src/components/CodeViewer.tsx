import { useState, useEffect, useRef } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import { Copy, Check, WrapText } from 'lucide-react'

interface CodeViewerProps {
  code: string
  language: string
  title?: string
  theme?: 'light' | 'dark'
}

export function CodeViewer({ code, language, title, theme = 'light' }: CodeViewerProps) {
  const [copied, setCopied] = useState(false)
  const [wrapLines, setWrapLines] = useState(true)

  // Calculate dynamic height based on lines (20px per line + padding)
  const calculateHeight = (c: string) => {
    const lines = c.trim().split('\n').length
    return Math.max(90, lines * 20 + 24)
  }

  const [editorHeight, setEditorHeight] = useState<number>(() => calculateHeight(code))
  const editorRef = useRef<any>(null)

  useEffect(() => {
    setEditorHeight(calculateHeight(code))
  }, [code])

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor

    // Define custom formal neutral zinc themes (0% blue saturation)
    monaco.editor.defineTheme('lbtech-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '71717a', fontStyle: 'italic' },
        { token: 'keyword', foreground: '09090b', fontStyle: 'bold' },
        { token: 'string', foreground: '047857' },
        { token: 'number', foreground: 'b45309' },
      ],
      colors: {
        'editor.background': '#ffffff',
        'editor.foreground': '#18181b',
        'editor.lineHighlightBackground': '#f4f4f5',
        'editorLineNumber.foreground': '#a1a1aa',
        'editorLineNumber.activeForeground': '#18181b',
        'editorGutter.background': '#ffffff',
      },
    })

    monaco.editor.defineTheme('lbtech-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '71717a', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'f4f4f5', fontStyle: 'bold' },
        { token: 'string', foreground: '34d399' },
        { token: 'number', foreground: 'fbbf24' },
      ],
      colors: {
        'editor.background': '#121214',
        'editor.foreground': '#f4f4f5',
        'editor.lineHighlightBackground': '#18181b',
        'editorLineNumber.foreground': '#52525b',
        'editorLineNumber.activeForeground': '#a1a1aa',
        'editorGutter.background': '#121214',
      },
    })

    monaco.editor.setTheme(theme === 'dark' ? 'lbtech-dark' : 'lbtech-light')

    // Automatically adapt to exact content height with zero inner scroll
    const updateHeight = () => {
      const contentHeight = editor.getContentHeight()
      if (contentHeight > 0) {
        setEditorHeight(contentHeight + 8)
      }
    }

    updateHeight()
    editor.onDidContentSizeChange(updateHeight)
  }

  // Update theme dynamically
  useEffect(() => {
    if (editorRef.current && (window as any).monaco) {
      ;(window as any).monaco.editor.setTheme(theme === 'dark' ? 'lbtech-dark' : 'lbtech-light')
    }
  }, [theme])

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-xs w-full transition-colors">
      <div className="flex flex-wrap items-center justify-between px-3 sm:px-4 py-2 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-xs gap-2">
        <span className="font-mono text-zinc-700 dark:text-zinc-300 font-medium truncate max-w-[200px] sm:max-w-none">
          {title || `${language.toUpperCase()} Snippet`}
        </span>
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            type="button"
            onClick={() => setWrapLines(!wrapLines)}
            title={wrapLines ? 'ปิดการตัดบรรทัด' : 'เปิดการตัดบรรทัด'}
            className={`p-1 sm:px-2 sm:py-1 rounded-md text-[11px] font-medium border transition-colors cursor-pointer flex items-center gap-1 ${
              wrapLines
                ? 'bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100'
                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <WrapText className="h-3 w-3" />
            <span className="hidden sm:inline">ตัดบรรทัด</span>
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>คัดลอกแล้ว</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">คัดลอกโค้ด</span>
                <span className="sm:hidden">คัดลอก</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div style={{ height: `${editorHeight}px` }} className="w-full transition-[height] duration-150">
        <Editor
          height="100%"
          language={language}
          value={code}
          theme={theme === 'dark' ? 'lbtech-dark' : 'lbtech-light'}
          onMount={handleEditorDidMount}
          options={{
            readOnly: true,
            domReadOnly: true,
            fontSize: 12.5,
            lineHeight: 20,
            lineNumbers: 'on',
            lineNumbersMinChars: 3,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: wrapLines ? 'on' : 'off',
            scrollbar: {
              vertical: 'hidden',
              horizontal: wrapLines ? 'hidden' : 'auto',
              handleMouseWheel: false,
              alwaysConsumeMouseWheel: false,
            },
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            automaticLayout: true,
            padding: { top: 12, bottom: 12 },
            fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace",
          }}
        />
      </div>
    </div>
  )
}
