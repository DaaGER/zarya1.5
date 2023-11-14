FROM node:18-slim

WORKDIR /ppp

#прописать в utex-alpaca import uWS from '../../uWebSockets.js/uws.js';
#ppp/salt/states/ppp/lib/aspirant-worker/utex-alpaca/utex-alpaca.mjs

COPY ./ppp/lib/utex /ppp/lib/utex
COPY ./ppp/vendor/uWebSockets.js /ppp/vendor/uWebSockets.js
COPY ./ppp/vendor/lzma /ppp/vendor/lzma
COPY ./ppp/vendor/protobuf.min.js /ppp/vendor/protobuf.min.js
COPY ./ppp/vendor/ioredis.min.js /ppp/vendor/ioredis.min.js
COPY ./ppp/lib/aspirant-worker/utex-alpaca /ppp/lib/aspirant-worker/utex-alpaca
COPY ./ppp/lib/aspirant-worker/utils.mjs /ppp/lib/aspirant-worker/utils.mjs

ENV DEBUG=true
ENV UTEX_US_DATA_SERVER_LIST=us-chs-lyra.auroraplatform.com:34002
CMD ["node", "/ppp/lib/aspirant-worker/utex-alpaca/utex-alpaca.mjs"]
