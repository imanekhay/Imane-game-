// CommonJS fallback for editors that cannot resolve ESM imports in svelte.config.js
module.exports = {
  preprocess: require("svelte-preprocess")(),
};
