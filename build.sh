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
git fetch origin --prune
# 检查远程分支是否存在
REMOTE_BRANCH_EXISTS=$(git ls-remote --heads origin ${CKB_LIGHT_CLIENT_BRANCH} | wc -l)
if [ "$REMOTE_BRANCH_EXISTS" -gt 0 ]; then
    # 远程分支存在，先 fetch 该分支，然后切换
    git fetch origin ${CKB_LIGHT_CLIENT_BRANCH}
    git checkout -B ${CKB_LIGHT_CLIENT_BRANCH} origin/${CKB_LIGHT_CLIENT_BRANCH}
elif git show-ref --verify --quiet refs/heads/${CKB_LIGHT_CLIENT_BRANCH}; then
    # 远程分支不存在，但本地分支存在
    git checkout ${CKB_LIGHT_CLIENT_BRANCH}
else
    # 分支不存在
    echo "Error: Branch ${CKB_LIGHT_CLIENT_BRANCH} does not exist in remote or local"
    echo "Available remote branches:"
    git ls-remote --heads origin | sed 's|.*refs/heads/||' || true
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
