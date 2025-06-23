import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon, type ILinkMatcherOptions, type ILinkProvider } from '@xterm/addon-web-links';
import { Terminal as XTerm, type IBufferCell } from '@xterm/xterm';
import { forwardRef, memo, useEffect, useImperativeHandle, useRef } from 'react';
import type { Theme } from '~/lib/stores/theme';
import { createScopedLogger } from '~/utils/logger';
import { getTerminalTheme } from './theme';
import { editorStore } from '~/lib/stores'; // Assuming editorStore is directly importable or use a hook

const logger = createScopedLogger('Terminal');

export interface TerminalRef {
  reloadStyles: () => void;
}

export interface TerminalProps {
  className?: string;
  theme: Theme;
  readonly?: boolean;
  id: string;
  onTerminalReady?: (terminal: XTerm) => void;
  onTerminalResize?: (cols: number, rows: number) => void;
}

// Placeholder: In a real app, this might come from a store or context
// This function simulates opening a file in the editor.
const handleOpenFileRequest = (filePath: string, line?: number, column?: number) => {
  logger.info(`Request to open file: ${filePath}${line ? `:${line}` : ''}${column ? `:${column}` : ''}`);
  editorStore.setSelectedFile(filePath); // Assumes editorStore is available
  if (line !== undefined) {
    // CodeMirror lines are 0-indexed for scroll/selection
    editorStore.updateScrollPosition(filePath, { line: line > 0 ? line - 1 : 0, column: column ? column -1 : 0 });
  }
  // Potentially focus the editor panel as well
  // workbenchStore.setActivePanel('editor'); // Example
};


// Regex to match common file path patterns, including line and column numbers
// Example: /path/to/file.js, /path/to/file.js:10, /path/to/file.js:10:5, ./file.ts:5, src/app.py:12:3
// Does not match URLs like http://, https://
const filePathRegex = /(?<![a-zA-Z0-9])((?:[.\/]|[a-zA-Z0-9._-]+[\\/])+[a-zA-Z0-9._-]+\.[a-zA-Z]{1,6})(?:[:#](\d+))?(?:[:#](\d+))?/g;


class FileLinkProvider implements ILinkProvider {
  constructor(private _terminal: XTerm) {}

  public provideLinks(bufferLineNumber: number, callback: (links: TerminalLink[] | undefined) => void): void {
    const lineText = this._terminal.buffer.active.getLine(bufferLineNumber - 1)?.translateToString(true);
    if (!lineText) {
      callback(undefined);
      return;
    }

    const links: TerminalLink[] = [];
    let match;
    filePathRegex.lastIndex = 0; // Reset regex state

    while ((match = filePathRegex.exec(lineText)) !== null) {
      const filePath = match[1];
      const line = match[2] ? parseInt(match[2], 10) : undefined;
      const col = match[3] ? parseInt(match[3], 10) : undefined;

      // Basic validation to filter out unlikely paths (e.g. very short, or looks like a version number)
      if (filePath.length < 3 || filePath.startsWith('http')) continue;
      // Avoid matching parts of other URLs if webLinksAddon is also aggressive
      if (lineText.substring(0, match.index).match(/https?:\/\//)) continue;


      const range = {
        start: { x: match.index + 1, y: bufferLineNumber },
        end: { x: match.index + match[0].length, y: bufferLineNumber },
      };

      links.push({
        text: match[0], // The full matched string
        range,
        activate: () => handleOpenFileRequest(filePath, line, col),
        hover: (event: MouseEvent, text: string) => {
          // Optional: Show a tooltip or change cursor
          (event.target as HTMLElement).style.textDecoration = 'underline';
        },
        leave: (event: MouseEvent, text: string) => {
           (event.target as HTMLElement).style.textDecoration = '';
        }
      });
    }
    callback(links.length > 0 ? links : undefined);
  }
}

// Helper interface for TerminalLink structure (simplified from ILink)
interface TerminalLink {
  text: string;
  range: { start: { x: number; y: number }; end: { x: number; y: number } };
  activate: (event?: MouseEvent, text?: string) => void;
  hover?: (event: MouseEvent, text: string) => void;
  leave?: (event: MouseEvent, text: string) => void;
}


export const Terminal = memo(
  forwardRef<TerminalRef, TerminalProps>(
    ({ className, theme, readonly, id, onTerminalReady, onTerminalResize }, ref) => {
      const terminalElementRef = useRef<HTMLDivElement>(null);
      const terminalRef = useRef<XTerm>();

      useEffect(() => {
        const element = terminalElementRef.current!;

        const fitAddon = new FitAddon();

        const terminal = new XTerm({
          cursorBlink: true,
          convertEol: true,
          disableStdin: readonly,
          theme: getTerminalTheme(readonly ? { cursor: '#00000000' } : {}),
          fontSize: 11,
          fontFamily: 'Menlo, courier-new, courier, monospace',
          allowProposedApi: true,
        });
        terminalRef.current = terminal;

        // Register custom link provider for file paths
        // WebLinksAddon will still handle http/https links by default
        const fileLinkProvider = new FileLinkProvider(terminal);
        const webLinksAddon = new WebLinksAddon(undefined, undefined, { // handler, matcherOptions, options
          // urlRegex is used by default WebLinksAddon, keep it for http/s links
          // We add our provider, it should be prioritized or work alongside
          // The WebLinksAddon API for multiple providers is a bit implicit.
          // Often, custom providers are registered directly on the terminal instance if the addon doesn't merge.
          // Let's try registering it directly as a link provider on the terminal.
        });


        terminal.loadAddon(fitAddon);
        terminal.loadAddon(webLinksAddon); // Load standard web links first

        // Register custom file link provider
        // XTerm's API allows multiple link providers.
        // The `registerLinkProvider` returns an IDisposable to unregister.
        const fileLinkProviderDisposable = terminal.registerLinkProvider(fileLinkProvider);


        terminal.onBell(() => {
          const originalBg = terminal.options.theme?.background;
          terminal.options.theme = { ...terminal.options.theme, background: '#FFA500' };
          setTimeout(() => {
            terminal.options.theme = { ...terminal.options.theme, background: originalBg };
          }, 150);
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          if (audioContext) {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.1);
          }
          if (navigator.vibrate) {
            navigator.vibrate(100);
          }
        });

        terminal.open(element);

        const resizeObserver = new ResizeObserver(() => {
          fitAddon.fit();
          onTerminalResize?.(terminal.cols, terminal.rows);
        });
        resizeObserver.observe(element);
        logger.debug(`Attach [${id}]`);
        onTerminalReady?.(terminal);

        return () => {
          resizeObserver.disconnect();
          fileLinkProviderDisposable.dispose(); // Dispose custom link provider
          terminal.dispose();
        };
      }, [id, onTerminalReady, onTerminalResize, readonly]);

      useEffect(() => {
        const terminal = terminalRef.current!;
        terminal.options.theme = getTerminalTheme(readonly ? { cursor: '#00000000' } : {});
        terminal.options.disableStdin = readonly;
      }, [theme, readonly]);

      useImperativeHandle(ref, () => {
        return {
          reloadStyles: () => {
            const terminal = terminalRef.current!;
            terminal.options.theme = getTerminalTheme(readonly ? { cursor: '#00000000' } : {});
          },
        };
      }, []);

      return <div className={className} ref={terminalElementRef} />;
    },
  ),
);
