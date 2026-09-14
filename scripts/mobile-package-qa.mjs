import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const dist = resolve(root, "dist");
const publicRoot = resolve(root, "ios", "App", "App", "public");
const infoPlistPath = resolve(root, "ios", "App", "App", "Info.plist");
const projectPath = resolve(root, "ios", "App", "App.xcodeproj", "project.pbxproj");
const appIconPath = resolve(root, "ios", "App", "App", "Assets.xcassets", "AppIcon.appiconset", "AppIcon-512@2x.png");
const shippedFiles = [
  "index.html",
  "iphone.css",
  "iphone-refinement.css",
  "phosphor-icons.css",
  "iphone.js",
  "manifest.webmanifest",
  "assets/xuecheng-mark.svg",
  "assets/xuecheng-mark.png",
  "assets/onboarding-morning-v2.png",
  "assets/phosphor/regular.woff2",
  "lib/conversation-history.js",
  "lib/companion-state.js",
  "lib/viewport-height.js",
];

let checks = 0;
function verify(condition, message) {
  checks += 1;
  assert.ok(condition, message);
}

for (const file of shippedFiles) {
  const [distContents, publicContents] = await Promise.all([
    readFile(resolve(dist, file)),
    readFile(resolve(publicRoot, file)),
  ]);
  checks += 1;
  assert.deepEqual(publicContents, distContents, `iOS public bundle differs from dist: ${file}`);
}

const [infoPlist, project, icon, shippedIndex, shippedApp] = await Promise.all([
  readFile(infoPlistPath, "utf8"),
  readFile(projectPath, "utf8"),
  stat(appIconPath),
  readFile(resolve(publicRoot, "index.html"), "utf8"),
  readFile(resolve(publicRoot, "iphone.js"), "utf8"),
]);

verify(/<key>CFBundleVersion<\/key>\s*<string>\$\(CURRENT_PROJECT_VERSION\)<\/string>/.test(infoPlist), "CFBundleVersion must use the Xcode build setting");
const buildVersions = [...project.matchAll(/CURRENT_PROJECT_VERSION = (\d+);/g)].map(([, value]) => value);
verify(buildVersions.length >= 2, "Debug and Release builds need explicit build versions");
verify(new Set(buildVersions).size === 1, "Debug and Release build versions must match");
verify(Number.parseInt(buildVersions[0], 10) >= 1, "iOS build version must be a positive integer");
const phoneOrientations = infoPlist.match(/<key>UISupportedInterfaceOrientations<\/key>[\s\S]*?<\/array>/)?.[0] || "";
verify(/UIInterfaceOrientationPortrait/.test(phoneOrientations) && !/UIInterfaceOrientationLandscape/.test(phoneOrientations), "the iPhone package must remain portrait-first");
verify(/NSMicrophoneUsageDescription/.test(infoPlist) && /NSSpeechRecognitionUsageDescription/.test(infoPlist), "voice input permissions are missing from the iOS package");
verify(icon.size > 0, "iOS app icon is missing");
verify(shippedIndex.includes("interactive-widget=resizes-content"), "iOS web bundle is missing keyboard resize behavior");
verify(shippedApp.includes("native-shell") && shippedApp.includes("keyboardWasOpen"), "iOS web bundle is missing native viewport safeguards");
await access(resolve(publicRoot, "assets", "onboarding-path.webp"));
checks += 1;

console.log(`mobile package QA passed: ${checks} checks, build=${buildVersions[0]}`);
