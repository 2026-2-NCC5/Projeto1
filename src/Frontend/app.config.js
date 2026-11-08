const fs = require("fs");

export default ({ config }) => ({
  ...config,

  android: {
    ...config.android,

    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ||
      (fs.existsSync("./google-services.json") ? "./google-services.json" : undefined),
  },
});
