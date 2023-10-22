const axios = require('axios');
const fs = require('fs')
const cliProgress = require('cli-progress');

let tickers = {};

const needPrints = (row) => row.currency === 'USD' && row.instrument_type === 'stock' && row.exchange_ru === 'SPBX';

const parseTickers = () => {
    return axios.get('https://ipa.oost.app/api/v1/stocks/').then(response => {
        response.data.forEach(function (item) {
            if (needPrints(item)) {
                tickers[item.ticker] = 0
            }
        })
    })
}


const bar1 = new cliProgress.SingleBar();
parseTickers().then(async () => {
    let tickers_length = Object.keys(tickers).length;
    bar1.start(tickers_length + 1, 0);
    const chunkSize = 75;
    for (let i = 0; i < tickers_length; i += chunkSize) {
        const chunk = Object.entries(tickers).slice(i, i + chunkSize).map(item => item[0]);
        let url = "https://market.tipranks.com/api/quotes/GetQuotes?tickers=" + chunk.join(",");
        await axios.get(url).then(response => {
            response.data.quotes.forEach(function (item) {
                tickers[item.ticker] = parseInt(item.volume / 3);
            })
            bar1.increment(response.data.quotes.length)
        })
    }
}).then(() => {
    const sortable = Object.fromEntries(
        Object.entries(tickers).sort(([, a], [, b]) => a - b).reverse()
    );

    fs.writeFileSync('./volumes.json', JSON.stringify(sortable))
    bar1.stop();
})


