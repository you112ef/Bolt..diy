import type { ActionFunctionArgs} from "@remix-run/node";
import { json } from "@remix-run/node";

// In a real scenario, you might interact with WebContainer's fs or spawn APIs
// For example, if you have access to the WebContainer instance here:
// import { WebContainer } from '@webcontainer/api';
// let webContainerInstance: WebContainer;
// export function setWebContainerInstance(instance: WebContainer) {
//   webContainerInstance = instance;
// }


interface CreateProjectPayload {
  templateId: string;
  projectName: string;
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  let payload: CreateProjectPayload;
  try {
    payload = await request.json();
  } catch (error) {
    return json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const { templateId, projectName } = payload;

  if (!templateId || !projectName) {
    return json({ error: "Missing templateId or projectName" }, { status: 400 });
  }

  // Sanitize project name (basic example)
  const saneProjectName = projectName.replace(/[^a-zA-Z0-9-_]/g, '');
  if (!saneProjectName) {
    return json({ error: "Invalid project name" }, { status: 400 });
  }

  console.log(`API: Attempting to create project "${saneProjectName}" from template "${templateId}"`);

  // MOCK IMPLEMENTATION:
  // Here, you would use WebContainer's fs.mkdir, fs.writeFile, or spawn('git', ['clone', ...])
  // or spawn('cp', ['-r', ...]) to actually create the project files.

  try {
    // Simulate file operations
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate delay

    // Example: if (webContainerInstance) {
    //   await webContainerInstance.fs.mkdir(`/projects/${saneProjectName}`);
    //   await webContainerInstance.fs.writeFile(`/projects/${saneProjectName}/README.md`, `# ${saneProjectName}\nCreated from ${templateId}`);
    //   // ... copy more files based on templateId
    // } else {
    //   console.warn("WebContainer instance not available in /api/project/create");
    //   // Fallback or error if WebContainer is essential and not available
    // }


    // Simulate success or failure
    if (Math.random() > 0.1) { // 90% success chance for mock
      console.log(`API: Successfully created project "${saneProjectName}" from template "${templateId}" (mocked).`);
      return json({ success: true, message: `Project "${saneProjectName}" created successfully.`, projectPath: `/projects/${saneProjectName}` });
    } else {
      console.error(`API: Failed to create project "${saneProjectName}" (mocked).`);
      return json({ error: "Mock failure: Could not create project files." }, { status: 500 });
    }

  } catch (error: any) {
    console.error(`API: Error during project creation for "${saneProjectName}":`, error);
    return json({ error: error.message || "An unexpected error occurred on the server." }, { status: 500 });
  }
}
