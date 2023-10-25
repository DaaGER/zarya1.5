// us-des-apus.auroraplatform.com


const ZARYA_PORT = process.env.port || 7080;

const args = process.argv.slice(2);
const FAKE_MODE = args[0] === 'fake'

let uWS = require("uWebSockets.js")

let WebSocket = require('ws')
global.WebSocket = WebSocket;
let Sockette = require('sockette');
let fs = require('fs')
let exec = require('child_process').exec;

const {Pool} = require('pg');
const db = new Pool({
    host: '127.0.0.1',
    user: 'app',
    password: 'DF2dS*zJd',
    database: 'app'
});

//db.connect(err => {
//    if (err) {
//        console.error('db connection error', err.stack)
//    } else {
//        console.log('db connected')
//    }
//})


async function allowUser(data, ws) {
    ws.authed = true
    ws.send(JSON.stringify([{T: 'success', msg: 'connected'}]));
    return 0;
    try {
        if (data.action !== 'auth') {
            ws.send(JSON.stringify([{T: 'error', msg: 'not auth'}]));
            return 0;
        }
        if (data.auth_type === 'mobile') {
            console.log(new Date().toLocaleString('ru') + '| Чекаем пользователя: ');
            let query = `SELECT "id", "name", "telegram_id", "telegram_name", "print_us"
                         FROM "djangoApp_myuser"
                         WHERE "token" = '${data.secret}'
                           AND "print_us" = true LIMIT 1`
            await db.query(query,
                function (err, results) {
                    if (err) {
                        console.error(new Date().toLocaleString('ru') + '| error', err);
                        ws.send(JSON.stringify([{T: 'error', msg: 'authed'}]));
                    }
                    if (results.rowCount > 0) {
                        console.info(new Date().toLocaleString('ru') + '| allow user ' + data.secret + " " + results.rows[0].name);
                        ws.authed = true
                        ws.send(JSON.stringify([{T: 'success', msg: 'connected'}]));
                    } else {
                        ws.send(JSON.stringify([{T: 'error', msg: 'not allow'}]));
                    }
                    console.log("\r\n------\r\n");
                }
            );
        } else {
            ws.authed = true
            ws.send(JSON.stringify([{T: 'success', msg: 'connected'}]));
        }
    } catch (e) {
        console.error(e, data)
    }
}

let createClient = require('redis').createClient;

//на самом деле мы коннектимся к key db
//const KEYDB_PORT = FAKE_MODE ? 6379 : 6380;
const KEYDB_PORT = 6379;

const redis = createClient({url: 'redis://localhost:' + KEYDB_PORT + '/2'});


let aurora_users = JSON.parse(fs.readFileSync('./users.json', 'utf8'));
let groups_ticker = JSON.parse(fs.readFileSync('./groups.json', 'utf8'));
let global_stop = false;


const colors = [
    //fg
    "\x1b[30m",
    "\x1b[31m",
    "\x1b[32m",
    "\x1b[33m",
    "\x1b[34m",
    "\x1b[35m",
    "\x1b[36m",
    "\x1b[37m",
//bg
    "\x1b[40m",
    "\x1b[41m",
    "\x1b[42m",
    "\x1b[43m",
    "\x1b[44m",
    "\x1b[45m",
    "\x1b[46m",
    "\x1b[47m",
    "*",
    "-",
    ">",
    "!",
]

let showReceived = false;
if (FAKE_MODE) {
    console.log('FAKE_MODE')
    showReceived = true;
}
let last_quotes = {};

function custom_ping() {
    console.info(new Date().toLocaleString("ru"), 'пинг')
    setTimeout(function () {
        app.publish('broadcast', '{}')
        custom_ping()
    }, 30000)
}

let app = uWS.App({}).ws('/*', {
    /* Options */
    // compression: uWS.SHARED_COMPRESSOR,
    maxBackpressure: 10 * 1024 * 1024,
    maxPayloadLength: 10 * 1024 * 1024,
    sendPingsAutomatically: true,
    open: (ws) => {
        console.log('Zarya| A WebSocket connected!');
        ws.subscribe('broadcast');
    },
    message: (ws, message) => {
        // let remote_address=Buffer.from(ws.getRemoteAddressAsText()).toString()
        // console.info(remote_address)
        let message_data = Buffer.from(message).toString()
        let message_object = {}
        console.info(new Date().toLocaleString("ru"), message_data)
        try {
            message_object = JSON.parse(message_data);
        } catch (e) {
            message_object = {}
        }
        try {
            if (!ws.authed) {
                allowUser(message_object, ws)
                return 0;
            }
        } catch (e) {
            console.error(e, 'Проблемы с авторизацией')
        }


        try {
            if (message_object.action === 'subscribe') {
                if (!!message_object.trades) {
                    message_object.trades.forEach(async (ticker) => {
                        let lastTrades = await getLastTrades(ticker, 100)
                        if (lastTrades) {
                            ws.send(JSON.stringify(lastTrades))
                        }
                        ws.subscribe('/aurora/trades/' + ticker)
                    })
                }
                if (!!message_object.quotes) {
                    message_object.quotes.forEach(async function (ticker) {
                        let lastQuotes = await getLastQuotes(ticker, 20)
                        if (lastQuotes) {
                            ws.send(JSON.stringify(lastQuotes))
                        }
                        ws.subscribe('/aurora/quotes/' + ticker)
                    })
                }
                return 0;
            }
            if (message_object.action === 'unsubscribe') {
                if (!!message_object.trades) {
                    message_object.trades.forEach(ticker => ws.unsubscribe('/aurora/trades/' + ticker))
                }
                if (!!message_object.quotes) {
                    message_object.quotes.forEach(ticker => ws.unsubscribe('/aurora/quotes/' + ticker))
                }
                return 0;
            }
        } catch (e) {
            console.error(e, 'Проблемы подписка/отписками')
        }
    }
    ,
    drain: (ws) => {
        console.log('Zarya| WebSocket backpressure: ' + ws.getBufferedAmount());
    },
    close:
        (ws, code, message) => {
            console.log('Zarya| WebSocket closed ' + code);
            console.log(Buffer.from(message).toString());
        }
})
    .get('/ping', async (res, req) => {
        res
            .writeStatus('200 OK')
            .writeHeader('Content-Type', 'text/plain;charset=UTF-8')
            .end('pong');
    })
    .get('/aurora_data', async (res, req) => {
        res
            .writeStatus('200 OK')
            .writeHeader('Content-Type', 'application/json;charset=UTF-8')
            .end(JSON.stringify(wsClients));
    })
    .get('/tickers_data', async (res, req) => {
        res
            .writeStatus('200 OK')
            .writeHeader('Content-Type', 'application/json;charset=UTF-8')
            .end(JSON.stringify(tickers_data));
    })
    .get('/reconnect/:index', async (res, req) => {
        let index = parseInt(req.getParameter(0));

        if (index > -1) {
            if (wsClients[index]) {
                wsClients[index].close()
                wsClients[index].open()
            } else {
                let group = groups_ticker[index];
                let port = 7000 + index;
                let login = aurora_users[index].mail
                let pass = aurora_users[index].pass

                newWS(port, index, login, pass, group);
            }
        }

        res
            .writeStatus('200 OK')
            .writeHeader('Content-Type', 'application/json;charset=UTF-8')
            .end('ok');
    })
    .get('/topics/:topic', async (res, req) => {
        let topic = req.getParameter(0) || 'broadcast';

        res
            .writeStatus('200 OK')
            .writeHeader('Content-Type', 'text/plain;charset=UTF-8')
            .end(app.numSubscribers(topic).toString());
    })
    .get('/ticker_subscribers', async (res, req) => {
        const tickerSubscribers = {};

        for (const tickers of groups_ticker) {
            for (const ticker of tickers) {
                const subscribers = app.numSubscribers('/aurora/trades/' + ticker);
                tickerSubscribers[ticker] = subscribers;
            }
        }

        const sortedTickers = Object.keys(tickerSubscribers).sort((a, b) => {
            return tickerSubscribers[b] - tickerSubscribers[a];
        });

        const sortedTickerSubscribers = {};
        for (const ticker of sortedTickers) {
            sortedTickerSubscribers[ticker] = tickerSubscribers[ticker];
        }

        res
            .writeStatus('200 OK')
            .writeHeader('Content-Type', 'application/json;charset=UTF-8')
            .end(JSON.stringify(sortedTickerSubscribers));
    })
    .get('/last/trades/:ticker', async (res, req) => {
        res.onAborted(() => {
            res.aborted = true;
        });
        let result = '{}';
        let ticker = req.getParameter(0);

        let redisData = await getLastTrades(ticker, 20)
        if (redisData) {
            result = JSON.stringify(redisData)
        }

        if (!res.aborted) {
            res
                .writeStatus('200 OK')
                .writeHeader('Content-Type', 'application/json;charset=UTF-8')
                .end(result);
        }
    })
    .get('/last/quotes/:ticker', async (res, req) => {
        res.onAborted(() => {
            res.aborted = true;
        });
        let result = '{}';
        let ticker = req.getParameter(0);

        let redisData = await getLastQuotes(ticker, 20)

        if (redisData) {
            result = JSON.stringify(redisData)
        }

        if (!res.aborted) {
            res
                .writeStatus('200 OK')
                .writeHeader('Content-Type', 'application/json;charset=UTF-8')
                .end(result);
        }

    })
    .get('/show_received', async (res, req) => {
        showReceived = !showReceived;
        res
            .writeStatus('200 OK')
            .writeHeader('Content-Type', 'text/plain;charset=UTF-8')
            .end('' + showReceived);
    })
    .get('/close/:index', async (res, req) => {
        let index = parseInt(req.getParameter(0));

        if (index > -1) {
            if (wsClients[index]) {
                wsClients[index].close()
            }
        }

        res
            .writeStatus('200 OK')
            .writeHeader('Content-Type', 'application/json;charset=UTF-8')
            .end('ok');
    })
    .get('/resubscribe', async (res, req) => {
        res.onAborted(() => {
            res.aborted = true;
        });

        try {
            // Отписываемся от всех бумаг в каждом инстансе
            for (let index = 0; index < wsClients.length; index++) {
                const client = wsClients[index];
                if (client.aurora.subscribed) {
                    let unsubscribe = {
                        action: 'unsubscribe',
                        trades: client.aurora.tickers,
                        quotes: client.aurora.tickers
                    };
                    client.json(unsubscribe);
                    client.aurora.subscribed = false;
                    await timer(1000); // Пауза перед повторной подпиской
                }
            }

            // Повторно подписываемся на бумаги в каждом инстансе
            for (let index = 0; index < wsClients.length; index++) {
                const client = wsClients[index];
                if (!global_stop && client.aurora.authed && !client.aurora.subscribed) {
                    const group = groups_ticker[index];
                    subscribe(index, group, true);
                    await timer(5000); // Пауза перед следующей подпиской
                }
            }
        } catch (e) {
            console.error('Resubscribe, поломались', e);
        }

        if (!res.aborted) {
            res
                .writeStatus('200 OK')
                .writeHeader('Content-Type', 'application/json;charset=UTF-8')
                .end('{}');
        }
    })
    .get('/close_all', async (res, req) => {

        wsClients.forEach(ws => ws.close)

        res
            .writeStatus('200 OK')
            .writeHeader('Content-Type', 'application/json;charset=UTF-8')
            .end('ok');
    })
    .listen(ZARYA_PORT, (listenSocket) => {
        if (listenSocket) {
            console.log(`Zarya| Listening to port ${ZARYA_PORT}`);
        }
        custom_ping()
    });

function getLastTrades(ticker, maxCount) {
    return getLast('trades', ticker, maxCount)
}

function getLastQuotes(ticker, maxCount) {
    return getLast('quotes', ticker, maxCount)
}

async function getLast(key, ticker, maxCount) {
    let result = {};
    let redis_key = `last-${key}-` + ticker;

    let data = await redis.lRange(redis_key, -1 * maxCount, -1)
    if (data) {
        result = JSON.parse("[" + data + "]").map(item => item[0])
    }

    return result;
}

function toConsole(index, text, type = 'log') {
    let time = new Date().toLocaleString("ru");
    let msg = `%s${index}%s| ${text}\t${time}`;
    switch (type) {
        case 'error':
            return console.error(msg, colors[index], '\x1b[0m');
        case 'info':
            return console.info(msg, colors[index], '\x1b[0m');
        default:
            return console.log(msg, colors[index], '\x1b[0m')
    }
}

let wsClients = [];
let tickers_data = {}

function newWS(port, index, login, pass, group) {
    let url = 'ws://127.0.0.1:' + port;
    toConsole(index, '-- Подключаемся к ' + url + ' --')
    tickers_data[index] = {trades: null, quotes: null};
    wsClients[index] = new Sockette(url, {
        timeout: 7000 * index,
        maxAttempts: 5,
        onopen: function () {
            wsClients[index].aurora = {};
            wsClients[index].aurora.connected = false;
            wsClients[index].aurora.docker = {};
            wsClients[index].aurora.authed = false;
            wsClients[index].aurora.closed = false;
            wsClients[index].aurora.subscribed = false;
            wsClients[index].aurora.tickers = {};
            wsClients[index].aurora.errors = [];
            toConsole(index, 'Открыли соединение')
            toConsole(index, 'Авторизуемся')
            let auth = {"action": "auth", "key": login, "secret": pass}
            wsClients[index].aurora.auth = auth;
            wsClients[index].json(auth);

            let container_name = 'aurora_instance_' + index;
            exec(`docker ps -aqf "name=${container_name}$"`, function (err, stdout, stderr) {
                wsClients[index].aurora.docker.container_id = stdout.trim();
            });
        },
        onmessage: function (e) {
            try {
                if (showReceived) {
                    toConsole(index, new Date() + 'received: ' + e.data);
                }
                let data = JSON.parse(e.data)

                //если пришел принт или стакан, кидаем в канал
                if (wsClients[index].aurora.authed && data[0].T === 't') {
                    let ticker = data[0].S
                    data[0].type = ''
                    //data[0].debug = {bp: last_quotes[ticker]?.bp, ap: last_quotes[ticker]?.ap}
                    if (!!last_quotes[ticker]?.bp && !!last_quotes[ticker]?.ap) {
                        let midpoint = (last_quotes[ticker].bp + last_quotes[ticker].ap) / 2
                        // data[0].debug.midpoint = midpoint;
                        if (data[0].p < midpoint) {
                            data[0].type = 'sell'
                        }
                        if (data[0].p > midpoint) {
                            data[0].type = 'buy'
                        }
                    }
                    let newData = JSON.stringify(data)
                    app.publish('/aurora/trades/' + ticker, newData)

                    tickers_data[index].trades = ticker + ' ' + new Date().toLocaleString('ru');
                    let redisKey = "last-trades-" + ticker

                    redis.rPush(redisKey, newData)
                    return 0;
                }
                if (wsClients[index].aurora.authed && data[0].T === 'q') {
                    let ticker = data[0].S
                    last_quotes[ticker] = data[0]
                    app.publish('/aurora/quotes/' + ticker, e.data)

                    tickers_data[index].quotes = ticker + ' ' + new Date().toLocaleString('ru');
                    let redisKey = "last-quotes-" + ticker
                    redis.rPush(redisKey, e.data)
                    return 0;
                }


                if (data[0].T === 'error') {
                    wsClients[index].aurora.errors.push([new Date().toLocaleString('ru'), data[0]])
                    if (data[0].code === 429) {
                        global_stop = true;
                    }
                    if (data[0].code === 400) {
                        toConsole(index, '400 reconnect');
                        wsClients[index].close();
                        setTimeout(() => wsClients[index].open(), 5000 + (index * 1000))
                    }

                    return 0;
                }
                if (data[0].T === 'success') {
                    if (data[0].msg === 'connected') {
                        toConsole(index, 'Подключились')
                        wsClients[index].aurora.connected = true;
                    } else if (data[0].msg === 'authenticated') {
                        toConsole(index, 'Авторизовались')
                        wsClients[index].aurora.authed = true;
                    }
                    if (wsClients[index].aurora.authed && !wsClients[index].aurora.subscribed) {
                        toConsole(index, 'Подписываемся на принты и стаканы')
                        subscribe(index, group)
                        wsClients[index].aurora.subscribed = true;
                    }

                    return 0;
                }
            } catch (e) {
                console.error(index, e)
            }

        },
        onreconnect: e => toConsole(index, 'Reconnecting...', 'info'),
        onmaximum: function (e) {
            //TODO сигнализирование о проблеме
            toConsole(index, 'Что-то сломалось и мы не можем подключиться!', 'error')
        },
        onclose: e => {
            toConsole(index, 'Closed', 'error');
            console.error(e);
            if (wsClients[index].aurora && wsClients[index].aurora.closed) {
                wsClients[index].aurora.closed = true
            }
        },
        onerror: e => toConsole(index, 'Error', 'error')
    });

}

const timer = ms => new Promise(res => setTimeout(res, ms))


async function main() {
    redis.connect().then(async () => {
        for (const group of groups_ticker) {
            if (global_stop) {
                break;
            }
            const index = groups_ticker.indexOf(group);

            let port = 7000 + index;
            if (FAKE_MODE) {
                port = 7777;
            }
            console.log(aurora_users[index])
            let login = aurora_users[index].mail
            let pass = aurora_users[index].pass

            newWS(port, index, login, pass, group);
            await timer(5000);
            if (FAKE_MODE) {
                break;
            }
        }
    }).then(() => process.send('ready'))
        .catch(e => console.error(e))

    redis.on('error', () => {
        console.error('Disconnected from Redis ERROR. Reconnecting...');
    });
}


function subscribe(index, group, re = false) {
    if (wsClients[index] && wsClients[index].aurora.authed) {
        toConsole(index, re ? 'РЕподписка' : 'Подписка')
        let subscribe = {}
        const chunkSize = 10;
        // Разбивка на случай, если аврора не любит массовые подписки
        for (let i = 0; i < group.length; i += chunkSize) {
            const chunk = group.slice(i, i + chunkSize);
            subscribe = {
                action: 'subscribe',
                trades: chunk,
                quotes: chunk
            };
            wsClients[index].json(subscribe)
            wsClients[index].aurora.tickers[i] = chunk;

        }
    }
}

main()

process.on('SIGINT', function () {
    wsClients.forEach(ws => ws.close)
    process.exit(0)
})