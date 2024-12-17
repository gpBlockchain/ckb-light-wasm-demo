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
python3 server.py > server.log 2>&1 &
cd ckb-light-client-rpc
npm i
npm run build
npm run service > rpc.log 2>&1 &
sleep 5
echo "CKB Light Client RPC server is running html: http://localhost:8000  rpc: http://localhost:9000"