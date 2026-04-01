import customTabComponents from "components/custom-tabs/registry";

export default function CustomTabRenderer({ type, config }) {
  const Component = customTabComponents[type];

  if (!Component) {
    return (
      <div className="m-4 sm:m-8 text-theme-700 dark:text-theme-200">
        Unknown custom tab type: {type}
      </div>
    );
  }

  return <Component config={config} />;
}
