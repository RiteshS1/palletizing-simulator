import type { MetadataRoute } from "next";

// Web app manifest: name, colours and icon when the site is installed or pinned on a phone.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PalletLab — Robotics with C++",
    short_name: "PalletLab",
    description: "Learn robotics with C++ by building a palletizing planner.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f7f5",
    theme_color: "#f7f7f5",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
