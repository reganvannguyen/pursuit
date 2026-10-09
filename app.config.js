module.exports = ({ config }) => {
  const androidMapsApiKey = process.env.ANDROID_GOOGLE_MAPS_API_KEY;
  const plugins = (config.plugins ?? []).filter((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    return name !== 'react-native-maps';
  });

  return {
    ...config,
    plugins: [
      ...plugins,
      [
        'react-native-maps',
        androidMapsApiKey ? { androidGoogleMapsApiKey: androidMapsApiKey } : {},
      ],
    ],
    extra: {
      ...config.extra,
      mapConfig: {
        androidGoogleMapsKeyConfigured: Boolean(androidMapsApiKey),
      },
    },
  };
};
