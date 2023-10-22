const fs = require('fs')
const dotenv = require('dotenv');
dotenv.config();

let instances_count = parseInt(process.env.INSTANCES_COUNT);
let file = `version: "3.9"

services:`;

for (let i = 0; i < instances_count; i++) {
    let port = 7000 + i;
    file += `
  aurora_instance_${i}:
    container_name: aurora_instance_${i}
    build: ./
    ports:
      - "${port}:24567"
    environment:
      - DEBUG=true
      - INST_ID=${i}
`;
}

fs.writeFileSync('./docker-compose.yml', file)


// docker compose build --no-cache && docker compose up -d --force-recreate