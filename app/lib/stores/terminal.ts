import type { WebContainer, WebContainerProcess } from '@webcontainer/api';
import { atom, type WritableAtom } from 'nanostores';
import type { ITerminal } from '~/types/terminal';
import { newBoltShellProcess, newShellProcess } from '~/utils/shell';
import { coloredText } from '~/utils/terminal';

export class TerminalStore {
  #webcontainer: Promise<WebContainer>;
  #terminals: Array<{ terminal: ITerminal; process: WebContainerProcess }> = [];
  #boltTerminal = newBoltShellProcess();

  showTerminal: WritableAtom<boolean> = import.meta.hot?.data.showTerminal ?? atom(true);

  constructor(webcontainerPromise: Promise<WebContainer>) {
    this.#webcontainer = webcontainerPromise;

    if (import.meta.hot) {
      import.meta.hot.data.showTerminal = this.showTerminal;
    }
  }
  get boltTerminal() {
    return this.#boltTerminal;
  }

  toggleTerminal(value?: boolean) {
    this.showTerminal.set(value !== undefined ? value : !this.showTerminal.get());
  }

  #writeExecutionTimeToTerminal(terminal: ITerminal, startTime: number) {
    const endTime = performance.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    // Using ANSI escape codes for subtle color, adjust as needed for theme
    const timeMessage = `\n\x1b[90m(Command completed in ${duration}s)\x1b[0m\n`;
    terminal.write(timeMessage);
  }

  async attachBoltTerminal(terminal: ITerminal) {
    try {
      const wc = await this.#webcontainer;
      // Wrap the original terminal.write to intercept command completion or output patterns
      const originalWrite = terminal.write.bind(terminal);
      let commandStartTime = 0;

      terminal.write = (data: string | Uint8Array) => {
        originalWrite(data);
        // This is a heuristic: look for prompt-like patterns to detect command end.
        // A more robust solution would involve shell-specific knowledge or process exit signals.
        if (typeof data === 'string' && (data.includes('$ ') || data.includes('# '))) { // Common prompts
          if (commandStartTime > 0) {
            this.#writeExecutionTimeToTerminal(terminal, commandStartTime);
            commandStartTime = 0; // Reset for next command
          }
        }
      };

      // It's tricky to know when a command *starts* just from `attach`.
      // We'll assume a command starts after an input is sent.
      // This requires modifying how input is handled or having the shell process signal it.
      // For now, we'll mark start time when input is likely sent (e.g., after user types Enter).
      // This part is more conceptual for `attachBoltTerminal` as input is handled by `BoltShellProcess`.
      // A more direct integration would be needed in `BoltShellProcess.ts` or `newShellProcess`.

      await this.#boltTerminal.init(wc, terminal);
      // Conceptual: if boltTerminal had an onInputCommand hook:
      // this.#boltTerminal.onInputCommand = () => { commandStartTime = performance.now(); };

    } catch (error: any) {
      terminal.write(coloredText.red('Failed to spawn bolt shell\n\n') + error.message);
      return;
    }
  }

  async attachTerminal(terminal: ITerminal) {
    try {
      const shellProcess = await newShellProcess(await this.#webcontainer, terminal);
      let commandStartTime = 0;

      // Monkey-patch the input stream of the process to detect when a command is likely starting
      const originalInputWriter = shellProcess.input.getWriter();
      const newPipe = new WritableStream({
        write: async (chunk) => {
          if (commandStartTime === 0) { // Assume new command is starting
             commandStartTime = performance.now();
          }
          await originalInputWriter.write(chunk);
          if (typeof chunk === 'string' && chunk.includes('\r')) { // Typically Enter key
            // The command has been submitted. Time will be written when output appears.
          }
        },
        close: () => originalInputWriter.close(),
        abort: (reason) => originalInputWriter.abort(reason),
      });
      (shellProcess as any).input = newPipe; // Overwrite input, might be risky if type is strict

      // Monitor output for prompt to print time
      const originalOutputReader = shellProcess.output.getReader();
      const newOutputPipe = new ReadableStream({
        async start(controller) {
          while(true) {
            const { value, done } = await originalOutputReader.read();
            if (done) {
              controller.close();
              break;
            }
            controller.enqueue(value); // Pass data through
            if (typeof value === 'string' && (value.includes('$ ') || value.includes('# '))) {
              if (commandStartTime > 0) {
                // Need to write to the *terminal*, not the process output controller
                this.#writeExecutionTimeToTerminal(terminal, commandStartTime);
                commandStartTime = 0;
              }
            }
          }
        }
      });
      (shellProcess as any).output = newOutputPipe; // Overwrite output


      this.#terminals.push({ terminal, process: shellProcess });
    } catch (error: any) {
      terminal.write(coloredText.red('Failed to spawn shell\n\n') + error.message);
      return;
    }
  }

  onTerminalResize(cols: number, rows: number) {
    for (const { process } of this.#terminals) {
      process.resize({ cols, rows });
    }
  }
}
