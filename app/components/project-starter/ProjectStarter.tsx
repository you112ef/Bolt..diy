import React, { useState, useCallback } from 'react';

// Define template structure
interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  iconUrl?: string; // URL for an icon representing the template
  // Potentially add more details like git repository, tags, etc.
}

// Mock list of available templates
const availableTemplates: ProjectTemplate[] = [
  {
    id: 'nextjs-default',
    name: 'Next.js Default',
    description: 'A standard Next.js project with TypeScript.',
    iconUrl: '/icons/nextjs.svg', // Assuming icons are in public/icons
  },
  {
    id: 'vite-tailwind-react',
    name: 'Vite + React + TailwindCSS',
    description: 'A Vite-powered React project with TailwindCSS pre-configured.',
    iconUrl: '/icons/vite.svg',
  },
  {
    id: 'express-typescript',
    name: 'Express.js (TypeScript)',
    description: 'A basic Node.js Express server with TypeScript.',
    // iconUrl: '/icons/express.svg', // Add if an icon is available
  },
  // Add more templates here
];

export default function ProjectStarter() {
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
  const [projectName, setProjectName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | null>(null);

  const handleCreateProject = useCallback(async () => {
    const trimmedProjectName = projectName.trim();
    if (!selectedTemplate) {
      setFeedbackMessage('Please select a template.');
      setFeedbackType('error');
      return;
    }
    if (!trimmedProjectName) {
      setFeedbackMessage('Please enter a project name.');
      setFeedbackType('error');
      return;
    }

    setLoading(true);
    setFeedbackMessage(null);
    setFeedbackType(null);

    console.log(`Creating project "${trimmedProjectName}" from template "${selectedTemplate.name}"...`);

    try {
      const response = await fetch('/api/project/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: selectedTemplate.id, projectName: trimmedProjectName }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Failed to create project. Server responded with ${response.status}.`);
      }

      setFeedbackMessage(result.message || `Project "${trimmedProjectName}" created successfully!`);
      setFeedbackType('success');
      // Potentially trigger other actions like opening the new project in the editor using result.projectPath
      console.log('Project created at:', result.projectPath);

    } catch (error: any) {
      console.error("Project creation failed:", error);
      setFeedbackMessage(error.message || `Failed to create project "${trimmedProjectName}". Please try again.`);
      setFeedbackType('error');
    } finally {
      setLoading(false);
    }
  }, [selectedTemplate, projectName]);

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold text-bolt-theme-text mb-6 text-center">Create New Project</h2>

      {/* Template Selection */}
      <div className="mb-6">
        <h3 className="text-lg font-medium text-bolt-theme-text mb-3">1. Select a Template:</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableTemplates.map((template) => (
            <button
              key={template.id}
              onClick={() => setSelectedTemplate(template)}
              disabled={loading}
              className={`p-4 border rounded-lg text-left transition-all duration-150
                ${selectedTemplate?.id === template.id
                  ? 'border-bolt-theme-primary ring-2 ring-bolt-theme-primary bg-bolt-theme-primary/10 dark:bg-bolt-theme-primary/20'
                  : 'border-bolt-elements-borderColor hover:border-bolt-theme-secondary dark:hover:border-bolt-theme-secondary hover:shadow-md bg-white dark:bg-bolt-theme-surface'
                }
                disabled:opacity-60 disabled:cursor-not-allowed
              `}
            >
              {template.iconUrl && (
                <img src={template.iconUrl} alt={`${template.name} icon`} className="w-8 h-8 mb-2" />
              )}
              <h4 className="font-semibold text-bolt-theme-textPrimary">{template.name}</h4>
              <p className="text-xs text-bolt-theme-textSecondary mt-1">{template.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Project Name Input */}
      {selectedTemplate && (
        <div className="mb-6">
          <h3 className="text-lg font-medium text-bolt-theme-text mb-3">2. Project Name:</h3>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="my-awesome-project"
            className="w-full p-2.5 rounded-md text-sm bg-white dark:bg-bolt-theme-surface border border-bolt-elements-borderColor text-bolt-theme-text focus:outline-none focus:ring-2 focus:ring-bolt-theme-primary"
            disabled={loading}
          />
        </div>
      )}

      {/* Create Button & Feedback */}
      {selectedTemplate && projectName.trim() && (
         <div className="mt-8 text-center">
            <button
            onClick={handleCreateProject}
            disabled={loading || !selectedTemplate || !projectName.trim()}
            className="px-6 py-2.5 text-sm font-medium text-white bg-bolt-theme-primary rounded-md hover:bg-opacity-90 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
            {loading ? 'Creating Project...' : `Create ${projectName.trim()}`}
            </button>
        </div>
      )}

      {feedbackMessage && (
        <div className={`mt-6 p-3 rounded-md text-sm text-center
          ${feedbackType === 'success' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200' : ''}
          ${feedbackType === 'error' ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200' : ''}
        `}>
          {feedbackMessage}
        </div>
      )}
    </div>
  );
}
