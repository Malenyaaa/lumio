# Lumio plugins

The plugin store every Lumio instance shows under **Settings → Plugins → Available plugins**. Instances read
[`catalog.json`](catalog.json) from this repository when the page opens, so a plugin merged here shows up everywhere
without anyone redeploying.

## Adding a plugin

Open a pull request that adds an entry to `catalog.json`, and either:

- **the plugin itself** in this folder (`plugins/<id>.js`), served through jsDelivr:
  `https://cdn.jsdelivr.net/gh/PalmarHealer/lumio@main/plugins/<id>.js`, or
- **a link to where you host it** (an ES module served with a JavaScript content type, over https; pin a version or
  tag in the URL so what was reviewed is what runs).

```json
{
  "id": "my-plugin",
  "name": "My plugin",
  "description": { "en": "What it does, in one sentence.", "de": "Was es tut, in einem Satz." },
  "url": "https://cdn.jsdelivr.net/gh/PalmarHealer/lumio@main/plugins/my-plugin.js",
  "author": "your-github-name",
  "homepage": "https://github.com/your-github-name/my-plugin",
  "requires": "A Jellyfin plugin it needs, if any"
}
```

`id` is unique and stays the same across versions; `description` needs at least `en`.

## Writing one

A plugin is an ES module whose default export is `setup(lumio)`; see the plugin API in the main
[README](../README.md#plugins). It can add styles, navigation links, menu entries, pages, settings pages, content in
slots, hide parts of Lumio and react to events.

## Review

Plugins run in the browser of everyone using an instance, with their session. Pull requests are reviewed for what
the code does before they are merged; plugins that load further code from elsewhere, send data to third parties
without saying so, or obfuscate their code are not accepted.
