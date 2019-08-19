module.exports = config => async (ctx, next) => {
  const { wpack } = ctx.app;

  if (!wpack.built) {
    ctx.body = 'building...';

    return;
  }

  if (ctx.url.match(wpack.publicPath)) {
    const { port } = config;
    const res = await ctx.curl(`http://127.0.0.1:${port}${ctx.url}`);

    const { headers, data } = res;

    if (data) {
      ctx.status = 200;
    }

    ctx.body = data;
    ctx.set(headers);
    return;
  }

  await next();
};
