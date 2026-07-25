module.exports = {
  default: {
    requireModule: ["ts-node/register"],
    require: ["features/step-definitions/**/*.ts", "features/support/**/*.ts"],
    paths: ["features/**/*.feature"],
    format: ["progress"],
    publishQuiet: true
  }
};
