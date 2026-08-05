#!/usr/bin/env python3
import socket
import subprocess
import sys
import os
import time
import signal

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

def kill_process_on_port(port):
    print(f"正在尝试清理端口 {port}...")
    try:
        result = subprocess.run(['lsof', '-ti', f':{port}'], capture_output=True, text=True)
        pids = result.stdout.strip().split()
        if pids:
            print(f"发现进程占用端口 {port}，正在终止: {', '.join(pids)}")
            for pid in pids:
                try:
                    os.kill(int(pid), signal.SIGKILL)
                except Exception as e:
                    print(f"终止进程 {pid} 失败: {e}")
            time.sleep(2)
            return True
        else:
            print(f"端口 {port} 没有被占用")
            return False
    except Exception as e:
        print(f"清理端口 {port} 时出错: {e}")
        return False

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0

def update_index_html(ip, port):
    index_path = os.path.join(os.path.dirname(__file__), "index.html")
    with open(index_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    import re
    content = re.sub(r"手持设备访问: http://[0-9.]+:[0-9]+", f"手持设备访问: http://{ip}:{port}", content)
    
    with open(index_path, "w", encoding="utf-8") as f:
        f.write(content)
    
    return ip

if __name__ == "__main__":
    port = 8000
    
    ip = get_local_ip()
    print(f"本机 IP 地址: {ip}")
    
    print("\n" + "="*50)
    print("正在检查端口...")
    
    max_attempts = 3
    for attempt in range(max_attempts):
        if is_port_in_use(port):
            print(f"端口 {port} 被占用，尝试清理... (尝试 {attempt+1}/{max_attempts})")
            kill_process_on_port(port)
            if not is_port_in_use(port):
                break
        else:
            break
    
    if is_port_in_use(port):
        print(f"\n错误：无法释放端口 {port}")
        print("请手动执行以下命令清理：")
        print(f"  lsof -ti:{port} | xargs kill -9")
        print("\n或者使用其他端口，例如：")
        print(f"  python3 -m http.server 8001 --bind 0.0.0.0")
        sys.exit(1)
    
    print("\n正在更新 index.html...")
    update_index_html(ip, port)
    print(f"更新完成！手持设备访问地址: http://{ip}:{port}")
    
    print("\n正在启动服务器...")
    print(f"电脑访问: http://localhost:{port}")
    print(f"手持设备访问: http://{ip}:{port}")
    print("="*50)
    
    subprocess.run([sys.executable, "-m", "http.server", str(port), "--bind", "0.0.0.0"])
