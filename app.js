const { InitialAssets, Actions } = require('./shared');

class AppHook {
  constructor(app) {
    this.app = app;

    app.wpack = InitialAssets;
    app.assets = app.wpack.content;

    // 注入wpack中间件
    app.config.coreMiddleware = [
      'wpack',
      ...app.config.coreMiddleware,
    ];

    // 监听agent发送的assets消息
    app.messenger.on(Actions.assets, assets => {
      app.wpack = {
        built: Boolean(assets && Object.keys(assets).length),
        content: assets || {},
      };

      app.assets = app.wpack.content;
    });
  }

  serverDidReady() {
    // 向agent请求assets
    this.app.messenger.sendToAgent(Actions.appReady);
  }
}

module.exports = AppHook;
