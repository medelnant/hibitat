import { Suspense } from "react";
import HabitatExperience from "@/components/HabitatExperience";
import HabitatRoute from "@/components/HabitatRoute";
import { loadSerializedHabitat } from "@/lib/habitat-repo";

export default async function Home() {
  // Read from Postgres when the page is built, then again whenever a thread is added
  // (the server actions revalidate "/"), so visitors always get a static page.
  const data = await loadSerializedHabitat();
  // The page is prerendered with the default focus; ?focus= is read in the browser.
  return (
    <Suspense fallback={<HabitatExperience data={data} />}>
      <HabitatRoute data={data} />
    </Suspense>
  );
}
