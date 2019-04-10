const assert = require('assert');
const Fastify = require('fastify');
const webpack = require('webpack');
const { map, reduce } = require('lodash/fp');
const chokidar = require('chokidar');
const WebpackDevMiddleware = require('webpack-dev-middleware');
const WebpackHotMiddleware = require('webpack-hot-middleware');
const { Actions } = require('./shared');

const WPACK_ASSETS = Symbol('wpackAssets');
const uncappedReduce = reduce.convert({ cap: false });

class AgentHook {
  constructor(agent) {
    const { configPath, port, configsToWatch } = agent.config.wpack;

    try {
      assert(configPath, '必须设置wpack.configPath');
      assert(port, '必须设置wpack.port');
    } catch(error) {
      console.error(error);
    }

    this.agent = agent;
    this.agent[WPACK_ASSETS] = [];
    // 初始化webpack服务
    this.initWpackServer(configPath, port);
    // 初始化webpack config文件监视器
    this.initChokidar(configsToWatch);

    // 监听app服务
    this.agent.messenger.on(Actions.appReady, () => {
      this.sendAssets(this.agent[WPACK_ASSETS]);
    });
  }

  initChokidar(configsToWatch) {
    if (configsToWatch) {
      const watcher = chokidar.watch(configsToWatch, {
        awaitWriteFinish: {
          stabilityThreshold: 640,
        },
      });

      watcher.on('change', () => this.devMiddleware.invalidate());
    }
  }

  initWpackServer(configPath, port) {
    const host = `127.0.0.1:${port}`;
    const fast = Fastify();
    const { entry, devServer = {}, ...webpackConfig } = require(configPath);
    const hmrPath = `http://${host}/__webpack_hmr`;
    const hmrEntry = `webpack-hot-middleware/client?path=${hmrPath}`;

    webpackConfig.devServer = {
      ...devServer,
      public: host,
    };

    if (entry.constructor === String) {
      webpackConfig.entry = [hmrEntry, entry];
    }

    if (entry.constructor === Array) {
      webpackConfig.entry = [hmrEntry, ...entry];
    }

    if (entry.constructor === Object) {
      webpackConfig.entry = uncappedReduce(
        (result, value, key) => {
          if (value.constructor === String) {
            result[key] = [hmrEntry, value];
          }

          if (value.constructor === Array) {
            result[key] = [hmrEntry, ...value];
          }

          return result;
        },
        {},
        entry,
      );
    }

    const publicPath = webpackConfig.output.publicPath;
    const compiler = webpack(webpackConfig);

    this.wpackServer = fast;

    const devMiddleware = WebpackDevMiddleware(compiler, {
      publicPath,
      public: host,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });

    const hotMiddleware = WebpackHotMiddleware(compiler);

    this.devMiddleware = devMiddleware;

    devMiddleware.waitUntilValid(stats => {
      const { assetsByChunkName, publicPath } = stats.toJson({
        all: false,
        assets: true,
        publicPath: true,
      });

      const prefix = `http://${host}${publicPath}`;

      const wpackAssets = uncappedReduce(
        (result, value, key) => ({
          ...result,
          [key]: map(
            name => `${prefix}${name}`,
            value instanceof Array ? value : [value],
          ),
        }),
        {},
        assetsByChunkName,
      );

      this.agent[WPACK_ASSETS] = wpackAssets;
      this.sendAssets(this.agent[WPACK_ASSETS]);
    });

    fast.use(devMiddleware);
    fast.use(hotMiddleware);

    fast.listen(port);
  }

  sendAssets(assets = []) {
    this.agent.messenger.sendToApp(Actions.assets, assets);
  }
}

module.exports = AgentHook;
