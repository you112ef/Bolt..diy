import { memo, useEffect, useState } from 'react';
import { bundledLanguages, codeToHtml, isSpecialLang, type BundledLanguage, type SpecialLanguage } from 'shiki';
import { classNames } from '~/utils/classNames';
import { createScopedLogger } from '~/utils/logger';
import { workbenchStore } from '~/lib/stores/workbench'; // Added for terminal interaction
import styles from './CodeBlock.module.scss';

const logger = createScopedLogger('CodeBlock');

const SHELL_LANGUAGES = ['bash', 'sh', 'shell', 'zsh', 'powershell', 'cmd', 'terminal', 'console', 'text']; // Added 'text' as a fallback
const COMMON_SHELL_COMMANDS_START = [
  'npm', 'pnpm', 'yarn', 'bun', 'node', 'python', 'php', 'ruby', 'go ', 'rustc', 'gcc', 'g++', 'java ', 'javac',
  'cd ', 'ls', 'mkdir', 'rm ', 'cp ', 'mv ', 'git ', 'docker ', 'kubectl ', 'echo ', 'cat ', 'grep ',
  'awk', 'sed', 'curl ', 'wget ', 'ping ', 'ssh ', './', // Common execution prefix
];

function isShellCommand(lang?: string, codeContent?: string): boolean {
  const normalizedLang = lang?.toLowerCase();
  if (normalizedLang && SHELL_LANGUAGES.includes(normalizedLang)) {
    return true;
  }
  if (codeContent) {
    const firstLine = codeContent.trim().split('\n')[0].trim();
    // Check if the first line itself is a common command or starts with one
    if (COMMON_SHELL_COMMANDS_START.some(cmd => firstLine.startsWith(cmd) || firstLine === cmd.trim())) {
      return true;
    }
    // If language is plaintext or not specified, be more lenient with command detection
    if (!normalizedLang || normalizedLang === 'plaintext' || normalizedLang === 'text') {
        if (firstLine.length > 0 && !firstLine.includes(' ') && firstLine.match(/^[a-zA-Z0-9._-]+$/)) {
             // Simple heuristic: if it's a single word, could be a command
            if(COMMON_SHELL_COMMANDS_START.some(cmd => firstLine === cmd.trim())) return true;
        }
        // Avoid treating multi-line generic text as commands unless very sure
        if (firstLine.includes(' ') && firstLine.length < 80) { // Arbitrary length to avoid long text
             if (COMMON_SHELL_COMMANDS_START.some(cmd => firstLine.startsWith(cmd))) return true;
        }
    }
  }
  return false;
}

interface CodeBlockProps {
  className?: string;
  code: string;
  language?: BundledLanguage | SpecialLanguage;
  theme?: 'light-plus' | 'dark-plus';
  disableCopy?: boolean;
}

export const CodeBlock = memo(
  ({ className, code, language = 'plaintext', theme = 'dark-plus', disableCopy = false }: CodeBlockProps) => {
    const [html, setHTML] = useState<string | undefined>(undefined);
    const [copied, setCopied] = useState(false);
    const canRunInTerminal = useMemo(() => isShellCommand(language, code), [language, code]);

    const copyToClipboard = () => {
      if (copied) {
        return;
      }

      navigator.clipboard.writeText(code);

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    };

    useEffect(() => {
      let effectiveLanguage = language;

      if (language && !isSpecialLang(language) && !(language in bundledLanguages)) {
        logger.warn(`Unsupported language '${language}', falling back to plaintext`);
        effectiveLanguage = 'plaintext';
      }

      logger.trace(`Language = ${effectiveLanguage}`);

      const processCode = async () => {
        setHTML(await codeToHtml(code, { lang: effectiveLanguage, theme }));
      };

      processCode();
    }, [code, language, theme]);

    return (
      <div className={classNames('relative group text-left', className)}>
        <div
          className={classNames(
            styles.CopyButtonContainer,
            'bg-transparant absolute top-[10px] right-[10px] rounded-md z-10 text-lg flex items-center justify-center opacity-0 group-hover:opacity-100',
            {
              'rounded-l-0 opacity-100': copied,
            },
          )}
        >
          {!disableCopy && (
            <button
              className={classNames(
                'flex items-center bg-accent-500 p-[6px] justify-center before:bg-white before:rounded-l-md before:text-gray-500 before:border-r before:border-gray-300 rounded-md transition-theme',
                {
                  'before:opacity-0': !copied,
                  'before:opacity-100': copied,
                },
              )}
              title="Copy Code"
              onClick={() => copyToClipboard()}
            >
              <div className="i-ph:clipboard-text-duotone"></div>
            </button>
          )}
          {canRunInTerminal && (
            <button
              className={classNames(
                'flex items-center bg-blue-500 p-[6px] justify-center text-white rounded-md transition-colors hover:bg-blue-600 ml-1.5',
              )}
              title="Run in Terminal"
              onClick={() => {
                const terminal = workbenchStore.boltTerminal.get(); // Or get active/focused terminal
                if (terminal) {
                  // Ensure terminal is visible
                  if (!workbenchStore.showTerminal.get()) {
                    workbenchStore.toggleTerminal(true);
                  }
                  // Focus the terminal tab if multiple (logic depends on TerminalTabs implementation)
                  // For simplicity, we assume boltTerminal is the primary one to use here.

                  terminal.sendText(code + '\n'); // Send the code and a newline to execute
                  terminal.focus();
                } else {
                  alert('Terminal is not available or ready.');
                }
              }}
            >
              <div className="i-ph:terminal-window-duotone"></div>
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <div dangerouslySetInnerHTML={{ __html: html ?? '' }}></div>
        </div>
      </div>
    );
  },
);
