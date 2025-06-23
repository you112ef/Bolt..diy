import ProjectStarter from '~/components/project-starter/ProjectStarter';
import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [
    { title: "Create New Project - bolt.diy" },
    { name: "description", content: "Start a new project from a template using bolt.diy" },
  ];
};

export default function ProjectStarterPage() {
  return (
    <div className="min-h-screen bg-bolt-theme-background">
      {/* Optional: Common Header */}
      {/* <Header /> */}
      <main>
        <ProjectStarter />
      </main>
      {/* Optional: Common Footer */}
      {/* <Footer /> */}
    </div>
  );
}
