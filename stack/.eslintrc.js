module.exports = {
  "extends": "airbnb-base",
  "plugins": [
      "import",
  ],
  "rules": {
    "comma-dangle": ["warn", {
      arrays: "always-multiline",
      objects: "always-multiline",
      imports: "always-multiline",
      exports: "always-multiline",
      // Deviating from AirBnB here b/c Node LTS does NOT like these dang
      functions: "never",
    }],
    "consistent-return": "off",
    "no-confusing-arrow": ["warn", { allowParens: true }],
    // console is really handy for getting info into CloudWatch
    // see http://eslint.org/docs/rules/no-console#when-not-to-use-it
    "no-console": "off",
  },
  "settings": {
    // aws-sdk is automatically available in Lambda
    "import/core-modules": ['aws-sdk']
  },
};
