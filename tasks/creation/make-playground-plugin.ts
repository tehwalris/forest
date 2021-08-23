// https://github.com/microsoft/TypeScript-Website/blob/v2/packages/create-typescript-playground-plugin/template/src/index.ts

type PluginUtils = any;
type PlaygroundPlugin = any;

const makePlugin = (utils: PluginUtils) => {
  const customPlugin: PlaygroundPlugin = {
    id: "example",
    displayName: "Dev Example",
    didMount: (sandbox, container) => {
      console.log("Showing new plugin");

      const ds = utils.createDesignSystem(container);

      ds.title("Example Plugin");

      const startButton = document.createElement("input");
      startButton.type = "button";
      startButton.value = "Change the code";
      container.appendChild(startButton);

      startButton.onclick = () => {
        sandbox.setText("// You clicked the button!");
      };
    },

    modelChangedDebounce: async (_sandbox, _model) => {},

    didUnmount: () => {
      console.log("De-focusing plugin");
    },
  };

  return customPlugin;
};
