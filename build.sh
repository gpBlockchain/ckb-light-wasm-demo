# git clone light
# CKB_LIGHT_CLIENT_URL=${CKB_LIGHT_CLIENT_URL:-https://github.com/nervosnetwork/ckb-light-client.git}
# CKB_LIGHT_CLIENT_BRANCH=${CKB_LIGHT_CLIENT_BRANCH:-develop}

# is set  CKB_LIGHT_CLIENT_URL env, remove dir ,clone again
if [ -n "${CKB_LIGHT_CLIENT_URL}" ] && [ -d "ckb-light-client" ]; then
        rm -rf ckb-light-client
        git clone ${CKB_LIGHT_CLIENT_URL}
        cd ckb-light-client
        git checkout ${CKB_LIGHT_CLIENT_BRANCH}
        cd ../
fi

cd ckb-light-client

cargo install wasm-pack
npm install
npm run build -ws
cd ../
python3 server.py > server.log 2>&1 &
cd ckb-light-client-rpc
npm i
npm run build
npm run service > rpc.log 2>&1 &
sleep 5
echo "CKB Light Client RPC server is running html: http://localhost:8000  rpc: http://localhost:9000"
