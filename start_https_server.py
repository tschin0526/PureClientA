#!/usr/bin/env python3
"""
HTTPS 服务器启动脚本 - 支持 PWA 离线功能
使用自签名证书，让手机能通过 HTTPS 访问
"""
import socket
import subprocess
import sys
import os
import time
import signal
import ssl
from http.server import HTTPServer, SimpleHTTPRequestHandler

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        try:
            hostname = socket.gethostname()
            ip = socket.gethostbyname(hostname)
            return ip
        except Exception:
            return "127.0.0.1"

def generate_self_signed_cert():
    """生成自签名证书"""
    cert_dir = os.path.dirname(os.path.abspath(__file__))
    cert_file = os.path.join(cert_dir, 'server.crt')
    key_file = os.path.join(cert_dir, 'server.key')
    
    if os.path.exists(cert_file) and os.path.exists(key_file):
        print(f"证书文件已存在:")
        print(f"  {cert_file}")
        print(f"  {key_file}")
        return cert_file, key_file
    
    print("正在生成自签名证书...")
    
    # 使用 openssl 生成自签名证书
    subj = "/C=TW/ST=Taipei/L=Taipei/O=PureClientA/OU=Dev/CN=localhost"
    
    result = subprocess.run([
        'openssl', 'req', '-x509', '-newkey', 'rsa:2048',
        '-keyout', key_file,
        '-out', cert_file,
        '-days', '3650',
        '-nodes',
        '-subj', subj
    ], capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"openssl 执行失败: {result.stderr}")
        # 尝试使用 pyopenssl
        try:
            from OpenSSL import crypto
            k = crypto.PKey()
            k.generate_key(crypto.TYPE_RSA, 2048)
            cert = crypto.X509()
            cert.get_subject().C = "TW"
            cert.get_subject().ST = "Taipei"
            cert.get_subject().L = "Taipei"
            cert.get_subject().O = "PureClientA"
            cert.get_subject().OU = "Dev"
            cert.get_subject().CN = "localhost"
            cert.set_serial_number(1000)
            cert.gmtime_adj_notBefore(0)
            cert.gmtime_adj_notAfter(10*365*24*60*60)  # 10年有效
            cert.set_issuer(cert.get_subject())
            cert.set_pubkey(k)
            cert.sign(k, 'sha256')
            
            with open(cert_file, 'wb') as f:
                f.write(crypto.dump_certificate(crypto.FILETYPE_PEM, cert))
            with open(key_file, 'wb') as f:
                f.write(crypto.dump_privatekey(crypto.FILETYPE_PEM, k))
            print("证书生成成功 (使用 pyopenssl)")
        except ImportError:
            print("错误: 无法生成证书")
            print("请安装 openssl 或 pyopenssl: pip install pyopenssl")
            sys.exit(1)
    else:
        print("证书生成成功 (使用 openssl)")
    
    return cert_file, key_file

def update_index_html(ip, port, use_https=True):
    index_path = os.path.join(os.path.dirname(__file__), "index.html")
    with open(index_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    protocol = "https" if use_https else "http"
    url = f"{protocol}://{ip}:{port}"
    
    import re
    content = re.sub(r"手持设备访问: https?://[0-9.]+:[0-9]+", f"手持设备访问: {url}", content)
    
    with open(index_path, "w", encoding="utf-8") as f:
        f.write(content)

class QuietHandler(SimpleHTTPRequestHandler):
    """静默的 HTTP 请求处理器"""
    def log_message(self, format, *args):
        pass  # 不输出日志

def kill_process_on_port(port):
    try:
        result = subprocess.run(['lsof', '-ti', f':{port}'], capture_output=True, text=True)
        pids = result.stdout.strip().split()
        if pids:
            for pid in pids:
                try:
                    os.kill(int(pid), signal.SIGKILL)
                except Exception:
                    pass
            time.sleep(1)
    except Exception:
        pass

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0

if __name__ == "__main__":
    import sys

    # 检查命令行参数
    use_https = True
    if len(sys.argv) > 1 and sys.argv[1].lower() == 'http':
        use_https = False

    port = 4430 if use_https else 8000  # HTTPS用4430，HTTP用8000
    protocol = "https" if use_https else "http"

    ip = get_local_ip()
    print("=" * 60)
    print(f"本机 IP 地址: {ip}")
    print(f"协议模式: {protocol.upper()}")
    print("=" * 60)

    # 清理端口
    for p in [4430, 8000]:  # 清理两个端口
        if is_port_in_use(p):
            print(f"清理端口 {p}...")
            kill_process_on_port(p)

    if use_https:
        # 生成证书
        cert_file, key_file = generate_self_signed_cert()
        print("已准备 HTTPS 证书")

    # 更新 index.html
    update_index_html(ip, port, use_https=use_https)
    print(f"\n已更新 index.html，访问地址: {protocol}://{ip}:{port}")

    print("\n" + "=" * 60)
    print("服务器启动信息")
    print("=" * 60)

    if use_https:
        print(f"✅ HTTPS 地址 (推荐，PWA离线可用): https://{ip}:{port}")
        print(f"   电脑访问:                     https://localhost:{port}")
        print(f"   手持设备访问:                 https://{ip}:{port}")
        print(f"\n⚠️  首次访问时，浏览器会提示'不安全'")
        print(f"   请点击 '高级' → '继续访问' 即可")
        print(f"\n💡 提示: HTTPS 是 PWA 离线功能的必要条件!")
    else:
        print(f"✅ HTTP 地址 (轻量级离线功能): http://{ip}:{port}")
        print(f"   电脑访问:                     http://localhost:{port} (支持PWA)")
        print(f"   手持设备访问:                 http://{ip}:{port}")
        print(f"\n⚠️  注意: HTTP 网络访问只支持轻量级离线功能!")
        print(f"   包括: 网络状态监控、资源缓存、离线提示")
        print(f"   不支持: Service Worker、自动更新、完整离线应用")

    print("=" * 60)

    # 启动服务器
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    httpd = HTTPServer(('0.0.0.0', port), QuietHandler)

    if use_https:
        # 包装 SSL
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(cert_file, key_file)
        httpd.socket = context.wrap_socket(httpd.socket, server_side=True)

    print("\n按 Ctrl+C 停止服务器\n")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n服务器已停止")
        httpd.server_close()
