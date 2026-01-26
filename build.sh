# git clone light
CKB_LIGHT_CLIENT_URL=${CKB_LIGHT_CLIENT_URL:-https://github.com/nervosnetwork/ckb-light-client.git}
CKB_LIGHT_CLIENT_BRANCH=${CKB_LIGHT_CLIENT_BRANCH:-develop}
if [ ! -d "ckb-light-client" ]; then
    git clone ${CKB_LIGHT_CLIENT_URL}
fi
cd ckb-light-client
# 强制更新 remote URL
git remote set-url origin ${CKB_LIGHT_CLIENT_URL}
# 强制切换到指定分支
git fetch origin
git checkout -B ${CKB_LIGHT_CLIENT_BRANCH} origin/${CKB_LIGHT_CLIENT_BRANCH} 2>/dev/null || git checkout ${CKB_LIGHT_CLIENT_BRANCH}
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
