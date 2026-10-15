const APP_TITLE = '台股投資紀錄';
const TRADES_SHEET = '交易紀錄';

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle(APP_TITLE)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getInitialData() {
  const sheet = getTradeSheet_();
  const rows = sheet.getDataRange().getValues();
  const trades = rows.slice(1).filter(r => r[0]).map(r => ({
    id: String(r[0]), date: dateString_(r[1]), code: String(r[2]),
    name: String(r[3]), side: String(r[4]), shares: Number(r[5]),
    price: Number(r[6]), fee: Number(r[7]) || 0, tax: Number(r[8]) || 0,
    note: String(r[9] || '')
  }));
  return { trades, quotes: { prices: {}, asOf: '', source: '盤後行情', error: '' }, news: {}, sheetUrl: getSpreadsheet_().getUrl() };
}

function getQuotesForPortfolio() {
  const trades = getInitialData().trades;
  const codes = [...new Set(trades.map(t => t.code))];
  return getQuotes_(codes);
}

function getNewsForPortfolio() {
  return getNews_(getInitialData().trades);
}

function addTrade(form) {
  const code = String(form.code || '').trim();
  const name = String(form.name || '').trim();
  const side = String(form.side || '');
  const shares = Number(form.shares);
  const price = Number(form.price);
  const fee = Number(form.fee) || 0;
  const tax = Number(form.tax) || 0;
  if (!/^\d{4,6}$/.test(code)) throw new Error('請輸入 4 至 6 碼台股代號。');
  if (!name) throw new Error('請輸入股票名稱。');
  if (!['買進', '賣出'].includes(side)) throw new Error('請選擇買進或賣出。');
  if (!(shares > 0) || !(price > 0) || fee < 0 || tax < 0) throw new Error('股數與價格需大於 0，手續費與交易稅不可小於 0。');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getTradeSheet_();
    if (side === '賣出') {
      const rows = sheet.getDataRange().getValues().slice(1).filter(r => String(r[2]) === code);
      const available = rows.reduce((sum, r) => sum + (String(r[4]) === '買進' ? Number(r[5]) : -Number(r[5])), 0);
      if (shares > available) throw new Error('賣出股數超過目前紀錄的庫存（' + available + ' 股）。');
    }
    sheet.appendRow([Utilities.getUuid(), form.date || new Date(), code, name, side, shares, price, fee, tax, String(form.note || '')]);
    SpreadsheetApp.flush();
  } finally { lock.releaseLock(); }
  return getInitialData();
}

function deleteTrade(id) {
  const sheet = getTradeSheet_();
  const rows = sheet.getDataRange().getValues();
  for (let i = rows.length - 1; i > 0; i--) {
    if (String(rows[i][0]) === String(id)) { sheet.deleteRow(i + 1); break; }
  }
  return getInitialData();
}

function getSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('PORTFOLIO_SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  const ss = SpreadsheetApp.create('台股投資紀錄');
  const sheet = ss.getSheets()[0];
  sheet.setName(TRADES_SHEET);
  sheet.appendRow(['紀錄編號', '交易日期', '股票代號', '股票名稱', '交易類別', '股數', '成交價', '手續費', '交易稅', '備註']);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, 10).setFontWeight('bold').setBackground('#edf2f7');
  props.setProperty('PORTFOLIO_SHEET_ID', ss.getId());
  return ss;
}

function getTradeSheet_() {
  const ss = getSpreadsheet_();
  return ss.getSheetByName(TRADES_SHEET) || ss.insertSheet(TRADES_SHEET);
}

function getQuotes_(codes) {
  if (!codes.length) return { prices: {}, asOf: Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm'), source: 'TWSE／TPEx OpenAPI（盤後）', error: '' };
  const cache = CacheService.getScriptCache();
  const cacheKey = 'quotes:' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMdd');
  let all = cache.get(cacheKey);
  let error = '';
  if (all) all = JSON.parse(all);
  else {
    all = {};
    const sources = [
      { url: 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL', keys: ['Code','Name','ClosingPrice'] },
      { url: 'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes', keys: ['SecuritiesCompanyCode','CompanyName','Close'] }
    ];
    sources.forEach(source => {
      try {
        const response = UrlFetchApp.fetch(source.url, { muteHttpExceptions: true, headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (response.getResponseCode() !== 200) throw new Error('HTTP ' + response.getResponseCode());
        JSON.parse(response.getContentText()).forEach(item => {
          const code = String(item[source.keys[0]] || item.Code || item.SecuritiesCode || '').trim();
          const name = String(item[source.keys[1]] || item.Name || item.SecuritiesName || '').trim();
          const raw = item[source.keys[2]] || item.ClosingPrice || item.Close || item['收盤'] || '';
          const price = Number(String(raw).replace(/,/g, ''));
          if (code && Number.isFinite(price) && price > 0) all[code] = { code, name, price };
        });
      } catch (e) { error = '行情來源暫時無法連線，請稍後重試。'; }
    });
    cache.put(cacheKey, JSON.stringify(all), 600);
  }
  const prices = {};
  codes.forEach(code => { if (all[code]) prices[code] = all[code]; });
  return { prices, asOf: Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm'), source: 'TWSE／TPEx OpenAPI（盤後）', error };
}

function getNews_(trades) {
  const latest = {};
  trades.forEach(t => { latest[t.code] = t.name; });
  const result = {};
  Object.keys(latest).slice(0, 8).forEach(code => {
    const query = encodeURIComponent(code + ' ' + latest[code] + ' 台股');
    try {
      const url = 'https://news.google.com/rss/search?q=' + query + '&hl=zh-TW&gl=TW&ceid=TW:zh-Hant';
      const xml = XmlService.parse(UrlFetchApp.fetch(url, { muteHttpExceptions: true }).getContentText());
      result[code] = xml.getRootElement().getChild('channel').getChildren('item').slice(0, 4).map(item => ({
        title: item.getChildText('title'), link: item.getChildText('link'), date: item.getChildText('pubDate'), source: item.getChildText('source') || 'Google 新聞'
      }));
    } catch (e) { result[code] = []; }
  });
  return result;
}

function dateString_(value) {
  if (value instanceof Date) return Utilities.formatDate(value, 'Asia/Taipei', 'yyyy-MM-dd');
  return String(value || '');
}

