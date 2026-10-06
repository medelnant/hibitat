"use client";

import { useSearchParams } from "next/navigation";
import type { SerializedHabitat } from "@/lib/graph";
import HabitatExperience from "./HabitatExperience";

/** Reads ?focus= so links like /?focus=sarah open the habitat centred on that node. */
export default function HabitatRoute({ data }: { data: SerializedHabitat }) {
  const focus = useSearchParams().get("focus");
  return <HabitatExperience data={data} initialFocus={focus} />;
}
