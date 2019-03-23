module.exports = config => async (ctx, next) => {
  const { wpack } = ctx.app;

  if (!wpack.built) {
    ctx.body = 'building...';

    return;
  }

  // TODO: hack, temporary fix for https://github.com/webpack/webpack-dev-server/issues/1591
  if (ctx.url.match(/\/public\/.+\.hot-update\.(json|js)$/)) {
    const { port } = config;

    const { headers, data } = await ctx.curl(`http://127.0.0.1:${port}${ctx.url}`);
    ctx.body = data;
    ctx.set(headers);
    return;
  }

  await next();
};
