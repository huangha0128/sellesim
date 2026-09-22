/**
 * 开放平台 API 文档目录数据。
 * 该文件同时供「文档渲染页」与「在线调试器」使用：
 * - 文档页读取字段表（query/body/response）与请求/响应示例；
 * - 调试器读取 defaultPath/defaultQuery/defaultBody 作为输入项预填值，
 *   以及 method/path 用于构造真实请求。
 */

export type HttpMethod = 'GET' | 'POST';
export type AuthLevel = 'read' | 'write';

/** 字段说明项，用于 query / body / response 表 */
export interface ParamField {
  name: string;
  type: string;
  required: boolean;
  desc: string;
}

export interface EndpointSpec {
  /** 稳定 id，用作锚点与大纲跳转 key */
  id: string;
  method: HttpMethod;
  /** 路径模板，`:xxx` 为路径参数 */
  path: string;
  /** 简短标题，用于大纲 */
  title: string;
  desc: string;
  auth: AuthLevel;
  query?: ParamField[];
  body?: ParamField[];
  /** 响应 data 字段说明 */
  response: ParamField[];
  /** 请求示例（完整 JSON 文本，展示用） */
  requestExample: string;
  /** 响应 data 示例（JSON 文本，展示用） */
  responseExample: string;
  /** 调试器默认路径参数值 */
  defaultPath?: Record<string, string>;
  /** 调试器默认 query 值 */
  defaultQuery?: Record<string, string>;
  /** 调试器默认 body 值 */
  defaultBody?: Record<string, unknown>;
}

/** 金额为带两位小数的十进制数值（单位：元/本金币种） */
const codeBlock = JSON.stringify;

export const READ_ENDPOINTS: EndpointSpec[] = [
  {
    id: 'get-me',
    method: 'GET',
    path: '/me',
    title: '主体信息',
    desc: '获取当前主体的基本信息、钱包额度以及已签发密钥的摘要。用于接入前校验凭证是否有效。',
    auth: 'read',
    response: [
      { name: 'subject', type: 'object', required: true, desc: '主体信息' },
      { name: 'subject.id', type: 'string', required: true, desc: '主体唯一标识' },
      { name: 'subject.name', type: 'string', required: true, desc: '主体名称' },
      { name: 'subject.status', type: 'string', required: true, desc: '状态：active 正常 / disabled 停用' },
      { name: 'subject.callbackUrl', type: 'string|null', required: false, desc: 'Webhook 回调地址' },
      { name: 'subject.defaultMarkupPercent', type: 'number|null', required: false, desc: '默认加价比例（%）' },
      { name: 'subject.splitPercent', type: 'number|null', required: false, desc: '分账比例（%）' },
      { name: 'quota', type: 'object', required: true, desc: '钱包额度快照' },
      { name: 'quota.quotaLimit', type: 'number', required: true, desc: '授信阈值（欠款上限）' },
      { name: 'quota.usedQuota', type: 'number', required: true, desc: '当前欠款（透支授信）' },
      { name: 'quota.availableQuota', type: 'number', required: true, desc: '可用余额' },
      { name: 'quota.balance', type: 'number', required: true, desc: '账户余额' },
      { name: 'keys', type: 'array', required: true, desc: '已签发密钥列表' },
      { name: 'keys[].keyId', type: 'string', required: true, desc: '密钥 ID（X-Api-Key）' },
      { name: 'keys[].mode', type: 'string', required: true, desc: '密钥模式：live / test' },
    ],
    requestExample: codeBlock({ page: 1 }),
    responseExample: JSON.stringify({
      subject: {
        id: 'sb_9f2c1a',
        name: '示例分销主体',
        status: 'active',
        callbackUrl: 'https://acme.com/webhook',
        defaultMarkupPercent: 10,
        splitPercent: null,
      },
      quota: { quotaLimit: 1000, usedQuota: 12.5, availableQuota: 987.5, balance: 987.5 },
      keys: [{ keyId: 'ak_live_7f3a9c21', mode: 'live' }],
    }, null, 2),
  },
  {
    id: 'get-quota',
    method: 'GET',
    path: '/quota',
    title: '额度与流水',
    desc: '额度总览与记账流水列表。流水记录充值、下单、退款、调整等资金变动，可按页翻阅。',
    auth: 'read',
    query: [
      { name: 'page', type: 'number', required: false, desc: '页码，从 1 开始，默认 1' },
      { name: 'pageSize', type: 'number', required: false, desc: '每页条数，默认 20，最大 100' },
    ],
    response: [
      { name: 'quota', type: 'object', required: true, desc: '额度快照（同 /me）' },
      { name: 'ledger', type: 'array', required: true, desc: '记账流水列表，按时间倒序' },
      { name: 'ledger[].id', type: 'string', required: true, desc: '流水 id' },
      { name: 'ledger[].type', type: 'string', required: true, desc: '类型：order_debit / refund_credit / balance_debit / deposit_credit / settle_credit / adjust' },
      { name: 'ledger[].amount', type: 'number', required: true, desc: '金额（正数入账，负数出账）' },
      { name: 'ledger[].orderNo', type: 'string|null', required: false, desc: '关联订单号' },
      { name: 'ledger[].rechargeNo', type: 'string|null', required: false, desc: '关联充值单号（RC 开头）' },
      { name: 'ledger[].note', type: 'string|null', required: false, desc: '备注' },
      { name: 'ledger[].createdAt', type: 'string', required: true, desc: '发生时间（ISO 8601）' },
      { name: 'total', type: 'number', required: true, desc: '流水总数' },
      { name: 'page', type: 'number', required: true, desc: '当前页码' },
      { name: 'pageSize', type: 'number', required: true, desc: '每页条数' },
    ],
    requestExample: 'GET /quota?page=1&pageSize=20',
    responseExample: JSON.stringify({
      quota: { quotaLimit: 1000, usedQuota: 12.5, availableQuota: 987.5, balance: 987.5 },
      ledger: [
        { id: 'lg_001', type: 'order_debit', amount: -9.9, orderNo: 'YX20260920120001', rechargeNo: null, note: '下单扣费', createdAt: '2026-09-20T12:00:01Z' },
        { id: 'lg_002', type: 'deposit_credit', amount: 100, orderNo: null, rechargeNo: 'RC20260920110001', note: '充值入账', createdAt: '2026-09-20T11:00:00Z' },
      ],
      total: 2, page: 1, pageSize: 20,
    }, null, 2),
  },
  {
    id: 'get-wallet',
    method: 'GET',
    path: '/wallet',
    title: '钱包总览',
    desc: '钱包总览：余额、欠款、授信阈值与充值记录。余额不足时可自动透支授信下单，欠款达到阈值后不可继续下单。',
    auth: 'read',
    response: [
      { name: 'wallet', type: 'object', required: true, desc: '钱包账户' },
      { name: 'wallet.balance', type: 'number', required: true, desc: '余额（优先扣减）' },
      { name: 'wallet.usedQuota', type: 'number', required: true, desc: '当前欠款' },
      { name: 'wallet.quotaLimit', type: 'number|null', required: false, desc: '授信阈值（许用欠款上限）' },
      { name: 'wallet.maxDebt', type: 'number|null', required: false, desc: '最大可透支额度' },
      { name: 'wallet.availableDebt', type: 'number|null', required: false, desc: '当前剩余可用透支额度' },
      { name: 'recharges', type: 'array', required: true, desc: '充值记录，按时间倒序' },
      { name: 'recharges[].rechargeNo', type: 'string', required: true, desc: '充值单号（RC 开头）' },
      { name: 'recharges[].amount', type: 'number', required: true, desc: '充值金额' },
      { name: 'recharges[].status', type: 'string', required: true, desc: '状态：pending / paid' },
      { name: 'recharges[].paidAt', type: 'string|null', required: false, desc: '支付时间' },
      { name: 'total', type: 'number', required: true, desc: '充值记录总数' },
    ],
    requestExample: codeBlock({}),
    responseExample: JSON.stringify({
      wallet: {
        balance: 987.5,
        usedQuota: 12.5,
        quotaLimit: 1000,
        maxDebt: 1000,
        availableDebt: 987.5,
      },
      recharges: [
        { rechargeNo: 'RC20260920110001', amount: 100, status: 'paid', paidAt: '2026-09-20T11:00:00Z', createdAt: '2026-09-20T10:59:00Z' },
      ],
      total: 1,
    }, null, 2),
  },
  {
    id: 'get-packages',
    method: 'GET',
    path: '/packages',
    title: '套餐列表',
    desc: '套餐列表，含当前主体的结算价（costPrice）与建议售价（price）。主体不可见的套餐不会返回。',
    auth: 'read',
    query: [
      { name: 'countryCode', type: 'string', required: false, desc: '国家/地区代码（ISO-2），如 CN' },
      { name: 'keyword', type: 'string', required: false, desc: '关键词（匹配名称）' },
      { name: 'page', type: 'number', required: false, desc: '页码，默认 1' },
      { name: 'pageSize', type: 'number', required: false, desc: '每页条数，默认 20' },
    ],
    response: [
      { name: 'packages', type: 'array', required: true, desc: '套餐列表' },
      { name: 'packages[].id', type: 'string', required: true, desc: '套餐 id（下单时作为 pkgId 传入）' },
      { name: 'packages[].name', type: 'string', required: true, desc: '套餐名称' },
      { name: 'packages[].nameEn', type: 'string', required: false, desc: '英文名称' },
      { name: 'packages[].countryCode', type: 'string', required: false, desc: '国家代码' },
      { name: 'packages[].countryName', type: 'string', required: false, desc: '国家名称' },
      { name: 'packages[].gb', type: 'number|null', required: false, desc: '流量（GB）' },
      { name: 'packages[].days', type: 'number|null', required: false, desc: '有效天数' },
      { name: 'packages[].isUnlimited', type: 'boolean', required: false, desc: '是否不限流量' },
      { name: 'packages[].price', type: 'number', required: true, desc: '结算/售价' },
      { name: 'packages[].costPrice', type: 'number|null', required: false, desc: '成本价' },
      { name: 'packages[].platformPrice', type: 'number|null', required: false, desc: '平台价' },
      { name: 'packages[].markupPercent', type: 'number|null', required: false, desc: '加价比例（%）' },
      { name: 'total', type: 'number', required: true, desc: '套餐总数' },
      { name: 'page', type: 'number', required: true, desc: '当前页码' },
      { name: 'pageSize', type: 'number', required: true, desc: '每页条数' },
    ],
    requestExample: 'GET /packages?countryCode=SG&keyword=5GB&page=1&pageSize=20',
    responseExample: JSON.stringify({
      packages: [
        { id: 'pkg_10274', name: '新加坡 5GB 7天', nameEn: 'Singapore 5GB 7D', countryCode: 'SG', countryName: '新加坡', gb: 5, days: 7, isUnlimited: false, price: 9.9, costPrice: 8, platformPrice: 10, markupPercent: 10 },
      ],
      total: 1, page: 1, pageSize: 20,
    }, null, 2),
  },
  {
    id: 'get-package',
    method: 'GET',
    path: '/packages/:pkgId',
    title: '套餐详情',
    desc: '按套餐 id 查询详情。主体不可见或套餐不存在时返回 404。',
    auth: 'read',
    query: [],
    response: [
      { name: 'pkg', type: 'object', required: true, desc: '套餐对象（字段同列表项）' },
    ],
    requestExample: 'GET /packages/pkg_10274',
    responseExample: JSON.stringify({
      pkg: { id: 'pkg_10274', name: '新加坡 5GB 7天', nameEn: 'Singapore 5GB 7D', countryCode: 'SG', countryName: '新加坡', gb: 5, days: 7, price: 9.9, costPrice: 8 },
    }, null, 2),
    defaultPath: { pkgId: 'pkg_10274' },
  },
  {
    id: 'get-regions',
    method: 'GET',
    path: '/regions',
    title: '国家/地区列表',
    desc: '返回当前可用国家/地区列表，用于套餐筛选及前端渲染。',
    auth: 'read',
    response: [
      { name: 'regions', type: 'array', required: true, desc: '国家/地区列表' },
      { name: 'regions[].code', type: 'string', required: true, desc: '国家代码（ISO-2）' },
      { name: 'regions[].name', type: 'string', required: true, desc: '国家名称（中文）' },
      { name: 'regions[].en', type: 'string', required: false, desc: '英文名称' },
      { name: 'regions[].flag', type: 'string', required: false, desc: '国旗图片 URL' },
    ],
    requestExample: codeBlock({}),
    responseExample: JSON.stringify({
      regions: [
        { code: 'CN', name: '中国', en: 'China', flag: 'https://example.com/flags/cn.png' },
        { code: 'SG', name: '新加坡', en: 'Singapore', flag: 'https://example.com/flags/sg.png' },
      ],
    }, null, 2),
  },
  {
    id: 'get-orders',
    method: 'GET',
    path: '/orders',
    title: '订单列表',
    desc: '订单列表（不含 eSIM 敏感信息），可按键状态筛选，按时间倒序。需要 eSIM 详情请调用订单详情接口。',
    auth: 'read',
    query: [
      { name: 'status', type: 'string', required: false, desc: '订单状态筛选：delivered / refunded / failed' },
      { name: 'page', type: 'number', required: false, desc: '页码，默认 1' },
      { name: 'pageSize', type: 'number', required: false, desc: '每页条数，默认 20' },
    ],
    response: [
      { name: 'orders', type: 'array', required: true, desc: '订单列表' },
      { name: 'orders[].orderNo', type: 'string', required: true, desc: '平台订单号' },
      { name: 'orders[].extOrderNo', type: 'string', required: false, desc: '接入方订单号（下单时传入）' },
      { name: 'orders[].status', type: 'string', required: true, desc: 'delivered / refunded / failed' },
      { name: 'orders[].pkgName', type: 'string', required: false, desc: '套餐名称' },
      { name: 'orders[].countryCode', type: 'string', required: false, desc: '国家代码' },
      { name: 'orders[].gb', type: 'number|null', required: false, desc: '流量（GB）' },
      { name: 'orders[].days', type: 'number|null', required: false, desc: '天数' },
      { name: 'orders[].cost', type: 'number', required: true, desc: '结算价（实扣）' },
      { name: 'orders[].createdAt', type: 'string', required: true, desc: '下单时间' },
      { name: 'orders[].refundedAt', type: 'string|null', required: false, desc: '退款时间' },
      { name: 'total', type: 'number', required: true, desc: '订单总数' },
      { name: 'page', type: 'number', required: true, desc: '当前页码' },
      { name: 'pageSize', type: 'number', required: true, desc: '每页条数' },
    ],
    requestExample: 'GET /orders?status=delivered&page=1&pageSize=20',
    responseExample: JSON.stringify({
      orders: [
        { orderNo: 'YX20260920120001', extOrderNo: 'export-20260920-001', status: 'delivered', pkgName: '新加坡 5GB 7天', countryCode: 'SG', gb: 5, days: 7, cost: 9.9, createdAt: '2026-09-20T12:00:01Z', refundedAt: null },
      ],
      total: 1, page: 1, pageSize: 20,
    }, null, 2),
  },
  {
    id: 'get-order',
    method: 'GET',
    path: '/orders/:orderNo',
    title: '订单详情',
    desc: '订单详情，已交付/已退款时含 eSIM 激活信息（激活码、SM-DP+ 地址）。',
    auth: 'read',
    query: [],
    response: [
      { name: 'order', type: 'object', required: true, desc: '订单对象（字段同列表项）' },
      { name: 'order.esim', type: 'object|null', required: false, desc: 'eSIM 信息' },
      { name: 'order.esim.iccid', type: 'string', required: true, desc: 'ICCID 卡号' },
      { name: 'order.esim.activationCode', type: 'string', required: true, desc: 'LPA 激活码' },
      { name: 'order.esim.smdp', type: 'string', required: true, desc: 'SM-DP+ 服务器地址' },
      { name: 'order.esim.status', type: 'string', required: false, desc: 'eSIM 状态' },
      { name: 'order.esim.expireAt', type: 'string', required: false, desc: '到期时间' },
      { name: 'order.esim.used', type: 'number', required: false, desc: '已用流量（MB）' },
    ],
    requestExample: 'GET /orders/YX20260920120001',
    responseExample: JSON.stringify({
      order: {
        orderNo: 'YX20260920120001', status: 'delivered', cost: 9.9, createdAt: '2026-09-20T12:00:01Z',
        esim: { iccid: '898603324505', activationCode: 'LPA:1$smdp.example.com$pol123', smdp: 'smdp.example.com', status: 'active', expireAt: '2026-09-27T12:00:00Z', used: 120 },
      },
    }, null, 2),
    defaultPath: { orderNo: 'YX20260920120001' },
  },
  {
    id: 'get-order-ext',
    method: 'GET',
    path: '/orders/ext/:extOrderNo',
    title: '订单反查',
    desc: '按接入方自定义订单号（extOrderNo）反查订单，便于与自有系统对账。',
    auth: 'read',
    query: [],
    response: [
      { name: 'order', type: 'object', required: true, desc: '订单对象（字段同订单详情）' },
    ],
    requestExample: 'GET /orders/ext/export-20260920-001',
    responseExample: JSON.stringify({
      order: { orderNo: 'YX20260920120001', extOrderNo: 'export-20260920-001', status: 'delivered', cost: 9.9, createdAt: '2026-09-20T12:00:01Z' },
    }, null, 2),
    defaultPath: { extOrderNo: 'export-20260920-001' },
  },
  {
    id: 'get-order-esim',
    method: 'GET',
    path: '/orders/:orderNo/esim',
    title: 'eSIM 用量',
    desc: '查询指定订单的 eSIM 激活信息与实时用量。',
    auth: 'read',
    query: [],
    response: [
      { name: 'esim', type: 'object', required: true, desc: 'eSIM 信息' },
      { name: 'esim.iccid', type: 'string', required: true, desc: 'ICCID 卡号' },
      { name: 'esim.activationCode', type: 'string', required: true, desc: 'LPA 激活码' },
      { name: 'esim.smdp', type: 'string', required: true, desc: 'SM-DP+ 地址' },
      { name: 'esim.status', type: 'string', required: false, desc: 'eSIM 状态' },
      { name: 'esim.used', type: 'number', required: false, desc: '已用流量（MB）' },
      { name: 'esim.expireAt', type: 'string', required: false, desc: '到期时间' },
    ],
    requestExample: 'GET /orders/YX20260920120001/esim',
    responseExample: JSON.stringify({
      esim: { iccid: '898603324505', activationCode: 'LPA:1$smdp.example.com$pol123', smdp: 'smdp.example.com', status: 'active', used: 120, expireAt: '2026-09-27T12:00:00Z' },
    }, null, 2),
    defaultPath: { orderNo: 'YX20260920120001' },
  },
  {
    id: 'get-refund',
    method: 'GET',
    path: '/refunds/:refundNo',
    title: '退款单查询',
    desc: '按退款单号查询退款结果与冲回情况。',
    auth: 'read',
    query: [],
    response: [
      { name: 'data', type: 'object', required: true, desc: '退款单信息（按实际返回字段为准）' },
    ],
    requestExample: 'GET /refunds/RF20260920120001',
    responseExample: JSON.stringify({
      data: { refundNo: 'RF20260920120001', orderNo: 'YX20260920120001', status: 'refunded', amount: 9.9, createdAt: '2026-09-20T13:00:00Z' },
    }, null, 2),
    defaultPath: { refundNo: 'RF20260920120001' },
  },
  {
    id: 'get-card-detail',
    method: 'GET',
    path: '/cards/:iccid',
    title: '查询卡详情',
    desc: '查询某张 ICCID 卡号的详细信息：该卡是否已绑定套餐、绑定了哪些套餐，以及每个套餐的当前状态（激活/生效/到期等）。',
    auth: 'read',
    query: [],
    response: [
      { name: 'iccid', type: 'string', required: true, desc: '查询的 ICCID 卡号' },
      { name: 'card', type: 'object', required: true, desc: '卡片基础信息' },
      { name: 'card.status', type: 'string', required: false, desc: '卡片状态（active/inactive 等）' },
      { name: 'card.category', type: 'string', required: false, desc: '卡片类型' },
      { name: 'packages', type: 'array', required: true, desc: '该卡绑定的套餐列表（未绑定则为空数组）' },
      { name: 'packages[].name', type: 'string', required: false, desc: '套餐名称' },
      { name: 'packages[].status', type: 'string', required: true, desc: '套餐状态（active/expired/pending 等）' },
      { name: 'packages[].activatedAt', type: 'string', required: false, desc: '启用/生效时间' },
      { name: 'packages[].expireAt', type: 'string', required: false, desc: '到期时间' },
      { name: 'packages[].days', type: 'number', required: false, desc: '套餐有效天数' },
    ],
    requestExample: codeBlock({}),
    responseExample: JSON.stringify({
      iccid: '898603324505',
      card: { status: 'active', category: 'data' },
      packages: [
        { id: 98901, name: '新加坡 5GB 7天', status: 'active', activatedAt: '2026-09-20T12:00:00Z', expireAt: '2026-09-27T12:00:00Z', days: 7 },
      ],
    }, null, 2),
    defaultPath: { iccid: '898603324505' },
  },
];

export const WRITE_ENDPOINTS: EndpointSpec[] = [
  {
    id: 'post-orders',
    method: 'POST',
    path: '/orders',
    title: '授信下单',
    desc: '按授信下单：实时开卡并交付 eSIM。余额充足则扣余额，不足部分透支授信（欠款）；透支后总欠款不可超过授信阈值，否则返回 409。',
    auth: 'write',
    body: [
      { name: 'pkgId', type: 'string', required: true, desc: '套餐 id（取 /packages 返回项的 id）' },
      { name: 'email', type: 'string', required: true, desc: '接收 eSIM 激活信息的邮箱' },
      { name: 'extOrderNo', type: 'string', required: false, desc: '接入方订单号，用于对账/反查（建议全局唯一）' },
    ],
    response: [
      { name: 'orderNo', type: 'string', required: true, desc: '平台订单号' },
      { name: 'status', type: 'string', required: true, desc: '交付状态：delivered' },
      { name: 'cost', type: 'number', required: true, desc: '实际结算金额（扣款额）' },
      { name: 'created', type: 'string', required: true, desc: '下单时间（ISO 8601）' },
      { name: 'esim', type: 'object', required: true, desc: '交付的 eSIM 信息' },
      { name: 'esim.iccid', type: 'string', required: true, desc: 'ICCID 卡号' },
      { name: 'esim.activationCode', type: 'string', required: true, desc: 'LPA 激活码' },
      { name: 'esim.smdp', type: 'string', required: true, desc: 'SM-DP+ 地址' },
    ],
    requestExample: JSON.stringify({ pkgId: 'pkg_10274', email: 'user@example.com', extOrderNo: 'export-20260920-001' }, null, 2),
    responseExample: JSON.stringify({
      orderNo: 'YX20260920120001', status: 'delivered', cost: 9.9, created: '2026-09-20T12:00:01Z',
      esim: { iccid: '898603324505', activationCode: 'LPA:1$smdp.example.com$pol123', smdp: 'smdp.example.com' },
    }, null, 2),
    defaultBody: { pkgId: 'pkg_10274', email: 'user@example.com', extOrderNo: 'export-20260920-001' },
  },
  {
    id: 'post-refund',
    method: 'POST',
    path: '/orders/:orderNo/refunds',
    title: '申请退款',
    desc: '仅未激活（实际未使用）的交付订单可退。退款优先冲抵欠款，剩余回补余额。',
    auth: 'write',
    query: [],
    body: [
      { name: 'extRefundNo', type: 'string', required: false, desc: '接入方退款单号（建议全局唯一）' },
      { name: 'amount', type: 'number', required: false, desc: '退款金额，不传则全额退' },
      { name: 'reason', type: 'string', required: false, desc: '退款原因' },
    ],
    response: [
      { name: 'data', type: 'object', required: true, desc: '退款结果（以实际返回字段为准）' },
    ],
    requestExample: JSON.stringify({ extRefundNo: 'rf-export-001', reason: '客户不需要了' }, null, 2),
    responseExample: JSON.stringify({
      data: { refundNo: 'RF20260920120001', orderNo: 'YX20260920120001', status: 'refunded', amount: 9.9 },
    }, null, 2),
    defaultPath: { orderNo: 'YX20260920120001' },
    defaultBody: { extRefundNo: 'rf-export-001', reason: '客户不需要了' },
  },
  {
    id: 'post-keys',
    method: 'POST',
    path: '/keys',
    title: '创建 API 密钥',
    desc: '自助创建一把 API 密钥（读写或只读）。keySecret 仅在本次响应中完整返回一次，请妥善保存，后续不可再查询。',
    auth: 'write',
    body: [
      { name: 'name', type: 'string', required: false, desc: '密钥备注名，默认 default' },
      { name: 'mode', type: 'string', required: false, desc: '密钥模式：live（读写，默认）/ read（只读）' },
    ],
    response: [
      { name: 'keyId', type: 'string', required: true, desc: '公开密钥 ID（ak_ 开头）' },
      { name: 'keySecret', type: 'string', required: true, desc: '密钥密文（仅本次返回一次）' },
      { name: 'mode', type: 'string', required: true, desc: '密钥模式' },
      { name: 'name', type: 'string', required: true, desc: '密钥备注名' },
    ],
    requestExample: JSON.stringify({ name: '生产环境', mode: 'live' }, null, 2),
    responseExample: JSON.stringify({
      keyId: 'ak_live_7f3a9c21', keySecret: 'c41f...64f2', mode: 'live', name: '生产环境',
    }, null, 2),
    defaultBody: { name: '生产环境', mode: 'live' },
  },
  {
    id: 'post-webhook-retry',
    method: 'POST',
    path: '/orders/:orderNo/webhook/retry',
    title: '重发回调',
    desc: '手动重发该订单的交付回调（order.delivered / order.refunded）。适用于回调丢失或对账补发场景。',
    auth: 'write',
    query: [],
    body: [],
    response: [
      { name: 'data', type: 'object', required: true, desc: '重发结果（以实际返回字段为准）' },
    ],
    requestExample: codeBlock({}),
    responseExample: JSON.stringify({ data: { retried: true } }, null, 2),
    defaultPath: { orderNo: 'YX20260920120001' },
    defaultBody: {},
  },
];

export const ALL_ENDPOINTS: EndpointSpec[] = [...READ_ENDPOINTS, ...WRITE_ENDPOINTS];

/** 右侧大纲：元信息章节（鉴权/响应结构/错误码/读/写/结算/Webhook） */
export interface OutlineSection {
  id: string;
  label: string;
}

export const META_SECTIONS: OutlineSection[] = [
  { id: 'auth', label: '一、鉴权与签名' },
  { id: 'envelope', label: '二、响应结构' },
  { id: 'errors', label: '三、错误码' },
  { id: 'read', label: '四、读接口' },
  { id: 'write', label: '五、写接口' },
  { id: 'wallet', label: '六、余额与结算' },
  { id: 'webhook', label: '七、Webhook 回调' },
];

export const API_BASE = 'https://<你的域名>/api/open/v1';