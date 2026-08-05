/**
 * 检查IndexedDB数据脚本
 * 功能：查询trades和pairings表的记录数
 */

(function() {
    'use strict';
    
    // IndexedDB 配置
    const DB_NAME = 'TradesDB';
    const DB_VERSION = 2;
    const STORE_NAME = 'trades';
    const PAIRINGS_STORE_NAME = 'pairings';
    
    // 打开数据库并查询数据量
    function checkDBData() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            
            request.onerror = (event) => {
                console.error('IndexedDB 打开失败:', event.target.error);
                reject(event.target.error);
            };
            
            request.onsuccess = (event) => {
                const db = event.target.result;
                const result = {
                    tradesCount: 0,
                    pairingsCount: 0
                };
                
                // 查询trades表数据量
                const tradesTransaction = db.transaction([STORE_NAME], 'readonly');
                const tradesStore = tradesTransaction.objectStore(STORE_NAME);
                const tradesRequest = tradesStore.getAll();
                
                tradesRequest.onerror = (event) => {
                    console.error('查询trades表失败:', event.target.error);
                    reject(event.target.error);
                };
                
                tradesRequest.onsuccess = (event) => {
                    result.tradesCount = event.target.result.length;
                    
                    // 查询pairings表数据量
                    const pairingsTransaction = db.transaction([PAIRINGS_STORE_NAME], 'readonly');
                    const pairingsStore = pairingsTransaction.objectStore(PAIRINGS_STORE_NAME);
                    const pairingsRequest = pairingsStore.getAll();
                    
                    pairingsRequest.onerror = (event) => {
                        console.error('查询pairings表失败:', event.target.error);
                        reject(event.target.error);
                    };
                    
                    pairingsRequest.onsuccess = (event) => {
                        result.pairingsCount = event.target.result.length;
                        resolve(result);
                    };
                };
            };
        });
    }
    
    // 执行查询
    checkDBData()
        .then(result => {
            console.log('IndexedDB 数据统计:');
            console.log('trades表记录数:', result.tradesCount);
            console.log('pairings表记录数:', result.pairingsCount);
            
            // 显示在页面上
            const div = document.createElement('div');
            div.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #f0f0f0;
                padding: 15px;
                border: 1px solid #ccc;
                border-radius: 5px;
                font-family: Arial, sans-serif;
                font-size: 14px;
                z-index: 10000;
            `;
            div.innerHTML = `
                <h3>IndexedDB 数据统计</h3>
                <p><strong>trades表记录数:</strong> ${result.tradesCount}</p>
                <p><strong>pairings表记录数:</strong> ${result.pairingsCount}</p>
                <button onclick="this.parentElement.remove()" style="margin-top: 10px;">关闭</button>
            `;
            document.body.appendChild(div);
        })
        .catch(error => {
            console.error('查询数据失败:', error);
        });
})();