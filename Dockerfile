FROM node:18-slim

WORKDIR /var/app

#прописать в utex-alpaca import uWS from '../../uWebSockets.js/uws.js';
COPY ./ppp/salt/states/ppp/lib/utex /var/app/ppp/salt/states/ppp/lib/utex
COPY ./ppp/salt/states/ppp/lib/uWebSockets.js /var/app/ppp/salt/states/ppp/lib/uWebSockets.js
COPY ./ppp/salt/states/ppp/lib/vendor/lzma /var/app/ppp/salt/states/ppp/lib/vendor/lzma
COPY ./ppp/salt/states/ppp/lib/vendor/protobuf.min.js /var/app/ppp/salt/states/ppp/lib/vendor/protobuf.min.js
COPY ./ppp/salt/states/ppp/lib/aspirant-worker/utex-alpaca /var/app/ppp/salt/states/ppp/lib/aspirant-worker/utex-alpaca

ENV DEBUG=true
ENV UTEX_US_DATA_SERVER_LIST=ususdt-ds-lyra.auroraplatform.com:34003
ENV PPP_LIB_DIR=../..
CMD ["node", "ppp/salt/states/ppp/lib/aspirant-worker/utex-alpaca/utex-alpaca.mjs"]
