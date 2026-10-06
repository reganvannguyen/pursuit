const { withAppDelegate, withInfoPlist } = require("expo/config-plugins");

function withIosSceneLifecycle(config) {
  config = withInfoPlist(config, (config) => {
    config.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: "Default Configuration",
            UISceneDelegateClassName: "EXExpoAppSceneDelegate",
          },
        ],
      },
    };

    return config;
  });

  return withAppDelegate(config, (config) => {
    const appDelegate = config.modResults;

    if (appDelegate.language !== "swift") {
      throw new Error("The iOS scene lifecycle plugin requires a Swift AppDelegate.");
    }

    const legacyDeclaration = "class AppDelegate: ExpoAppDelegate {";
    const sceneDeclaration =
      "class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {";

    if (appDelegate.contents.includes(legacyDeclaration)) {
      appDelegate.contents = appDelegate.contents.replace(
        legacyDeclaration,
        sceneDeclaration,
      );
    }

    const legacyLaunchBlock =
      /#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\n\s*launchOptions: launchOptions\)\n#endif/;

    if (legacyLaunchBlock.test(appDelegate.contents)) {
      appDelegate.contents = appDelegate.contents
        .replace(legacyLaunchBlock, "")
        .replace(/\n{3,}/g, "\n\n");
    } else if (
      !appDelegate.contents.includes(sceneDeclaration) ||
      appDelegate.contents.includes("factory.startReactNative(")
    ) {
      throw new Error("Could not update the generated Swift AppDelegate for iOS scenes.");
    }

    return config;
  });
}

module.exports = withIosSceneLifecycle;
