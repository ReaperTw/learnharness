const { app, shell } = require("electron");
const path = require("node:path");

app.whenReady().then(() => {
	const shortcutPath = process.argv[2];
	if (!shortcutPath) throw new Error("Missing shortcut destination");
	const root = path.resolve(__dirname, "..");
	const details = {
		target: path.join(process.env.SystemRoot, "System32", "wscript.exe"),
		args: `"${path.join(__dirname, "start-desktop.vbs")}"`,
		cwd: root,
		icon: path.join(root, "build", "icon.ico"),
		iconIndex: 0,
		description: "LearnHarness",
		// Must match electron/main.cjs and electron-builder.yml.
		appUserModelId: "com.learnharness.LearnHarness",
	};
	if (!shell.writeShortcutLink(shortcutPath, "create", details)) throw new Error("Could not write application shortcut");
	const installed = shell.readShortcutLink(shortcutPath);
	if (installed.appUserModelId !== details.appUserModelId || installed.target !== details.target) throw new Error("Shortcut identity verification failed");
	console.log(JSON.stringify({ path: shortcutPath, appUserModelId: installed.appUserModelId, target: installed.target }));
	app.exit(0);
}).catch((error) => { console.error(error); app.exit(1); });
