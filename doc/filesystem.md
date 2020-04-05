# Filesystem in Forest

Forest works directly with normal `.ts` text files, instead of a special tree database format. There's still a couple of different ways to open code with Forest though.

When you launch Forest either from the [online demo](https://forest.walr.is) or by [building it yourself](./dev.md) Forest will create a simulated filesystem in your browser. You'll see `Using demo filesystem` on the bottom of the screen in that case. You can load any repos from GitHub using the buttons in this mode, so that's probably enough for quickly trying Forest.

It's also possible to give Forest access to your computer's real filesystem. This works both with the self-built version and the online demo. To do this you need to start a server script which proxies filesystem operations for Forest. **WARINNG: This script will start a server which allows read and write access to your filesystem.** Use a firewall and be careful. Here's how to start the server:

- Install Node.js 12 and [yarn](https://yarnpkg.com/)
- Clone Forest somewhere (`~/path/to/forest` in this example)
- In a terminal, switch to the directory with the files that you want to edit
  - `cd path/to/a/folder/with/ts`
- Start the server
  - `~/path/to/forest/server-unsafe.js`
- Reload forest
