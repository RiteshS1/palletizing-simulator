import { redirect } from "@/i18n/navigation";

export default async function SimulatorIndex({ params }: PageProps<"/[locale]/simulator">) {
  const { locale } = await params;
  redirect({ href: "/simulator/extreme-points", locale });
}
