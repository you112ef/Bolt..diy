import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { createDataStream, generateId, type Message as VercelAIMessage } from 'ai'; // Renamed Message to VercelAIMessage

import { CONTINUE_PROMPT } from '~/lib/common/prompts/prompts';
import { createSummary } from '~/lib/.server/llm/create-summary';
import { MAX_RESPONSE_SEGMENTS, MAX_TOKENS, type FileMap } from '~/lib/.server/llm/constants';
import { getFilePaths, selectContext } from '~/lib/.server/llm/select-context';
import SwitchableStream from '~/lib/.server/llm/switchable-stream';
import { streamText, type Messages as StreamTextMessages, type StreamingOptions } from '~/lib/.server/llm/stream-text'; // Renamed Messages to StreamTextMessages
import { extractPropertiesFromMessage } from '~/lib/.server/llm/utils';
import type { ContextAnnotation, ProgressAnnotation } from '~/types/context';
import type { DesignScheme } from '~/types/design-scheme';
import type { IProviderSetting } from '~/types/model';
import { WORK_DIR } from '~/utils/constants';
import { createScopedLogger } from '~/utils/logger';

export async function action(args: ActionFunctionArgs) {
  return chatAction(args);
}

const logger = createScopedLogger('api.chat');

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  const items = cookieHeader.split(';').map((cookie) => cookie.trim());

  items.forEach((item) => {
    const [name, ...rest] = item.split('=');

    if (name && rest) {
      const decodedName = decodeURIComponent(name.trim());
      const decodedValue = decodeURIComponent(rest.join('=').trim());
      cookies[decodedName] = decodedValue;
    }
  });

  return cookies;
}

async function chatAction({ context, request }: ActionFunctionArgs) {
  const {
    messages: requestMessages, // Renamed to avoid conflict with VercelAIMessage
    files,
    promptId,
    contextOptimization,
    supabase,
    chatMode,
    designScheme,
    activeEditorFile,
    activeEditorContent,
  } = await request.json<{
    messages: StreamTextMessages; // Use the aliased type
    files: any;
    promptId?: string;
    contextOptimization: boolean;
    chatMode: 'discuss' | 'build';
    designScheme?: DesignScheme;
    suggestions?: boolean;
    webSearch?: boolean;
    webScrape?: boolean;
    imageSearch?: boolean;
    activeEditorFile?: string;
    activeEditorContent?: string;
    supabase?: {
      isConnected: boolean;
      hasSelectedProject: boolean;
      credentials?: {
        anonKey?: string;
        supabaseUrl?: string;
      };
    };
  }>();

  // Ensure messages is mutable for potential prepending
  const messages: StreamTextMessages = [...requestMessages];


  const cookieHeader = request.headers.get('Cookie');
  // Allow anonymous access if apiKeys cookie is not present or empty
  const apiKeysCookie = parseCookies(cookieHeader || '').apiKeys;
  const apiKeys = apiKeysCookie && apiKeysCookie !== '{}' ? JSON.parse(apiKeysCookie) : {};
  const providerSettings: Record<string, IProviderSetting> = JSON.parse(
    parseCookies(cookieHeader || '').providers || '{}',
  );

  const stream = new SwitchableStream();

  const cumulativeUsage = {
    completionTokens: 0,
    promptTokens: 0,
    totalTokens: 0,
  };
  const encoder: TextEncoder = new TextEncoder();
  let progressCounter: number = 1;

  // Access same.new functions from context
  const sameNew = context.cloudflare.env.sameNew as any;

  try {
    const totalMessageContent = messages.reduce((acc, message) => acc + (message.content || ''), '');
    logger.debug(`Total message length: ${totalMessageContent.split(' ').length} words`);

    let lastChunk: string | undefined;

    const dataStream = createDataStream({
      async execute(currentDataStream) { // Renamed dataStream to currentDataStream
        const filePaths = getFilePaths(files || {});
        let filteredFiles: FileMap | undefined;
        let summary: string | undefined;
        let messageSliceId = 0;

        if (messages.length > 3) {
          messageSliceId = messages.length - 3;
        }

        if (filePaths.length > 0 && contextOptimization) {
          logger.debug('Generating Chat Summary');
          currentDataStream.writeData({
            type: 'progress',
            label: 'summary',
            status: 'in-progress',
            order: progressCounter++,
            message: 'Analysing Request',
          } satisfies ProgressAnnotation);

          // Create a summary of the chat
          console.log(`Messages count: ${messages.length}`);

          summary = await createSummary({
            messages: [...messages],
            env: context.cloudflare?.env,
            apiKeys,
            providerSettings,
            promptId,
            contextOptimization,
            onFinish(resp) {
              if (resp.usage) {
                logger.debug('createSummary token usage', JSON.stringify(resp.usage));
                cumulativeUsage.completionTokens += resp.usage.completionTokens || 0;
                cumulativeUsage.promptTokens += resp.usage.promptTokens || 0;
                cumulativeUsage.totalTokens += resp.usage.totalTokens || 0;
              }
            },
          });
          currentDataStream.writeData({
            type: 'progress',
            label: 'summary',
            status: 'complete',
            order: progressCounter++,
            message: 'Analysis Complete',
          } satisfies ProgressAnnotation);

          currentDataStream.writeMessageAnnotation({
            type: 'chatSummary',
            summary,
            chatId: messages.slice(-1)?.[0]?.id,
          } as ContextAnnotation);

          // Update context buffer
          logger.debug('Updating Context Buffer');
          currentDataStream.writeData({
            type: 'progress',
            label: 'context',
            status: 'in-progress',
            order: progressCounter++,
            message: 'Determining Files to Read',
          } satisfies ProgressAnnotation);

          // Select context files
          console.log(`Messages count: ${messages.length}`);
          filteredFiles = await selectContext({
            messages: [...messages],
            env: context.cloudflare?.env,
            apiKeys,
            files,
            providerSettings,
            promptId,
            contextOptimization,
            summary,
            onFinish(resp) {
              if (resp.usage) {
                logger.debug('selectContext token usage', JSON.stringify(resp.usage));
                cumulativeUsage.completionTokens += resp.usage.completionTokens || 0;
                cumulativeUsage.promptTokens += resp.usage.promptTokens || 0;
                cumulativeUsage.totalTokens += resp.usage.totalTokens || 0;
              }
            },
          });

          if (filteredFiles) {
            logger.debug(`files in context : ${JSON.stringify(Object.keys(filteredFiles))}`);
          }

          currentDataStream.writeMessageAnnotation({
            type: 'codeContext',
            files: Object.keys(filteredFiles || {}).map((key) => { // Added || {} for safety
              let filePath = key; // Renamed path to filePath

              if (filePath.startsWith(WORK_DIR)) {
                filePath = filePath.replace(WORK_DIR, '');
              }

              return filePath;
            }),
          } as ContextAnnotation);

          currentDataStream.writeData({
            type: 'progress',
            label: 'context',
            status: 'complete',
            order: progressCounter++,
            message: 'Code Files Selected',
          } satisfies ProgressAnnotation);
        }

        const currentRequest = request.clone(); // Clone the request to access body again if needed
        const requestBody = await currentRequest.json();


        const options: StreamingOptions = {
          supabaseConnection: supabase,
          toolChoice: 'none',
          onFinish: async ({ text: content, finishReason, usage }) => {
            logger.debug('usage', JSON.stringify(usage));

            if (usage) {
              cumulativeUsage.completionTokens += usage.completionTokens || 0;
              cumulativeUsage.promptTokens += usage.promptTokens || 0;
              cumulativeUsage.totalTokens += usage.totalTokens || 0;
            }

            if (finishReason !== 'length') {
              currentDataStream.writeMessageAnnotation({
                type: 'usage',
                value: {
                  completionTokens: cumulativeUsage.completionTokens,
                  promptTokens: cumulativeUsage.promptTokens,
                  totalTokens: cumulativeUsage.totalTokens,
                },
              });
              currentDataStream.writeData({
                type: 'progress',
                label: 'response',
                status: 'complete',
                order: progressCounter++,
                message: 'Response Generated',
              } satisfies ProgressAnnotation);
              await new Promise((resolve) => setTimeout(resolve, 0));

              return;
            }

            if (stream.switches >= MAX_RESPONSE_SEGMENTS) {
              throw new Error('Cannot continue message: Maximum segments reached');
            }

            const switchesLeft = MAX_RESPONSE_SEGMENTS - stream.switches;

            logger.info(`Reached max token limit (${MAX_TOKENS}): Continuing message (${switchesLeft} switches left)`);

            const lastUserMessage = messages.filter((x) => x.role === 'user').slice(-1)[0];
            const { model, provider } = extractPropertiesFromMessage(lastUserMessage);
            messages.push({ id: generateId(), role: 'assistant', content });
            messages.push({
              id: generateId(),
              role: 'user',
              content: `[Model: ${model}]\n\n[Provider: ${provider}]\n\n${CONTINUE_PROMPT}`,
            });

            const result = await streamText({
              messages,
              env: context.cloudflare?.env,
              options, // Pass the same options for recursion
              apiKeys,
              files,
              providerSettings,
              promptId,
              contextOptimization,
              contextFiles: filteredFiles,
              chatMode,
              designScheme,
              summary,
              messageSliceId,
            });

            result.mergeIntoDataStream(currentDataStream);

            (async () => {
              for await (const part of result.fullStream) {
                if (part.type === 'error') {
                  const error: any = part.error;
                  logger.error(`${error}`);

                  return;
                }
              }
            })();

            return;
          },
          tools:
            requestBody.webSearch || requestBody.webScrape || requestBody.imageSearch
              ? [
                  {
                    type: 'function',
                    function: {
                      name: 'sameNewSearch',
                      description:
                        'Performs web searches, scrapes web pages, or searches for images using same.new API.',
                      parameters: {
                        type: 'object',
                        properties: {
                          query: { type: 'string', description: 'The search query or URL to scrape.' },
                          searchType: {
                            type: 'string',
                            enum: ['web', 'scrape', 'image'],
                            description: 'Type of search to perform.',
                          },
                        },
                        required: ['query', 'searchType'],
                      },
                    },
                  },
                  {
                    type: 'function',
                    function: {
                      name: 'runTerminalCmd',
                      description: 'Executes a command in a sandboxed terminal environment via same.new API.',
                      parameters: {
                        type: 'object',
                        properties: {
                          command: { type: 'string', description: 'The terminal command to execute.' },
                        },
                        required: ['command'],
                      },
                    },
                  },
                ]
              : undefined,
          tool_choice:
            requestBody.webSearch || requestBody.webScrape || requestBody.imageSearch ? 'auto' : undefined,

          onToolCall: async ({ toolCall }) => {
            logger.debug('Tool call requested:', toolCall);
            let result;

            try {
              if (toolCall.toolName === 'sameNewSearch' && toolCall.args) {
                const { query, searchType } = toolCall.args as {
                  query: string;
                  searchType: 'web' | 'scrape' | 'image';
                };
                if (searchType === 'web' && sameNew?.webSearch) {
                  result = await sameNew.webSearch({ query });
                } else if (searchType === 'scrape' && sameNew?.webScrape) {
                  result = await sameNew.webScrape({ url: query }); // Assuming query is URL for scrape
                } else if (searchType === 'image' && sameNew?.imageSearch) {
                  // Assuming imageSearch exists
                  result = await sameNew.imageSearch({ query });
                } else {
                  throw new Error(`Unsupported searchType or function not available: ${searchType}`);
                }
              } else if (toolCall.toolName === 'runTerminalCmd' && toolCall.args && sameNew?.runTerminalCmd) {
                const { command } = toolCall.args as { command: string };
                result = await sameNew.runTerminalCmd({ command });
              } else {
                throw new Error(`Unknown tool: ${toolCall.toolName}`);
              }
              logger.debug('Tool call result:', result);
              currentDataStream.writeMessageAnnotation({
                type: 'tool_result', // Or a more specific type
                toolName: toolCall.toolName,
                result, // Or transform as needed
              });

              return { toolCallId: toolCall.toolCallId, result };
            } catch (e: any) {
              logger.error('Tool call failed:', e);
              currentDataStream.writeMessageAnnotation({
                type: 'tool_error',
                toolName: toolCall.toolName,
                error: e.message,
              });

              return { toolCallId: toolCall.toolCallId, result: { error: e.message } };
            }
          },
        };

        currentDataStream.writeData({
          type: 'progress',
          label: 'response',
          status: 'in-progress',
          order: progressCounter++,
          message: 'Generating Response',
        } satisfies ProgressAnnotation);

        // Prepend active editor context to the messages if available
        if (activeEditorFile && activeEditorContent) {
          const editorContextMessage: VercelAIMessage = { // Use VercelAIMessage type
            role: 'system', // Or 'user' if more appropriate for how LLM processes it
            // Using a structured format that the LLM can be prompted to understand
            content: `[System Note: The user currently has the file "${activeEditorFile}" open in their editor. Its content is:\n\`\`\`\n${activeEditorContent}\n\`\`\`]`,
            // annotations: [{ type: 'hidden' }] // Optional: Use Vercel AI SDK annotation format
          };
          // Insert this context before the last user message, or adjust as needed
          messages.splice(messages.length - 1, 0, editorContextMessage as StreamTextMessages[number]); // Cast to StreamTextMessages element type
          logger.debug(`Prepended editor context for: ${activeEditorFile}`);
        }
        // Similarly, prepend last terminal command if available and implemented

        const result = await streamText({
          messages,
          env: context.cloudflare?.env,
          options,
          apiKeys,
          files,
          providerSettings,
          promptId,
          contextOptimization,
          contextFiles: filteredFiles,
          chatMode,
          designScheme,
          summary,
          messageSliceId,
        });

        (async () => {
          for await (const part of result.fullStream) {
            if (part.type === 'error') {
              const error: any = part.error;
              logger.error(`${error}`);

              return;
            }
          }
        })();
        result.mergeIntoDataStream(currentDataStream);
      },
      onError: (error: any) => `Custom error: ${error.message}`,
    }).pipeThrough(
      new TransformStream({
        transform: (chunk, controller) => {
          if (!lastChunk) {
            lastChunk = ' ';
          }

          if (typeof chunk === 'string') {
            if (chunk.startsWith('g') && !lastChunk.startsWith('g')) {
              controller.enqueue(encoder.encode('0: "<div class=\\"__boltThought__\\">"\n'));
            }

            if (lastChunk.startsWith('g') && !chunk.startsWith('g')) {
              controller.enqueue(encoder.encode('0: "</div>\\n"\n'));
            }
          }

          lastChunk = chunk;

          let transformedChunk = chunk;

          if (typeof chunk === 'string' && chunk.startsWith('g')) {
            let content = chunk.split(':').slice(1).join(':');

            if (content.endsWith('\n')) {
              content = content.slice(0, content.length - 1);
            }

            transformedChunk = `0:${content}\n`;
          }

          // Convert the string stream to a byte stream
          const str = typeof transformedChunk === 'string' ? transformedChunk : JSON.stringify(transformedChunk);
          controller.enqueue(encoder.encode(str));
        },
      }),
    );

    return new Response(dataStream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        Connection: 'keep-alive',
        'Cache-Control': 'no-cache',
        'Text-Encoding': 'chunked',
      },
    });
  } catch (error: any) {
    logger.error(error);

    if (error.message?.includes('API key')) {
      throw new Response('Invalid or missing API key', {
        status: 401,
        statusText: 'Unauthorized',
      });
    }

    throw new Response(null, {
      status: 500,
      statusText: 'Internal Server Error',
    });
  }
}
