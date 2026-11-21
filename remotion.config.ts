// See all configuration options: https://remotion.dev/docs/config
// Note: the Node render scripts in scripts/ pass these options explicitly; this file
// covers `remotion studio` / `remotion render` from the CLI.

import { Config } from "@remotion/cli/config";
import { enableTailwind } from "@remotion/tailwind-v4";

Config.setRspack(true);
Config.overrideBundlerConfig(enableTailwind);
Config.setOverwriteOutput(true);

// Three.js needs ANGLE: Chrome's default GL path renders WebGL incorrectly headless.
Config.setChromiumOpenGlRenderer("angle");

// Lossless intermediate frames: JPEG frames band gradients and smear glows.
Config.setVideoImageFormat("png");

// Delivery color: limited-range 4:2:0 with BT.709 tags (players misread untagged full-range).
Config.setPixelFormat("yuv420p");
Config.setColorSpace("bt709");

// WebGL contexts share the iGPU's memory; keep parallel tabs low.
Config.setConcurrency(2);
