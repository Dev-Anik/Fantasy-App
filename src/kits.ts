// Club kit colours. Colours and patterns only: no crests, sponsors or
// other protected kit artwork.
export type Kit = {
  shirt: string;
  trim: string;
  sleeves?: string;
  pattern?: "stripes";
};

export const KIT_COLORS: Record<string, Kit> = {
  ARS: {
    shirt: "#ef0107",
    trim: "#ffffff",
    sleeves: "#ffffff",
  },
  AVL: {
    shirt: "#670e36",
    trim: "#95bfe5",
  },
  BHA: {
    shirt: "#0057b8",
    trim: "#ffffff",
    pattern: "stripes",
  },
  BOU: {
    shirt: "#da291c",
    trim: "#000000",
    pattern: "stripes",
  },
  BRE: {
    shirt: "#e30613",
    trim: "#ffffff",
    pattern: "stripes",
  },
  BUR: { shirt: "#6c1d45", trim: "#99d6ea" },
  CHE: { shirt: "#034694", trim: "#ffffff" },
  COV: { shirt: "#87ceeb", trim: "#ffffff" },
  CRY: {
    shirt: "#1b458f",
    trim: "#c4122e",
    pattern: "stripes",
  },
  EVE: { shirt: "#003399", trim: "#ffffff" },
  FUL: { shirt: "#ffffff", trim: "#cc0000", sleeves: "#cc0000" },
  HUL: {
    shirt: "#f68a1e",
    trim: "#111111",
    pattern: "stripes",
  },
  IPS: { shirt: "#3a64a3", trim: "#ffffff" },
  LEE: { shirt: "#ffffff", trim: "#1d428a" },
  LEI: { shirt: "#003090", trim: "#fdbe11" },
  LIV: { shirt: "#c8102e", trim: "#00b2a9", sleeves: "#c8102a" },
  LUT: { shirt: "#f78f1e", trim: "#231f20" },
  MCI: { shirt: "#6caddf", trim: "#ffffff" },
  MUN: { shirt: "#da291c", trim: "#fbe122" },
  NEW: {
    shirt: "#242424",
    trim: "#ffffff",
    pattern: "stripes",
  },
  NFO: { shirt: "#dd0000", trim: "#ffffff" },
  SOU: {
    shirt: "#d71920",
    trim: "#ffffff",
    pattern: "stripes",
  },
  SUN: {
    shirt: "#eb172b",
    trim: "#ffffff",
    pattern: "stripes",
  },
  TOT: { shirt: "#ffffff", trim: "#132257", sleeves: "#132257" },
  WHU: {
    shirt: "#7a263a",
    trim: "#1bb1e7",
  },
  WOL: { shirt: "#fdb913", trim: "#111111" },
};

export const GOALKEEPER_KIT_COLORS: Record<string, Kit> = {
  ARS: { shirt: "#b8d923", trim: "#ffffff" },
  AVL: { shirt: "#f2a900", trim: "#670e36" },
  BHA: { shirt: "#f2e600", trim: "#0057b8" },
  BOU: { shirt: "#58b947", trim: "#000000" },
  BRE: { shirt: "#f2e600", trim: "#e30613" },
  BUR: { shirt: "#f28c28", trim: "#6c1d45" },
  CHE: { shirt: "#f28c28", trim: "#034694" },
  COV: { shirt: "#38a878", trim: "#ffffff" },
  CRY: { shirt: "#f28c28", trim: "#1b458f" },
  EVE: { shirt: "#b8d923", trim: "#003399" },
  FUL: { shirt: "#222222", trim: "#ffffff" },
  HUL: { shirt: "#e85d9e", trim: "#111111" },
  IPS: { shirt: "#e85d9e", trim: "#3a64a3" },
  LEE: { shirt: "#38a878", trim: "#1d428a" },
  LEI: { shirt: "#e85d9e", trim: "#003090" },
  LIV: { shirt: "#16805a", trim: "#c8102e" },
  LUT: { shirt: "#248bd2", trim: "#231f20" },
  MCI: { shirt: "#58b947", trim: "#6caddf" },
  MUN: { shirt: "#7846a8", trim: "#fbe122" },
  NEW: { shirt: "#f28c28", trim: "#242424" },
  NFO: { shirt: "#f2e600", trim: "#dd0000" },
  SOU: { shirt: "#58b947", trim: "#d71920" },
  SUN: { shirt: "#38a878", trim: "#eb172b" },
  TOT: { shirt: "#f2e600", trim: "#132257" },
  WHU: { shirt: "#f28c28", trim: "#7a263a" },
  WOL: { shirt: "#38a878", trim: "#111111" },
};
