import React, { useState, useMemo, useRef, useEffect } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-markdown';
import { 
  Code, 
  Copy, 
  Check, 
  Download, 
  Maximize2, 
  X, 
  Search, 
  FileCode, 
  ChevronDown, 
  ChevronUp, 
  Layers,
  ClipboardCheck,
  Terminal
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface CodeData {
  code: string;
  language?: string;
  title?: string;
  lineCount?: number;
}

export const SUPPORTED_LANGUAGES = [
  { id: 'typescript', label: 'TypeScript', ext: '.ts' },
  { id: 'javascript', label: 'JavaScript', ext: '.js' },
  { id: 'python', label: 'Python', ext: '.py' },
  { id: 'json', label: 'JSON', ext: '.json' },
  { id: 'html', label: 'HTML', ext: '.html' },
  { id: 'css', label: 'CSS', ext: '.css' },
  { id: 'sql', label: 'SQL', ext: '.sql' },
  { id: 'bash', label: 'Bash / Shell', ext: '.sh' },
  { id: 'rust', label: 'Rust', ext: '.rs' },
  { id: 'go', label: 'Go', ext: '.go' },
  { id: 'cpp', label: 'C++', ext: '.cpp' },
  { id: 'java', label: 'Java', ext: '.java' },
  { id: 'markdown', label: 'Markdown', ext: '.md' },
  { id: 'plaintext', label: 'Plain Text', ext: '.txt' },
];

function highlightCode(code: string, language: string): string {
  try {
    const lang = language.toLowerCase();
    const grammar = Prism.languages[lang] || Prism.languages.javascript || Prism.languages.markup;
    if (grammar) {
      return Prism.highlight(code, grammar, lang);
    }
  } catch (err) {
    console.warn('Prism highlight error:', err);
  }
  return code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * High-performance Code Block in Chat Bubble
 * Supports 2,000 to 10,000+ lines without crashing or freezing the chat layout
 */
export const CodeSnippetBlock: React.FC<{
  code: string;
  language?: string;
  title?: string;
  onOpenFullscreen?: (data: CodeData) => void;
}> = ({ code, language = 'typescript', title, onOpenFullscreen }) => {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const lines = useMemo(() => code.split('\n'), [code]);
  const lineCount = lines.length;

  // For chat bubbles, preview up to 45 lines if collapsed, or up to 250 lines if expanded inline.
  // Fullscreen viewer handles 10,000+ lines smoothly.
  const previewLimit = isExpanded ? Math.min(lineCount, 300) : Math.min(lineCount, 35);
  const displayedCode = useMemo(() => {
    if (lineCount <= previewLimit) return code;
    return lines.slice(0, previewLimit).join('\n');
  }, [code, lines, lineCount, previewLimit]);

  const highlightedHtml = useMemo(() => {
    return highlightCode(displayedCode, language);
  }, [displayedCode, language]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const langObj = SUPPORTED_LANGUAGES.find(l => l.id === language);
    const ext = langObj ? langObj.ext : '.txt';
    const filename = title ? (title.includes('.') ? title : `${title}${ext}`) : `snippet${ext}`;
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="my-2 rounded-xl overflow-hidden border border-[#3b4a54] bg-[#0d151a] shadow-lg max-w-full font-mono text-xs">
      {/* Code Header Bar */}
      <div className="bg-[#182229] px-3.5 py-2 flex items-center justify-between border-b border-[#2a3942] select-none">
        <div className="flex items-center gap-2 min-w-0">
          <Terminal className="w-3.5 h-3.5 text-[#00a884] shrink-0" />
          <span className="font-semibold text-[#e9edef] truncate text-xs">
            {title || `Code Snippet`}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-[#202c33] text-[#00a884] text-[10px] font-medium uppercase tracking-wider shrink-0 border border-[#2a3942]">
            {language}
          </span>
          <span className="text-[#8696a0] text-[11px] shrink-0">
            {lineCount.toLocaleString()} {lineCount === 1 ? 'line' : 'lines'}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-2">
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 hover:bg-[#2a3942] text-[#8696a0] hover:text-[#e9edef] rounded-md transition"
            title="Copy code"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#00a884]" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="p-1.5 hover:bg-[#2a3942] text-[#8696a0] hover:text-[#e9edef] rounded-md transition"
            title="Download file"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          {onOpenFullscreen && (
            <button
              type="button"
              onClick={() => onOpenFullscreen({ code, language, title, lineCount })}
              className="p-1.5 hover:bg-[#2a3942] text-[#8696a0] hover:text-[#00a884] rounded-md transition"
              title="Open full-screen IDE viewer (supports 10k lines)"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Code Content Window */}
      <div className="relative overflow-x-auto code-scrollbar max-h-96 bg-[#0b1116] p-3 text-[12px] leading-5">
        <div className="flex">
          {/* Line Numbers Gutter */}
          <div className="select-none text-[#4f5f6b] text-right pr-3 font-mono text-[11px] border-r border-[#1f2c34] shrink-0 min-w-[32px]">
            {Array.from({ length: previewLimit }).map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          {/* Formatted Code Text */}
          <pre className="pl-3 overflow-x-auto m-0 font-mono text-[#e9edef] whitespace-pre tab-4 flex-1">
            <code dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
          </pre>
        </div>
      </div>

      {/* Expand / Overflow Notice for Massive Code */}
      {lineCount > previewLimit && (
        <div className="bg-[#182229] px-4 py-2 border-t border-[#2a3942] flex items-center justify-between text-[11px] text-[#8696a0]">
          <span>
            Showing first {previewLimit} of {lineCount.toLocaleString()} lines
          </span>
          <div className="flex items-center gap-2">
            {!isExpanded && (
              <button
                type="button"
                onClick={() => setIsExpanded(true)}
                className="text-[#00a884] hover:underline font-semibold flex items-center gap-1"
              >
                <ChevronDown className="w-3.5 h-3.5" /> Expand in Chat
              </button>
            )}
            {isExpanded && lineCount > 300 && (
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="text-[#8696a0] hover:text-white font-medium flex items-center gap-1"
              >
                <ChevronUp className="w-3.5 h-3.5" /> Collapse
              </button>
            )}
            {onOpenFullscreen && (
              <button
                type="button"
                onClick={() => onOpenFullscreen({ code, language, title, lineCount })}
                className="bg-[#00a884] hover:bg-[#008f6f] text-white px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 transition shadow"
              >
                <Maximize2 className="w-3 h-3" /> Full View ({lineCount.toLocaleString()} lines)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Modal to Share Large Code Snippets (supports 10,000+ lines)
 */
export const CodeSnippetModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSend: (data: { code: string; language: string; title: string; lineCount: number }) => void;
}> = ({ isOpen, onClose, onSend }) => {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('typescript');
  const [title, setTitle] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const lineCount = useMemo(() => {
    if (!code) return 0;
    return code.split('\n').length;
  }, [code]);

  const charCount = code.length;
  const sizeKb = (new Blob([code]).size / 1024).toFixed(1);

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setCode(text);
      }
    } catch {
      // Fallback
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Support Tab key indenting in code editor
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newCode = code.substring(0, start) + '  ' + code.substring(end);
      setCode(newCode);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    onSend({
      code,
      language,
      title: title.trim() || `snippet.${SUPPORTED_LANGUAGES.find(l => l.id === language)?.ext.replace('.', '') || 'txt'}`,
      lineCount
    });
    setCode('');
    setTitle('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-3 md:p-6 z-50 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[#202c33] w-full max-w-4xl h-[90vh] rounded-2xl border border-[#3b4a54] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="p-4 bg-[#182229] border-b border-[#3b4a54] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#00a884]/20 rounded-lg text-[#00a884]">
              <Code className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#e9edef]">Share Code Snippet</h2>
              <p className="text-xs text-[#8696a0]">Paste from 10 to 10,000+ lines with syntax highlighting</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#8696a0] hover:text-[#e9edef] p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Configuration Bar */}
        <div className="p-3 bg-[#111b21] border-b border-[#3b4a54] grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-semibold text-[#8696a0] uppercase tracking-wider block mb-1">
              File Name / Title
            </label>
            <input
              type="text"
              placeholder="e.g. server.ts, App.tsx, script.py"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#202c33] border border-[#3b4a54] outline-none text-[#e9edef] rounded-lg px-3 py-1.5 text-xs font-mono focus:border-[#00a884]"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#8696a0] uppercase tracking-wider block mb-1">
              Language
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full bg-[#202c33] border border-[#3b4a54] outline-none text-[#e9edef] rounded-lg px-3 py-1.5 text-xs font-mono focus:border-[#00a884]"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.id}>
                  {lang.label} ({lang.ext})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Code Editor Area */}
        <div className="flex-1 relative flex flex-col bg-[#0b1116]">
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`// Paste your code here (supports up to 10,000+ lines)\n// Supports Tab indenting, auto line counting, and formatting\n\nfunction example() {\n  console.log("Hello from ChatWave Code!");\n}`}
            className="w-full h-full bg-transparent text-[#e9edef] font-mono text-[13px] leading-relaxed p-4 outline-none resize-none code-scrollbar border-none"
            spellCheck={false}
          />

          {!code && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <button
                type="button"
                onClick={handlePasteClipboard}
                className="pointer-events-auto bg-[#202c33] hover:bg-[#2a3942] text-[#00a884] border border-[#3b4a54] px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg transition"
              >
                <ClipboardCheck className="w-4 h-4" /> Paste from Clipboard
              </button>
            </div>
          )}
        </div>

        {/* Footer with Stats & Submit */}
        <div className="p-4 bg-[#182229] border-t border-[#3b4a54] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-xs font-mono text-[#8696a0]">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#00a884]" />
              <strong className="text-[#e9edef]">{lineCount.toLocaleString()}</strong> lines
            </span>
            <span>•</span>
            <span>{charCount.toLocaleString()} chars</span>
            <span>•</span>
            <span>{sizeKb} KB</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-[#8696a0] hover:text-[#e9edef] transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!code.trim()}
              className="bg-[#00a884] hover:bg-[#008f6f] disabled:opacity-50 text-white px-5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 shadow-md"
            >
              <Code className="w-4 h-4" /> Send Code Snippet
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

/**
 * Fullscreen IDE-style Code Viewer
 * Capable of smoothly scrolling, searching, and copying 10,000+ lines of code
 */
export const FullscreenCodeModal: React.FC<{
  data: CodeData | null;
  onClose: () => void;
}> = ({ data, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);

  if (!data) return null;

  const lines = data.code.split('\n');
  const lineCount = lines.length;

  const filteredLines = useMemo(() => {
    if (!searchTerm.trim()) return lines;
    const term = searchTerm.toLowerCase();
    return lines.map((line, idx) => ({
      line,
      idx: idx + 1,
      matches: line.toLowerCase().includes(term)
    }));
  }, [lines, searchTerm]);

  const matchCount = useMemo(() => {
    if (!searchTerm.trim()) return 0;
    return lines.filter(l => l.toLowerCase().includes(searchTerm.toLowerCase())).length;
  }, [lines, searchTerm]);

  const highlightedCode = useMemo(() => {
    return highlightCode(data.code, data.language || 'typescript');
  }, [data.code, data.language]);

  const handleCopy = () => {
    navigator.clipboard.writeText(data.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const langObj = SUPPORTED_LANGUAGES.find(l => l.id === data.language);
    const ext = langObj ? langObj.ext : '.txt';
    const filename = data.title ? (data.title.includes('.') ? data.title : `${data.title}${ext}`) : `snippet${ext}`;
    const blob = new Blob([data.code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex flex-col z-[200] backdrop-blur-md">
      {/* Top IDE Toolbar */}
      <div className="bg-[#182229] p-3 border-b border-[#3b4a54] flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-[#00a884]/20 text-[#00a884] rounded-lg">
            <FileCode className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-[#e9edef] text-sm">{data.title || 'Code Snippet'}</h3>
            <p className="text-[11px] text-[#8696a0] font-mono">
              {data.language?.toUpperCase()} • {lineCount.toLocaleString()} lines • {(new Blob([data.code]).size / 1024).toFixed(1)} KB
            </p>
          </div>
        </div>

        {/* Search Bar within code */}
        <div className="flex items-center gap-2 max-w-sm w-full mx-4">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-[#8696a0] absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Find in code..."
              className="w-full bg-[#111b21] border border-[#3b4a54] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#e9edef] outline-none font-mono focus:border-[#00a884]"
            />
            {searchTerm && (
              <span className="absolute right-2.5 top-2 text-[10px] text-[#00a884] font-mono">
                {matchCount} {matchCount === 1 ? 'match' : 'matches'}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 bg-[#202c33] hover:bg-[#2a3942] text-[#e9edef] rounded-lg font-semibold flex items-center gap-1.5 transition border border-[#3b4a54]"
          >
            {copied ? <Check className="w-4 h-4 text-[#00a884]" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied' : 'Copy All'}</span>
          </button>
          <button
            onClick={handleDownload}
            className="px-3 py-1.5 bg-[#202c33] hover:bg-[#2a3942] text-[#e9edef] rounded-lg font-semibold flex items-center gap-1.5 transition border border-[#3b4a54]"
          >
            <Download className="w-4 h-4 text-[#00a884]" />
            <span>Download</span>
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 text-white rounded-lg transition ml-2"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Code Viewer Viewport */}
      <div className="flex-1 overflow-auto code-scrollbar bg-[#0b1116] p-4 text-[13px] leading-6 font-mono">
        <div className="flex min-w-full">
          {/* Line Numbers */}
          <div className="select-none text-[#4f5f6b] text-right pr-4 font-mono border-r border-[#1f2c34] shrink-0 min-w-[48px]">
            {lines.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          {/* Code Text */}
          <pre className="pl-4 m-0 overflow-visible text-[#e9edef] whitespace-pre tab-4 flex-1">
            <code dangerouslySetInnerHTML={{ __html: highlightedCode }} />
          </pre>
        </div>
      </div>
    </div>
  );
};
