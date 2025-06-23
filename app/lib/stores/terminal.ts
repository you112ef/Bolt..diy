import type { WebContainer, WebContainerProcess } from '@webcontainer/api';
import { atom, type WritableAtom } from 'nanostores';
import type { ITerminal } from '~/types/terminal';
import { newBoltShellProcess, newShellProcess } from '~/utils/shell';
import { coloredText, applyIntelligentColoring } from '~/utils/terminal';
import { notificationService } from '~/lib/services/notificationService'; // Import notification service

export class TerminalStore {
  #webcontainer: Promise<WebContainer>;
  #terminals: Array<{
    id: string,
    terminal: ITerminal;
    process: WebContainerProcess,
    commandStartTime: number,
    currentCommand: string, // To store the command being executed
  }> = [];
  #boltTerminal = newBoltShellProcess();

  showTerminal: WritableAtom<boolean> = import.meta.hot?.data.showTerminal ?? atom(true);

  constructor(webcontainerPromise: Promise<WebContainer>) {
    this.#webcontainer = webcontainerPromise;
    if (import.meta.hot) {
      import.meta.hot.data.showTerminal = this.showTerminal;
    }
    // Ensure notification permission on startup or when relevant
    // notificationService.ensurePermission(); // Can be called here or before first notification
  }

  get boltTerminal() {
    return this.#boltTerminal;
  }

  toggleTerminal(value?: boolean) {
    this.showTerminal.set(value !== undefined ? value : !this.showTerminal.get());
  }

  #writeExecutionTimeToTerminal(terminal: ITerminal, startTime: number) {
    if (startTime === 0) return;
    const endTime = performance.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    const timeMessage = `\r\n\x1b[2m\x1b[90m(Command completed in ${duration}s)\x1b[0m\r\n`;
    terminal.write(timeMessage);
  }

  async #preCommandCheck(wc: WebContainer, command: string, terminal: ITerminal): Promise<boolean> {
    const firstWord = command.split(' ')[0];
    if (firstWord === 'npm' || firstWord === 'bun') {
      try {
        const checkProcess = await wc.spawn('which', [firstWord]);
        const { exitCode } = await checkProcess.exit;
        if (exitCode !== 0) {
          terminal.write(coloredText.yellow(`\r\nWarning: '${firstWord}' command not found. Ensure it's installed.\r\n`));
          return true; // Allow execution attempt, but warn
        }
      } catch (e) {
        terminal.write(coloredText.yellow(`\r\nWarning: Could not verify '${firstWord}'. It might not be installed.\r\n`));
        return true;
      }
    }
    return true;
  }

  async attachBoltTerminal(terminal: ITerminal) {
    // Bolt terminal might have its own notification logic tied to AI interactions.
    // For now, focusing on user-executed commands in regular terminals.
    // If Bolt terminal also executes general commands, similar logic would apply.
    try {
      const wc = await this.#webcontainer;
      const originalWrite = terminal.write.bind(terminal);
      terminal.write = (data: string | Uint8Array) => {
        originalWrite(typeof data === 'string' ? applyIntelligentColoring(data) : data);
      };
      await this.#boltTerminal.init(wc, terminal);
      terminal.write("Bolt Terminal Initialized.\r\n");
    } catch (error: any) {
      terminal.write(coloredText.red('Failed to spawn bolt shell\n\n') + error.message);
    }
  }

  async attachTerminal(terminal: ITerminal, terminalId: string) {
    try {
      const wc = await this.#webcontainer;
      // Use a temporary variable to build up the command before Enter
      let currentCommandInput = '';
      const shellProcess = await newShellProcess(wc, terminal);

      const terminalEntry = {
        id: terminalId,
        terminal,
        process: shellProcess,
        commandStartTime: 0,
        currentCommand: '',
      };
      this.#terminals.push(terminalEntry);

      terminal.onData(async (data) => {
        shellProcess.input.write(data);
        if (data === '\r') { // Enter key
          if (currentCommandInput.trim().length > 0) {
            terminalEntry.currentCommand = currentCommandInput.trim();
            terminalEntry.commandStartTime = performance.now();
            await this.#preCommandCheck(wc, terminalEntry.currentCommand, terminal);
          }
          currentCommandInput = ''; // Reset for next command
        } else if (data === '\x7f') { // Backspace
            currentCommandInput = currentCommandInput.slice(0, -1);
        } else if (typeof data === 'string' && !data.startsWith('\x1b')) { // Ignore escape sequences
            currentCommandInput += data;
        }
      });

      (async () => {
        let processExited = false;
        shellProcess.exit.then(exitCode => {
          processExited = true;
          if (terminalEntry.commandStartTime > 0) {
            this.#writeExecutionTimeToTerminal(terminal, terminalEntry.commandStartTime);
          }
          const notifType = exitCode === 0 ? 'success' : 'error';
          const title = `Command ${exitCode === 0 ? 'Succeeded' : 'Failed'}`;
          const body = `Command: "${terminalEntry.currentCommand}" exited with code ${exitCode}.`;

          notificationService.showNotification({ title, body, type: notifType });

          terminal.write(coloredText.yellow(`\r\nShell process for "${terminalEntry.currentCommand}" exited (code ${exitCode}).\r\n`));
          terminalEntry.commandStartTime = 0;
          terminalEntry.currentCommand = '';

          // Prompt for new command or indicate closure
          // This might be automatically handled by the shell restarting or xterm.js prompt
        }).catch(err => {
            processExited = true;
            console.error("Error awaiting shell process exit:", err);
            notificationService.showNotification({ title: "Shell Process Error", body: `Error with command: ${terminalEntry.currentCommand}`, type: 'error'});
        });

        for await (const outputChunk of shellProcess.output) {
          const processedOutput = applyIntelligentColoring(outputChunk);
          terminal.write(processedOutput);

          // Heuristic for prompt display (simplified)
          if (typeof processedOutput === 'string' && (processedOutput.includes('$ ') || processedOutput.includes('~# ') || processedOutput.includes('❯ '))) {
            if (terminalEntry.commandStartTime > 0 && !processExited) { // If command was running and process hasn't formally exited via promise
              // This part is tricky because a prompt might appear before exit code is processed.
              // The exit.then block is more reliable for final notification.
              // This could be a place for intermediate status, or just rely on exit.
            }
          }
        }
      })();
    } catch (error: any) {
      terminal.write(coloredText.red('Failed to spawn shell\n\n') + error.message);
      notificationService.showNotification({ title: 'Shell Error', body: 'Failed to spawn shell process.', type: 'error' });
    }
  }

  onTerminalResize(cols: number, rows: number) {
    for (const { process } of this.#terminals) {
      if (process && typeof process.resize === 'function') {
         process.resize({ cols, rows });
      }
    }
    // if (this.#boltTerminal && (this.#boltTerminal as any).resize) {
    //   (this.#boltTerminal as any).resize({cols, rows});
    // }
  }

  getProcessForTerminal(terminalId: string): WebContainerProcess | undefined {
    return this.#terminals.find(t => t.id === terminalId)?.process;
  }

  disposeTerminal(terminalId: string) {
    const termIndex = this.#terminals.findIndex(t => t.id === terminalId);
    if (termIndex !== -1) {
      const { process, terminal } = this.#terminals[termIndex];
      try {
        process.kill();
        terminal.dispose();
      } catch (e) {
        console.warn(`Error disposing terminal ${terminalId}:`, e);
      }
      this.#terminals.splice(termIndex, 1);
    }
  }
}
