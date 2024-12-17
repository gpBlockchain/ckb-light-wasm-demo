import http.server

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # 添加自定义请求头
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Cross-Origin-Opener-Policy',  'same-origin')
        # 调用父类的 end_headers 方法以确保正常发送其他头部
        super().end_headers()

def run(server_class=http.server.HTTPServer, handler_class=CustomHTTPRequestHandler):
    server_address = ('', 8000)  # 监听所有主机的8000端口
    httpd = server_class(server_address, handler_class)
    print("Starting server on port 8000...")
    httpd.serve_forever()

if __name__ == '__main__':
    run()
