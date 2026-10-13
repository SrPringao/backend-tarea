function ok(res, data, status = 200, meta) {
  const body = { ok: true, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

function noContent(res) {
  return res.status(204).end();
}

function pageParams({ page = 1, limit = 20 }) {
  return { page, limit, offset: (page - 1) * limit };
}

function pageMeta(total, page, limit) {
  return { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

module.exports = { ok, noContent, pageParams, pageMeta };
