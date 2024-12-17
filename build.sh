# git clone light
cd ckb-light-client
cd light-client-db-worker
npm i
npm run build
cd ../light-client-wasm
npm i
npm run build
cd ../light-client-js
npm i
npm run build
cd ../../
python server.py