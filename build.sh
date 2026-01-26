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
if git ls-remote --heads origin ${CKB_LIGHT_CLIENT_BRANCH} | grep -q ${CKB_LIGHT_CLIENT_BRANCH}; then
    git checkout -B ${CKB_LIGHT_CLIENT_BRANCH} origin/${CKB_LIGHT_CLIENT_BRANCH}
elif git show-ref --verify --quiet refs/heads/${CKB_LIGHT_CLIENT_BRANCH}; then
    git checkout ${CKB_LIGHT_CLIENT_BRANCH}
else
    echo "Error: Branch ${CKB_LIGHT_CLIENT_BRANCH} does not exist in remote or local"
    exit 1
fi
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
