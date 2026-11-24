import { setRequestLocale } from "next-intl/server";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { SiteHeader } from "@/components/ui/SiteHeader";

export default async function DocsLayout({ children, params }: LayoutProps<"/[locale]/docs">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <SiteHeader />
      <div className="mx-auto grid max-w-[1600px] px-4 sm:px-6 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-8 xl:px-8">
        <DocsSidebar />
        {children}
      </div>
    </>
  );
}
