import * as THREE from "three";

/** Everything in the 3D scene that changes between dark and light. */
export interface ScenePalette {
  name: "dark" | "light";
  bg: string;
  edgeFocus: string;
  edgeBase: string;
  haloBlending: THREE.Blending;
  haloStrength: number; // multiplier on halo opacity
  emissive: number; // multiplier on node self-glow
  ambient: number;
  stars: boolean;
  sparkleWarm: string;
  sparkleCool: string;
  bloom: boolean;
  vignette: number;
}

export const SCENE_PALETTES: Record<"dark" | "light", ScenePalette> = {
  dark: {
    name: "dark",
    bg: "#110E1D",
    edgeFocus: "#F0B77A",
    edgeBase: "#F7EEDD",
    haloBlending: THREE.AdditiveBlending,
    haloStrength: 1,
    emissive: 1,
    ambient: 0.35,
    stars: true,
    sparkleWarm: "#F0B77A",
    sparkleCool: "#A9C4AC",
    bloom: true,
    vignette: 0.75,
  },
  // Warm paper. Glow would wash out on a pale ground, so bloom is off, halos blend
  // normally, and threads are ink rather than light.
  light: {
    name: "light",
    bg: "#F2ECE1",
    edgeFocus: "#B5651D",
    edgeBase: "#3A3142",
    haloBlending: THREE.NormalBlending,
    haloStrength: 1.6,
    emissive: 0.22,
    ambient: 0.95,
    stars: false,
    sparkleWarm: "#C98B4E",
    sparkleCool: "#7E9F82",
    bloom: false,
    vignette: 0.3,
  },
};
