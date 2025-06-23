import WebSearch from '~/components/search/WebSearch';
import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [
    { title: "Web Search - bolt.diy" },
    { name: "description", content: "Search the web directly within bolt.diy" },
  ];
};

export default function SearchPage() {
  return (
    <div className="min-h-screen bg-bolt-theme-background">
      {/* You might want to add a common header or navigation here */}
      {/* <Header /> */}
      <main>
        <WebSearch />
      </main>
      {/* You might want to add a common footer here */}
      {/* <Footer /> */}
    </div>
  );
}
