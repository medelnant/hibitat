export type NodeType = "exhibit" | "curator" | "community";

export interface HabitatNode {
  id: string;
  type: NodeType;
  name: string;
  sub: string;
  story: string;
  color: string;
  kind?: "place" | "thing";
  legacy?: boolean;
  curatedBy?: string;
  curatedSince?: string;
}

export interface HabitatEdge {
  source: string;
  target: string;
  label: string;
  curates?: boolean;
}

export const NODES: HabitatNode[] = [
  { id: "biscuit", type: "exhibit", name: "Biscuit", sub: "Golden Retriever · b. 2014 · Casselberry, FL", color: "#E0954B", story: "Came to us at eight weeks old and never once walked past a puddle without stepping in it. Still gets the zoomies every evening at six, rain or shine.", curatedBy: "Sarah M.", curatedSince: "since 2014" },
  { id: "otis", type: "exhibit", legacy: true, name: "Otis", sub: "Beagle mix · 2008–2023 · held in memory", color: "#A8957C", story: "Fifteen years of finding the one sunny spot in every room. Taught Biscuit everything he knows about begging, none of it subtle.", curatedBy: "Sarah M.", curatedSince: "since 2009" },
  { id: "juniper", type: "exhibit", name: "Juniper", sub: "Tabby cat · b. 2019", color: "#8FB3BF", story: "Lives on top of the refrigerator and believes the rest of the house is a rumor. Tolerates Comet from a distance.", curatedBy: "Dave R.", curatedSince: "since 2019" },
  { id: "comet", type: "exhibit", name: "Comet", sub: "Mini Aussie · b. 2021", color: "#C97A72", story: "Fastest thing on the trail and knows it. Best friends with Biscuit since a chance meeting at the dog park.", curatedBy: "Dave R.", curatedSince: "since 2021" },
  { id: "trail", type: "exhibit", kind: "place", name: "Howell Branch Trail", sub: "A place · Casselberry, FL", color: "#7C9CA6", story: "Three miles of shade and squirrels. Where Biscuit and Comet first met, and where most of the zoomies happen.", curatedBy: "Sarah M.", curatedSince: "since 2016" },
  { id: "bandana", type: "exhibit", kind: "thing", name: "The red bandana", sub: "A thing · Otis, 2011–2023", color: "#C8654C", story: "Worn every day for twelve years. Still hangs on the hook by the door.", curatedBy: "Sarah M.", curatedSince: "since 2023" },
  { id: "sarah", type: "curator", name: "Sarah M.", sub: "Curator · 4 exhibits · Casselberry, FL", color: "#F3E4CC", story: "Keeps the stories of the animals and places that have shaped her home. Volunteers with Orange County Rescue on weekends." },
  { id: "dave", type: "curator", name: "Dave R.", sub: "Curator · 2 exhibits · Winter Park, FL", color: "#F3E4CC", story: "Met Sarah through Biscuit and Comet. Curates the goofball and the aloof one." },
  { id: "rescue", type: "community", name: "Orange County Rescue", sub: "Community · 42 exhibits · 18 curators", color: "#A9C4AC", story: "Every animal that has passed through here has a place, whether they were adopted last week or remembered from years ago." },
];

export const EDGES: HabitatEdge[] = [
  { source: "sarah", target: "biscuit", label: "curates", curates: true },
  { source: "sarah", target: "otis", label: "curates", curates: true },
  { source: "sarah", target: "trail", label: "curates", curates: true },
  { source: "sarah", target: "bandana", label: "curates", curates: true },
  { source: "dave", target: "comet", label: "curates", curates: true },
  { source: "dave", target: "juniper", label: "curates", curates: true },
  { source: "rescue", target: "biscuit", label: "adopted from" },
  { source: "rescue", target: "otis", label: "adopted from" },
  { source: "sarah", target: "rescue", label: "volunteers with" },
  { source: "dave", target: "rescue", label: "fosters for" },
  { source: "biscuit", target: "comet", label: "best friends" },
  { source: "biscuit", target: "trail", label: "favorite walk" },
  { source: "comet", target: "trail", label: "zoomies here" },
  { source: "otis", target: "bandana", label: "his bandana" },
  { source: "biscuit", target: "otis", label: "grew up with" },
];

export const STAGES = [
  { n: 1, label: "Nearby", hint: "one hop: who and what touches this directly" },
  { n: 2, label: "Neighborhood", hint: "two hops: the stories these connect to" },
  { n: 3, label: "Whole habitat", hint: "everything this connects to, however far" },
] as const;

export type Stage = (typeof STAGES)[number]["n"];
