const reset = '\x1b[0m';
const bold = '\x1b[1m';

export const escapeCodes = {
  reset,
  clear: '\x1b[g', // Clear screen
  // Basic Colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  // Bright Colors
  brightBlack: '\x1b[90m', // Often used for gray
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
  // Styles
  bold: bold,
  dim: '\x1b[2m',
  underline: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m', // Swaps foreground and background
  hidden: '\x1b[8m',
};

export const coloredText = {
  black: (text: string) => `${escapeCodes.black}${text}${reset}`,
  red: (text: string) => `${escapeCodes.red}${text}${reset}`,
  green: (text: string) => `${escapeCodes.green}${text}${reset}`,
  yellow: (text: string) => `${escapeCodes.yellow}${text}${reset}`,
  blue: (text: string) => `${escapeCodes.blue}${text}${reset}`,
  magenta: (text: string) => `${escapeCodes.magenta}${text}${reset}`,
  cyan: (text: string) => `${escapeCodes.cyan}${text}${reset}`,
  white: (text: string) => `${escapeCodes.white}${text}${reset}`,
  gray: (text: string) => `${escapeCodes.brightBlack}${text}${reset}`, // Using brightBlack for gray

  brightRed: (text: string) => `${escapeCodes.brightRed}${text}${reset}`,
  brightGreen: (text: string) => `${escapeCodes.brightGreen}${text}${reset}`,
  brightYellow: (text: string) => `${escapeCodes.brightYellow}${text}${reset}`,
  brightBlue: (text: string) => `${escapeCodes.brightBlue}${text}${reset}`,
  brightMagenta: (text: string) => `${escapeCodes.brightMagenta}${text}${reset}`,
  brightCyan: (text: string) => `${escapeCodes.brightCyan}${text}${reset}`,
  brightWhite: (text: string) => `${escapeCodes.brightWhite}${text}${reset}`,

  bold: (text: string) => `${escapeCodes.bold}${text}${reset}`,
  dim: (text: string) => `${escapeCodes.dim}${text}${reset}`,
  underline: (text: string) => `${escapeCodes.underline}${text}${reset}`,
};

/**
 * Applies intelligent coloring to terminal output based on keywords.
 * This is a basic implementation and can be expanded.
 * @param text The text to colorize.
 * @returns The colorized text.
 */
export function applyIntelligentColoring(text: string): string {
  let coloredOutput = text;

  // Highlight common errors in red
  coloredOutput = coloredOutput.replace(/(?<!\w)(error|Error|ERR!|failed|Failed|failure|Failure)(?!\w)/g, coloredText.red('$1'));

  // Highlight common warnings in yellow
  coloredOutput = coloredOutput.replace(/(?<!\w)(warning|Warning|WARN)(?!\w)/g, coloredText.yellow('$1'));

  // Highlight "success" or "Success" in green
  coloredOutput = coloredOutput.replace(/(?<!\w)(success|Success|successful|Successful|completed|Completed)(?!\w)/g, coloredText.green('$1'));

  // Highlight npm and bun commands if they appear at the start of a line or after whitespace
  coloredOutput = coloredOutput.replace(/^(\s*)(npm|bun)(\s+.*)/gm, `$1${coloredText.cyan('$2')}$3`);

  // Highlight common commands like git, node, python, docker, etc.
  coloredOutput = coloredOutput.replace(/^(\s*)(git|node|python|docker|pnpm|yarn|make)(\s+.*)/gm, `$1${coloredText.brightCyan('$2')}$3`);

  // Highlight URLs (basic) - ensure it doesn't mess with other ANSI codes if they exist in URL-like strings
  // This regex is very basic and might need refinement.
  coloredOutput = coloredOutput.replace(/(https?:\/\/[^\s\x1b]+)/g, (match) => {
    // Avoid double-coloring if it's already part of an ANSI sequence (simple check)
    if (match.includes('\x1b[')) return match;
    return coloredText.blue(coloredText.underline(match));
  });

  // Highlight numbers that stand alone or are part of common patterns (e.g., version numbers, sizes)
  // This regex is made more specific to avoid coloring parts of ANSI codes or hashes.
  // Matches numbers that are:
  // - preceded by space, start of line, '(', '[', or ':'
  // - followed by space, end of line, ')', ']', '%', 's' (for seconds), 'ms', 'px', 'em', 'rem', 'vh', 'vw'
  coloredOutput = coloredOutput.replace(/(^|\s|\[|\(|[:=])(\d+(?:\.\d+)?)(%|s|ms|px|em|rem|vh|vw|\s|$|\]|\))/g, (match, p1, p2, p3) => {
    return `${p1}${coloredText.magenta(p2)}${p3}`;
  });

  // Highlight "true" and "false"
  coloredOutput = coloredOutput.replace(/(?<!\w)(true|True)(?!\w)/g, coloredText.green('$1'));
  coloredOutput = coloredOutput.replace(/(?<!\w)(false|False)(?!\w)/g, coloredText.red('$1'));

  // Highlight null and undefined
  coloredOutput = coloredOutput.replace(/(?<!\w)(null|undefined)(?!\w)/g, coloredText.gray(coloredText.dim('$1')));

  return coloredOutput;
}
