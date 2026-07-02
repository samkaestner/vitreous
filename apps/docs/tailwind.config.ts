import type { Config } from "tailwindcss";
import { vitreousTailwindPreset } from "@vitreous/theme/tailwind";

const config: Config = {
  presets: [vitreousTailwindPreset],
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {}
  }
};

export default config;

