import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal as XTerm } from '@xterm/xterm';
import { forwardRef, memo, useEffect, useImperativeHandle, useRef } from 'react';
import type { Theme } from '~/lib/stores/theme';
import { createScopedLogger } from '~/utils/logger';
import { getTerminalTheme } from './theme';

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

export const Terminal = memo(
  forwardRef<TerminalRef, TerminalProps>(
    ({ className, theme, readonly, id, onTerminalReady, onTerminalResize }, ref) => {
      const terminalElementRef = useRef<HTMLDivElement>(null);
      const terminalRef = useRef<XTerm>();

      useEffect(() => {
        const element = terminalElementRef.current!;

        const fitAddon = new FitAddon();
        const webLinksAddon = new WebLinksAddon();

        const terminal = new XTerm({
          cursorBlink: true,
          convertEol: true,
          disableStdin: readonly,
          theme: getTerminalTheme(readonly ? { cursor: '#00000000' } : {}),
          fontSize: 11, // Slightly reduced font size for small screens
          fontFamily: 'Menlo, courier-new, courier, monospace',
          allowProposedApi: true, // Required for bell and other advanced features
        });

        terminalRef.current = terminal;

        terminal.loadAddon(fitAddon);
        terminal.loadAddon(webLinksAddon);

        /*
         * --- Terminal Enhancements ---
         * 1. Bell Sound and Visual Notification (Vibration can be added if context allows)
         */
        terminal.onBell(() => {
          // Simple visual bell: flash the terminal background
          const originalBg = terminal.options.theme?.background;
          terminal.options.theme = { ...terminal.options.theme, background: '#FFA500' }; // Orange flash
          setTimeout(() => {
            terminal.options.theme = { ...terminal.options.theme, background: originalBg };
          }, 150);

          // Play a sound (requires user interaction first in most browsers)
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          if (audioContext) {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4 note
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime); // Low volume
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.1);
          }

          // Vibration (if supported and permitted)
          if (navigator.vibrate) {
            navigator.vibrate(100); // Vibrate for 100ms
          }
        });
        // --- End Terminal Enhancements ---

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
          terminal.dispose();
        };
      }, [id, onTerminalReady, onTerminalResize, readonly]); // Added dependencies

      useEffect(() => {
        const terminal = terminalRef.current!;

        // We render a transparent cursor in case the terminal is readonly
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
