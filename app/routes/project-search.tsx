import ProjectSearch from '~/components/search/ProjectSearch';
import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [
    { title: "Project Search - bolt.diy" },
    { name: "description", content: "Search for files and content within your project in bolt.diy" },
  ];
};

export default function ProjectSearchPage() {
  return (
    <div className="min-h-screen bg-bolt-theme-background">
      {/* Optional: Common Header */}
      {/* <Header /> */}
      <main>
        <ProjectSearch />
      </main>
      {/* Optional: Common Footer */}
      {/* <Footer /> */}
    </div>
  );
}
