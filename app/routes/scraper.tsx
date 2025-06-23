import WebScraper from '~/components/scraper/WebScraper';
import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [
    { title: "Web Page Preview - bolt.diy" },
    { name: "description", content: "Preview web pages with screenshots and metadata within bolt.diy" },
  ];
};

export default function ScraperPage() {
  return (
    <div className="min-h-screen bg-bolt-theme-background">
      {/* You might want to add a common header or navigation here */}
      {/* <Header /> */}
      <main>
        <WebScraper />
      </main>
      {/* You might want to add a common footer here */}
      {/* <Footer /> */}
    </div>
  );
}
