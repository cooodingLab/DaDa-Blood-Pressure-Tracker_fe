// app.js

let globalRecords = [];
let myChart = null;

// --- API 請求封裝函式 (核心修改) ---
async function callApi(payload) {
    // 除了 login 動作外，其他都必須帶上 apiSecret
    if (payload.action !== 'login') {
        const secret = localStorage.getItem('dada_api_secret');
        if (!secret) {
            handleLogout(); // 沒 Token 直接登出
            return { success: false, message: '請先登入' };
        }
        payload.apiSecret = secret;
        payload.userId = CONFIG.DEFAULT_USER_ID; // 統一補上 UserId
    }

    try {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        // 如果後端回傳權限不足，強制登出
        if (!result.success && result.message.includes('權限')) {
            handleLogout();
        }
        return result;
    } catch (error) {
        console.error('API Error:', error);
        return { success: false, message: '網路連線錯誤' };
    }
}

// --- 輔助函式：取得本地端今天的日期字串 (YYYY-MM-DD) ---
function getTodayString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// --- 輔助函式：取得本地端當前月份字串 (YYYY-MM) ---
function getCurrentMonthString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

// --- 輔助函式：統一處理日期格式 ---
function parseDate(val) {
    if (!val) return new Date().getTime();
    if (typeof val === 'number') return val;
    if (!isNaN(val) && !isNaN(parseFloat(val))) return Number(val);
    return new Date(val).getTime();
}

// --- 輔助函式：判斷血壓狀態 (決定圓點顏色) ---
function determineBpStatus(sbp, dbp) {
    const s = Number(sbp);
    const d = Number(dbp);

    if (s >= 140 || d >= 90) {
        return 'status-stage2'; 
    } else if ((s >= 130 && s <= 139) || (d >= 80 && d <= 89)) {
        return 'status-stage1'; 
    } else if ((s >= 120 && s <= 129) && d < 80) {
        return 'status-elevated'; 
    } else {
        return 'status-normal'; 
    }
}

// --- 輔助函式：渲染統計區塊 ---
function renderSummaryBlock(container, sbpSum, dbpSum, pulseSum, count) {
    if (count === 0) return;
    const finalAvgSbp = Math.round(sbpSum / count);
    const finalAvgDbp = Math.round(dbpSum / count);
    const finalAvgPulse = Math.round(pulseSum / count);

    const div = document.createElement('li');
    div.className = 'average-summary-block';
    
    // 使用 val-group 避免跑版，使用 text-purple 保持列表紫色
    // 修改：移除手動空格，由 CSS .val-group > span:nth-child(2) 控制 margin
    div.innerHTML = `
        <div style="flex: 1;">
            <div style="margin-bottom: 5px;">
                <span class="average-summary-icon">💡</span>
                前 6 天平均值：
            </div>
            <div class="summary-data-row">
                <div class="val-group">
                    <span style="font-size: 0.95rem; color: #5D4037;">血壓</span> 
                    <span style="color:#d32f2f; font-size:1.1rem; font-weight:800;">${finalAvgSbp}/${finalAvgDbp}</span> 
                    <span style="font-size: 0.8rem; color: #8A9C94;">mmHg</span>
                </div>
                <div class="val-group">
                    <span style="font-size: 0.95rem; color: #5D4037;">脈搏</span> 
                    <span class="text-purple" style="font-size:1.1rem; font-weight:800;">${finalAvgPulse}</span> 
                    <span style="font-size: 0.8rem; color: #8A9C94;">bpm</span>
                </div>
            </div>
        </div>
    `;
    container.appendChild(div);
}

function showToast(icon, title) {
    Swal.fire({
        icon: icon,
        title: title,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer)
            toast.addEventListener('mouseleave', Swal.resumeTimer)
        }
    });
}

function showConfirm(title, text, confirmCallback) {
    Swal.fire({
        title: title,
        text: text,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#4FB58C',
        cancelButtonColor: '#FF7043',
        confirmButtonText: '是的，刪除它！',
        cancelButtonText: '取消',
        reverseButtons: true
    }).then((result) => {
        if (result.isConfirmed) {
            confirmCallback();
        }
    });
}

// --- 路由 ---
function navigateTo(sectionId) {
    document.querySelectorAll('.section').forEach(el => {
        el.classList.remove('active');
        el.style.display = 'none';
    });

    const target = document.getElementById(sectionId);
    if (target) {
        if(sectionId === 'hero') { target.style.display = 'flex'; } 
        else { target.style.display = 'block'; }
        setTimeout(() => target.classList.add('active'), 10);
        window.scrollTo(0, 0);
    }

    const navLinksContainer = document.querySelector('.nav-links');
    const hamburger = document.getElementById('hamburger');
    
    // ★★★ 關鍵修改：JS 負責將 inline 的 display: none 移除或設為 none ★★★
    if (sectionId === 'hero' || sectionId === 'login') {
        if(navLinksContainer) navLinksContainer.style.display = 'none';
        if(hamburger) hamburger.style.display = 'none';
    } else {
        if(navLinksContainer) navLinksContainer.style.display = ''; // 清空 inline style，讓 CSS 的 display: flex 生效
        if(hamburger) hamburger.style.display = '';
    }

    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if(link.getAttribute('href') === '#' + sectionId) {
            link.classList.add('active');
        }
    });

    if (navLinksContainer) navLinksContainer.classList.remove('active');
    if (hamburger) hamburger.classList.remove('active');

    if (sectionId === 'dashboard') loadDashboardData();
    else if (sectionId === 'history') loadHistoryData();
    else if (sectionId === 'medicalRecord') loadMedicalData();
}

// --- 登入邏輯修改 ---
async function handleLogin(username, password) {
    const submitBtn = document.querySelector('#loginForm button');
    submitBtn.innerText = "驗證中...";
    submitBtn.disabled = true;

    const result = await callApi({
        action: 'login',
        username: username,
        password: password
    });

    if (result.success) {
        // ★ 關鍵：將後端回傳的 Secret 存起來
        localStorage.setItem('dada_api_secret', result.apiSecret);
        
        Swal.fire({
            icon: 'success',
            title: '登入成功',
            text: '歡迎回來！',
            timer: 1500,
            showConfirmButton: false
        }).then(() => {
            navigateTo('dashboard');
        });
    } else {
        Swal.fire('登入失敗', result.message, 'error');
    }
    
    submitBtn.innerText = "解鎖我的健康紀錄"; 
    submitBtn.disabled = false;
}

// --- 登出邏輯 ---
function handleLogout() {
    localStorage.removeItem('dada_api_secret'); // 清除 Secret
    Swal.fire({
        title: '已登出',
        text: '期待下次再見！',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
    }).then(() => {
        navigateTo('hero');
    });
}

// --- 修改後的 loadDashboardData ---
async function loadDashboardData() {
    const chartWrapper = document.querySelector('.chart-wrapper');
    const chartEmpty = document.getElementById('chartEmptyState');
    const canvas = document.getElementById('bpChart');

    // 改用 callApi，不用自己組 fetch
    const response = await callApi({ action: 'getBloodRecords' });

    if (response.success) {
        globalRecords = response.data;
        renderRecordList(globalRecords);
        
        if (globalRecords.length > 0) {
            canvas.style.display = 'block';
            if(chartEmpty) chartEmpty.style.display = 'none';
            updateChart(7);
        } else {
            canvas.style.display = 'none';
            if(chartEmpty) chartEmpty.style.display = 'block';
        }
    }
}

// --- 修改後的 loadHistoryData ---
async function loadHistoryData() {
    const response = await callApi({ action: 'getBloodRecords' });
    if (response.success) {
        globalRecords = response.data;
        
        const yearSelect = document.getElementById('historyYear');
        const monthSelect = document.getElementById('historyMonth');
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

        if (yearSelect && yearSelect.options.length === 0) {
            for (let i = 0; i < 6; i++) {
                const y = currentYear - i;
                const opt = document.createElement('option');
                opt.value = y;
                opt.text = y + ' 年';
                yearSelect.add(opt);
            }
            yearSelect.value = currentYear;

            for (let i = 1; i <= 12; i++) {
                const m = String(i).padStart(2, '0');
                const opt = document.createElement('option');
                opt.value = m;
                opt.text = m + ' 月';
                monthSelect.add(opt);
            }
            monthSelect.value = currentMonth;
        }
        
        filterAndRenderHistory();
    }
}

function filterAndRenderHistory() {
    const yearSelect = document.getElementById('historyYear');
    const monthSelect = document.getElementById('historyMonth');
    if (!yearSelect || !monthSelect) return;
    
    const selectedMonth = `${yearSelect.value}-${monthSelect.value}`;
    
    const filteredRecords = globalRecords.filter(record => {
        const timestamp = parseDate(record.date);
        const recordDate = new Date(timestamp);
        const recordMonth = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, '0')}`;
        return recordMonth === selectedMonth;
    });

    renderHistoryList(filteredRecords);
}

// --- 修改後的 loadMedicalData ---
async function loadMedicalData() {
    const response = await callApi({ action: 'getMedicalRecords' });
    if (response.success) {
        renderMedicalList(response.data);
    }
}

function renderRecordList(records) {
    const listContainer = document.getElementById('recordList');
    const emptyState = document.getElementById('emptyState');
    if (!listContainer || !emptyState) return;
    listContainer.innerHTML = '';

    if (!records || records.length === 0) {
        listContainer.style.display = 'none';
        emptyState.style.display = 'block';
    } else {
        listContainer.style.display = 'block';
        emptyState.style.display = 'none';
        
        const sorted = [...records].sort((a, b) => parseDate(b.date) - parseDate(a.date));
        
        sorted.slice(0, 10).forEach(record => {
            const li = createRecordListItem(record);
            listContainer.appendChild(li);
        });
    }
}

// --- History 列表渲染 (每 6 天統計) ---
function renderHistoryList(records) {
    const listContainer = document.getElementById('historyList');
    const emptyState = document.getElementById('historyEmptyState');
    if (!listContainer || !emptyState) return;
    listContainer.innerHTML = '';

    if (!records || records.length === 0) {
        listContainer.style.display = 'none';
        emptyState.style.display = 'block';
    } else {
        listContainer.style.display = 'block';
        emptyState.style.display = 'none';
        
        records.sort((a, b) => parseDate(b.date) - parseDate(a.date));

        let anchorDate = null; 
        let batchSbp = 0, batchDbp = 0, batchPulse = 0, batchCount = 0;

        records.forEach(record => {
            const currentTimestamp = parseDate(record.date);
            const currentDate = new Date(currentTimestamp);

            if (!anchorDate) anchorDate = currentDate;

            const d1 = new Date(anchorDate); d1.setHours(0,0,0,0);
            const d2 = new Date(currentDate); d2.setHours(0,0,0,0);
            const diffTime = Math.abs(d1 - d2);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays >= 6) {
                if (batchCount > 0) {
                    renderSummaryBlock(listContainer, batchSbp, batchDbp, batchPulse, batchCount);
                }
                anchorDate = currentDate;
                batchSbp = 0; batchDbp = 0; batchPulse = 0; batchCount = 0;
            }

            const li = createRecordListItem(record);
            listContainer.appendChild(li);

            let sbp = Number(record.sbp_1);
            let dbp = Number(record.dbp_1);
            let pulse = Number(record.pulse_1);
            let count = 1;
            if (record.sbp_2 && Number(record.sbp_2) > 0) {
                sbp += Number(record.sbp_2);
                dbp += Number(record.dbp_2);
                pulse += Number(record.pulse_2);
                count++;
            }
            batchSbp += (sbp / count);
            batchDbp += (dbp / count);
            batchPulse += (pulse / count);
            batchCount++;
        });

        if (batchCount > 0) {
            renderSummaryBlock(listContainer, batchSbp, batchDbp, batchPulse, batchCount);
        }
    }
}

function renderMedicalList(records) {
    const listContainer = document.getElementById('medicalList');
    const emptyState = document.getElementById('medicalEmptyState');
    
    if (!listContainer || !emptyState) return;

    listContainer.innerHTML = '';

    if (!records || records.length === 0) {
        listContainer.style.display = 'none';
        emptyState.style.display = 'block';
    } else {
        listContainer.style.display = 'block';
        emptyState.style.display = 'none';

        records.forEach(record => {
            const timestamp = parseDate(record.check_date);
            let displayDate = new Date(timestamp).toISOString().split('T')[0];
            
            const linkHtml = record.report_image_url ? 
                `<button class="btn-view" onclick="openModal('${record.report_image_url}')">
                    <span>📄</span> 查看
                 </button>` : '';

            const li = document.createElement('li');
            li.className = 'record-item';
            li.innerHTML = `
                <div class="record-left">
                    <span style="font-size: 1.1rem; font-weight: bold; color: var(--color-text);">${displayDate}</span>
                </div>
                <div class="record-actions">
                    ${linkHtml}
                    <button class="btn-icon btn-delete" onclick="deleteMedicalRecord('${record.id}')" title="刪除">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                    </button>
                </div>
            `;
            listContainer.appendChild(li);
        });
    }
}

function openModal(imageUrl) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    const loadingText = document.getElementById('modalLoading');

    modal.style.display = "block";
    modalImg.style.display = "none";
    loadingText.style.display = "block"; 
    loadingText.innerText = "圖片載入中...";

    modalImg.src = imageUrl;

    modalImg.onload = function() {
        loadingText.style.display = "none";
        modalImg.style.display = "block";
    };
    modalImg.onerror = function() {
        console.warn("圖片載入失敗，嘗試直接開啟連結");
        loadingText.innerHTML = `
            圖片預覽失敗 😢<br>
            <a href="${imageUrl}" target="_blank" style="color:var(--color-primary);text-decoration:underline;font-weight:bold;margin-top:10px;display:inline-block;">
                點此直接前往 Google Drive 查看
            </a>
        `;
    };
}

function updateChart(days) {
    const ctx = document.getElementById('bpChart');
    if (!ctx) return;

    const today = new Date();
    const cutoffDate = new Date();
    cutoffDate.setDate(today.getDate() - days);

    const dailyData = new Map();
    const sortedRecords = [...globalRecords].sort((a, b) => parseDate(a.date) - parseDate(b.date));

    sortedRecords.forEach(r => {
        const timestamp = parseDate(r.date);
        if (isNaN(timestamp)) return;

        const rDateObj = new Date(timestamp);
        const dateKey = rDateObj.toISOString().split('T')[0];
        
        if (rDateObj >= cutoffDate && rDateObj <= today) {
            let sbp = Number(r.sbp_1);
            let dbp = Number(r.dbp_1);
            let pulse = Number(r.pulse_1);
            let count = 1;

            if (r.sbp_2 && Number(r.sbp_2) > 0) {
                sbp += Number(r.sbp_2);
                dbp += Number(r.dbp_2);
                pulse += Number(r.pulse_2);
                count++;
            }

            if (!dailyData.has(dateKey)) {
                dailyData.set(dateKey, { s: [], d: [], p: [] });
            }
            dailyData.get(dateKey).s.push(sbp / count);
            dailyData.get(dateKey).d.push(dbp / count);
            dailyData.get(dateKey).p.push(pulse / count);
        }
    });

    const labels = [];
    const dataSbp = [];
    const dataDbp = [];
    const dataPulse = [];

    dailyData.forEach((vals, date) => {
        labels.push(date.slice(5)); 
        dataSbp.push(Math.round(vals.s.reduce((a,b)=>a+b)/vals.s.length));
        dataDbp.push(Math.round(vals.d.reduce((a,b)=>a+b)/vals.d.length));
        dataPulse.push(Math.round(vals.p.reduce((a,b)=>a+b)/vals.p.length));
    });

    if (myChart) { myChart.destroy(); }

    // 需求 4：檢測視窗寬度
    const isMobile = window.innerWidth <= 420;

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '收縮壓',
                    data: dataSbp,
                    borderColor: '#2196F3',
                    backgroundColor: '#2196F3',
                    pointStyle: 'rectRounded',
                    pointRadius: 6,
                    tension: 0.3
                },
                {
                    label: '舒張壓',
                    data: dataDbp,
                    borderColor: '#7E57C2',
                    backgroundColor: '#7E57C2',
                    pointStyle: 'rectRounded',
                    pointRadius: 6,
                    tension: 0.3
                },
                {
                    label: '脈搏',
                    data: dataPulse,
                    // 需求 1：圖表內的脈搏顏色維持桃紅色 (#E91E63)
                    borderColor: '#E91E63',
                    backgroundColor: '#E91E63',
                    pointStyle: 'circle',
                    pointRadius: 5,
                    borderDash: [5, 5],
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    position: 'top', 
                    labels: { 
                        usePointStyle: true, 
                        // 需求 4：在小螢幕時縮小字體以避免斷行
                        font: { size: isMobile ? 12 : 16 } 
                    } 
                }
            },
            scales: {
                y: { beginAtZero: false, suggestedMin: 50, suggestedMax: 150, ticks: { font: { size: 14 } } },
                x: { ticks: { font: { size: 14 } } }
            }
        }
    });
}

// --- 紀錄列表單項 ---
function createRecordListItem(record) {
    let sbp = Number(record.sbp_1);
    let dbp = Number(record.dbp_1);
    let pulse = Number(record.pulse_1);

    // ★★★ 自動計算平均值邏輯 ★★★
    // 檢查是否有第二次測量，且數值大於 0
    if (record.sbp_2 && Number(record.sbp_2) > 0) {
        sbp = Math.round((sbp + Number(record.sbp_2)) / 2);
        dbp = Math.round((dbp + Number(record.dbp_2)) / 2);
        pulse = Math.round((pulse + Number(record.pulse_2)) / 2);
    }

    // 根據平均值決定燈號顏色
    let statusClass = determineBpStatus(sbp, dbp);
    
    const timestamp = parseDate(record.date);
    let displayDate = new Date(timestamp).toISOString().split('T')[0];
    const timeLabel = record.time_slot === 'morning' ? '早上' : '晚上';

    const li = document.createElement('li');
    li.className = 'record-item';
    li.innerHTML = `
        <div class="record-left">
            <div class="record-date"><span class="status-light ${statusClass}"></span>${displayDate} ${timeLabel}</div>
            <div class="record-values">
                <span class="val-group">
                    ${sbp} / ${dbp} <span class="record-unit">mmHg</span>
                </span>
                <span class="val-group" style="margin-left: 8px;">
                    <span class="text-purple">
                        ❤ ${pulse}
                    </span>
                    <span class="record-unit">bpm</span>
                </span>
            </div>
        </div>
        <div class="record-actions">
            <button class="btn-icon btn-edit" onclick="editRecord('${record.id}')" title="編輯"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
            <button class="btn-icon btn-delete" onclick="deleteRecord('${record.id}')" title="刪除"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
        </div>
    `;
    return li;
}

window.editRecord = function(recordId) {
    const record = globalRecords.find(r => r.id === recordId);
    if (!record) return;
    navigateTo('newRecord');
    document.getElementById('recordFormTitle').innerText = "編輯紀錄";
    document.getElementById('saveRecordBtn').innerText = "儲存修改 ✓";
    document.getElementById('recordId').value = record.id;
    
    const timestamp = parseDate(record.date);
    let displayDate = new Date(timestamp).toISOString().split('T')[0];
    document.getElementById('recordDate').value = displayDate;
    
    const timeBtns = document.querySelectorAll('.time-btn');
    timeBtns.forEach(btn => btn.classList.remove('selected'));
    if (record.time_slot === 'morning') timeBtns[0].classList.add('selected');
    else timeBtns[1].classList.add('selected');
    document.getElementById('sbp_1').value = record.sbp_1;
    document.getElementById('dbp_1').value = record.dbp_1;
    document.getElementById('pulse_1').value = record.pulse_1;
    document.getElementById('sbp_2').value = record.sbp_2 || '';
    document.getElementById('dbp_2').value = record.dbp_2 || '';
    document.getElementById('pulse_2').value = record.pulse_2 || '';
}

window.deleteRecord = function(recordId) {
    showConfirm('確定要刪除紀錄嗎？', '刪除後無法復原喔！', () => {
        fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'deleteBloodRecord', userId: 'admin-user-001', id: recordId })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast('success', '已刪除紀錄！');
                loadDashboardData();
                if(document.getElementById('historyList').offsetParent !== null) loadHistoryData();
            } else {
                Swal.fire('錯誤', data.message, 'error');
            }
        })
        .catch(err => Swal.fire('錯誤', '連線發生問題', 'error'));
    });
}

window.deleteMedicalRecord = function(recordId) {
    showConfirm('確定要刪除就醫紀錄嗎？', '刪除後無法復原喔！', () => {
        fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'deleteMedicalRecord', userId: 'admin-user-001', id: recordId })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast('success', '已刪除就醫紀錄！');
                loadMedicalData();
            } else {
                Swal.fire('錯誤', data.message, 'error');
            }
        })
        .catch(err => Swal.fire('錯誤', '連線發生問題', 'error'));
    });
}

// ★★★ 關鍵修改：將事件監聽器改為 DOMContentLoaded，加快執行速度，解決 Safari 閃爍問題 ★★★
document.addEventListener('DOMContentLoaded', () => {
    // 檢查是否已登入 (有 Secret)
    const hasSecret = localStorage.getItem('dada_api_secret');
    const hash = window.location.hash.substring(1);

    // 如果沒有 Secret 且不是在首頁或登入頁，強制導回
    if (!hasSecret && hash !== 'hero' && hash !== 'login') {
        navigateTo('hero');
    } else {
        if(hash) { navigateTo(hash); } else { navigateTo('hero'); }
    }

    // ... (DOM 元素綁定邏輯不變) ...

    const dateInput = document.getElementById('recordDate');
    if(dateInput) dateInput.value = getTodayString();

    const medicalDateInput = document.getElementById('medicalDate');
    if(medicalDateInput) medicalDateInput.value = getTodayString();

    const yearSelect = document.getElementById('historyYear');
    const monthSelect = document.getElementById('historyMonth');
    
    if(yearSelect) {
        yearSelect.addEventListener('change', filterAndRenderHistory);
    }
    if(monthSelect) {
        monthSelect.addEventListener('change', filterAndRenderHistory);
    }

    const rangeBtns = document.querySelectorAll('.range-btn');
    rangeBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            rangeBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const days = this.getAttribute('data-range');
            updateChart(parseInt(days));
        });
    });

    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('navLinks');
    if(hamburger && navLinks) {
        hamburger.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            hamburger.classList.toggle('active');
        });
        
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
                hamburger.classList.remove('active');
            });
        });
    }

    const modal = document.getElementById('imageModal');
    const closeModalSpan = document.getElementsByClassName("close-modal")[0];
    if(closeModalSpan) { closeModalSpan.onclick = function() { modal.style.display = "none"; } }
    window.onclick = function(event) { if (event.target == modal) { modal.style.display = "none"; } }

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const inputs = loginForm.querySelectorAll('input');
            const username = inputs[0].value;
            const password = inputs[1].value;
            if (!username || !password) { 
                Swal.fire('提示', '請輸入帳號和密碼！', 'warning');
                return; 
            }
            handleLogin(username, password);
        });
    }

    const recordForm = document.getElementById('recordForm');
    const saveRecordBtn = document.getElementById('saveRecordBtn');
    if (saveRecordBtn) {
        saveRecordBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            // ... (取得欄位值的邏輯不變)
            const recordId = document.getElementById('recordId').value;
            const sbp_1 = document.getElementById('sbp_1').value;
            const dbp_1 = document.getElementById('dbp_1').value;
            const pulse_1 = document.getElementById('pulse_1').value;
            const sbp_2 = document.getElementById('sbp_2').value;
            const dbp_2 = document.getElementById('dbp_2').value;
            const pulse_2 = document.getElementById('pulse_2').value;
            const timeSlotBtn = document.querySelector('.time-btn.selected');
            const timeSlotText = timeSlotBtn ? timeSlotBtn.innerText : '早上';
            const timeSlot = timeSlotText.includes('晚') ? 'evening' : 'morning';

            if (!sbp_1) { Swal.fire('提示', '請至少填寫第一次測量的血壓數值！', 'warning'); return; }
            
            saveRecordBtn.innerText = "儲存中...";
            saveRecordBtn.disabled = true;

            const action = recordId ? 'updateBloodRecord' : 'addBloodRecord';
            // 呼叫 callApi
            const response = await callApi({
                action: action,
                id: recordId, // 如果是新增，後端會忽略這個
                date: new Date(document.getElementById('recordDate').value).getTime(),
                time_slot: timeSlot,
                sbp_1: sbp_1, dbp_1: dbp_1, pulse_1: pulse_1, sbp_2: sbp_2, dbp_2: dbp_2, pulse_2: pulse_2
            });

            if (response.success) {
                showToast('success', '紀錄已儲存！');
                document.getElementById('recordForm').reset();
                document.getElementById('recordId').value = '';
                document.getElementById('recordFormTitle').innerText = "建立新紀錄";
                saveRecordBtn.innerText = "確定建立 ✓";
                document.getElementById('recordDate').value = getTodayString();
                
                navigateTo('dashboard');
            } else {
                Swal.fire('失敗', response.message, 'error');
            }
            saveRecordBtn.innerText = document.getElementById('recordId').value ? "儲存修改 ✓" : "確定建立 ✓";
            saveRecordBtn.disabled = false;
        });
    }

    const medicalForm = document.getElementById('medicalForm');
    const saveMedicalBtn = document.getElementById('saveMedicalBtn');
    if(saveMedicalBtn) {
        saveMedicalBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            const dateStr = document.getElementById('medicalDate').value;
            if(!dateStr) { Swal.fire('提示', '請選擇檢查日期！', 'warning'); return; }
            const timestamp = new Date(dateStr).getTime();
            
            const fileInput = document.getElementById('reportFile');
            const file = fileInput.files[0];

            const originalText = saveMedicalBtn.innerText;
            saveMedicalBtn.innerText = "處理中...";
            saveMedicalBtn.disabled = true;

            const sendData = async (fileData = null, fileName = null, mimeType = null) => {
                const response = await callApi({
                    action: 'addMedicalRecord',
                    check_date: timestamp,
                    fileData: fileData, fileName: fileName, mimeType: mimeType
                });

                if (response.success) {
                    showToast('success', '就醫紀錄已儲存！');
                    loadMedicalData();
                    const fileNameDisplay = document.getElementById('fileNameDisplay');
                    if(fileNameDisplay) { fileNameDisplay.style.display = 'none'; fileNameDisplay.textContent = ''; }
                    if(fileInput) fileInput.value = '';
                    document.getElementById('medicalDate').value = getTodayString();
                } else { Swal.fire('失敗', response.message, 'error'); }
                saveMedicalBtn.innerText = originalText; saveMedicalBtn.disabled = false;
            };

            if (file) {
                if (file.size > 5 * 1024 * 1024) { Swal.fire('檔案太大', '圖片太大囉！請選擇 5MB 以下的照片。', 'error'); saveMedicalBtn.innerText = originalText; saveMedicalBtn.disabled = false; return; }
                saveMedicalBtn.innerText = "圖片上傳中...";
                const reader = new FileReader();
                reader.onload = function(e) {
                    const base64Data = e.target.result.split(',')[1]; 
                    sendData(base64Data, file.name, file.type);
                };
                reader.readAsDataURL(file);
            } else { sendData(); }
        });
    }

    const timeBtns = document.querySelectorAll('.time-btn');
    timeBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            timeBtns.forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');
        });
    });

    const fileInput = document.getElementById('reportFile');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    if(fileInput && fileNameDisplay) {
        fileInput.addEventListener('change', function(e) {
            if (this.files && this.files.length > 0) {
                fileNameDisplay.textContent = "✓ 已選擇：" + this.files[0].name;
                fileNameDisplay.style.display = 'block';
            } else {
                fileNameDisplay.style.display = 'none';
            }
        });
    }
});