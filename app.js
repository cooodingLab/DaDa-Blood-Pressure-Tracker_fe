// app.js

let globalRecords = [];
let myChart = null;

// --- 輔助函式：取得本地端今天的日期字串 ---
function getTodayString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// --- 輔助函式：判斷血壓狀態 ---
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

// --- 輔助函式：渲染統計區塊 (避免重複代碼) ---
function renderSummaryBlock(container, sbpSum, dbpSum, count) {
    if (count === 0) return;
    const finalAvgSbp = Math.round(sbpSum / count);
    const finalAvgDbp = Math.round(dbpSum / count);

    const div = document.createElement('li');
    div.className = 'average-summary-block';
    div.innerHTML = `
        <span class="average-summary-icon">💡</span>
        <div>
            前 6 天的血壓平均值為：<br>
            收縮壓/舒張壓 <span style="color:#d32f2f; font-size:1.2rem;">${finalAvgSbp}</span> / <span style="color:#d32f2f; font-size:1.2rem;">${finalAvgDbp}</span> mmHg
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
    
    if (sectionId === 'hero' || sectionId === 'login') {
        if(navLinksContainer) navLinksContainer.style.display = 'none';
        if(hamburger) hamburger.style.display = 'none';
    } else {
        if(navLinksContainer) navLinksContainer.style.display = ''; 
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

function handleLogout() {
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

function loadDashboardData() {
    const chartWrapper = document.querySelector('.chart-wrapper');
    const chartEmpty = document.getElementById('chartEmptyState');
    const canvas = document.getElementById('bpChart');

    fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'getBloodRecords', userId: 'admin-user-001' })
    })
    .then(res => res.json())
    .then(response => {
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
    })
    .catch(err => console.error(err));
}

function loadHistoryData() {
    fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'getBloodRecords', userId: 'admin-user-001' })
    })
    .then(res => res.json())
    .then(response => {
        if (response.success) {
            globalRecords = response.data;
            renderHistoryList(globalRecords);
        }
    })
    .catch(err => console.error(err));
}

function loadMedicalData() {
    fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'getMedicalRecords', userId: 'admin-user-001' })
    })
    .then(res => res.json())
    .then(response => {
        if (response.success) {
            renderMedicalList(response.data);
        }
    })
    .catch(err => console.error(err));
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
        records.slice(0, 10).forEach(record => {
            const li = createRecordListItem(record);
            listContainer.appendChild(li);
        });
    }
}

// ★★★ 修改：歷史列表 - 每 6 天計算一次平均 ★★★
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
        
        // 確保資料是依照日期由新到舊排序
        records.sort((a, b) => Number(b.date) - Number(a.date));

        let anchorDate = null; // 當前批次的基準日期 (最新的那天)
        let batchSbp = 0, batchDbp = 0, batchCount = 0;

        records.forEach(record => {
            const currentTimestamp = Number(record.date);
            const currentDate = new Date(currentTimestamp);

            // 如果是第一筆，設定為錨點日期
            if (!anchorDate) anchorDate = currentDate;

            // 計算與錨點日期的差距天數
            // 忽略時分秒，只比較日期
            const d1 = new Date(anchorDate); d1.setHours(0,0,0,0);
            const d2 = new Date(currentDate); d2.setHours(0,0,0,0);
            const diffTime = Math.abs(d1 - d2);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // 如果差距超過 6 天 (0~5 是同一組，>=6 是下一組)
            // 這裡的邏輯是：當發現這筆資料「太舊了」，就先結算「上一組」的平均值
            if (diffDays >= 6) {
                // 渲染上一組的統計區塊
                if (batchCount > 0) {
                    renderSummaryBlock(listContainer, batchSbp, batchDbp, batchCount);
                }
                // 重置計數器，準備開始新的一組
                anchorDate = currentDate;
                batchSbp = 0; batchDbp = 0; batchCount = 0;
            }

            // 渲染當前紀錄
            const li = createRecordListItem(record);
            listContainer.appendChild(li);

            // 累加數值 (處理單筆紀錄內可能有兩次測量)
            let sbp = Number(record.sbp_1);
            let dbp = Number(record.dbp_1);
            let count = 1;
            if (record.sbp_2 && Number(record.sbp_2) > 0) {
                sbp += Number(record.sbp_2);
                dbp += Number(record.dbp_2);
                count++;
            }
            batchSbp += (sbp / count);
            batchDbp += (dbp / count);
            batchCount++;
        });

        // 迴圈結束後，如果還有未結算的資料 (最後一組)，要補上統計
        if (batchCount > 0) {
            renderSummaryBlock(listContainer, batchSbp, batchDbp, batchCount);
        }
    }
}

function createRecordListItem(record) {
    const sbp = record.sbp_1;
    const dbp = record.dbp_1;
    let statusClass = determineBpStatus(sbp, dbp);
    const timestamp = Number(record.date);
    let displayDate = new Date(timestamp).toISOString().split('T')[0];
    const timeLabel = record.time_slot === 'morning' ? '早上' : '晚上';
    const li = document.createElement('li');
    li.className = 'record-item';
    li.innerHTML = `
        <div class="record-left">
            <div class="record-date"><span class="status-light ${statusClass}"></span>${displayDate} ${timeLabel}</div>
            <div class="record-values">${sbp} / ${dbp} <span class="record-unit">mmHg</span></div>
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
    const timestamp = Number(record.date);
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

window.addEventListener('load', () => {
    const hash = window.location.hash.substring(1);
    if(hash) { navigateTo(hash); } else { navigateTo('hero'); }

    const dateInput = document.getElementById('recordDate');
    if(dateInput) dateInput.value = getTodayString();

    const medicalDateInput = document.getElementById('medicalDate');
    if(medicalDateInput) medicalDateInput.value = getTodayString();

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
            const submitBtn = loginForm.querySelector('button');
            if (!username || !password) { 
                Swal.fire('提示', '請輸入帳號和密碼才能解鎖喔！', 'warning');
                return; 
            }
            submitBtn.innerText = "驗證中...";
            submitBtn.disabled = true;
            fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'login', username: username, password: password })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) { 
                    Swal.fire({
                        icon: 'success',
                        title: '登入成功',
                        text: '歡迎回來！',
                        timer: 1500,
                        showConfirmButton: false
                    }).then(() => {
                        navigateTo('dashboard');
                        inputs[1].value = ''; 
                    });
                } 
                else { Swal.fire('登入失敗', data.message, 'error'); }
            })
            .catch(err => Swal.fire('錯誤', '連線發生問題', 'error'))
            .finally(() => { submitBtn.innerText = "解鎖我的健康紀錄"; submitBtn.disabled = false; });
        });
    }

    const recordForm = document.getElementById('recordForm');
    const saveRecordBtn = document.getElementById('saveRecordBtn');
    if (saveRecordBtn) {
        saveRecordBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const recordId = document.getElementById('recordId').value;
            const dateStr = document.getElementById('recordDate').value;
            const timestamp = new Date(dateStr).getTime();
            const timeSlotBtn = document.querySelector('.time-btn.selected');
            const timeSlotText = timeSlotBtn ? timeSlotBtn.innerText : '早上';
            const timeSlot = timeSlotText.includes('晚') ? 'evening' : 'morning';
            const sbp_1 = document.getElementById('sbp_1').value;
            const dbp_1 = document.getElementById('dbp_1').value;
            const pulse_1 = document.getElementById('pulse_1').value;
            const sbp_2 = document.getElementById('sbp_2').value;
            const dbp_2 = document.getElementById('dbp_2').value;
            const pulse_2 = document.getElementById('pulse_2').value;
            if (!sbp_1 || !dbp_1) { Swal.fire('提示', '請至少填寫第一次測量的血壓數值喔！', 'warning'); return; }
            const originalText = saveRecordBtn.innerText;
            saveRecordBtn.innerText = "儲存中...";
            saveRecordBtn.disabled = true;
            const action = recordId ? 'updateBloodRecord' : 'addBloodRecord';
            fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: action, userId: 'admin-user-001', id: recordId, date: timestamp, time_slot: timeSlot,
                    sbp_1: sbp_1, dbp_1: dbp_1, pulse_1: pulse_1, sbp_2: sbp_2, dbp_2: dbp_2, pulse_2: pulse_2
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    showToast('success', '紀錄已儲存！');
                    recordForm.reset();
                    document.getElementById('recordId').value = ''; 
                    document.getElementById('recordFormTitle').innerText = "建立新紀錄";
                    saveRecordBtn.innerText = "確定建立 ✓";
                    document.getElementById('recordDate').value = getTodayString();
                    navigateTo('dashboard');
                } else { Swal.fire('失敗', data.message, 'error'); }
            })
            .catch(err => Swal.fire('錯誤', '連線發生問題', 'error'))
            .finally(() => { saveRecordBtn.innerText = document.getElementById('recordId').value ? "儲存修改 ✓" : "確定建立 ✓"; saveRecordBtn.disabled = false; });
        });
    }

    const medicalForm = document.getElementById('medicalForm');
    const saveMedicalBtn = document.getElementById('saveMedicalBtn');
    if(saveMedicalBtn) {
        saveMedicalBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const dateStr = document.getElementById('medicalDate').value;
            if(!dateStr) { Swal.fire('提示', '請選擇檢查日期！', 'warning'); return; }
            const timestamp = new Date(dateStr).getTime();
            
            const fileInput = document.getElementById('reportFile');
            const file = fileInput.files[0];

            const originalText = saveMedicalBtn.innerText;
            saveMedicalBtn.innerText = "處理中...";
            saveMedicalBtn.disabled = true;

            const sendData = (fileData = null, fileName = null, mimeType = null) => {
                fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({
                        action: 'addMedicalRecord', userId: 'admin-user-001', check_date: timestamp,
                        fileData: fileData, fileName: fileName, mimeType: mimeType
                    })
                })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        showToast('success', '就醫紀錄已儲存！');
                        loadMedicalData();
                        const fileNameDisplay = document.getElementById('fileNameDisplay');
                        if(fileNameDisplay) { fileNameDisplay.style.display = 'none'; fileNameDisplay.textContent = ''; }
                        if(fileInput) fileInput.value = '';
                        document.getElementById('medicalDate').value = getTodayString();
                    } else { Swal.fire('失敗', data.message, 'error'); }
                })
                .catch(err => Swal.fire('錯誤', '連線發生問題', 'error'))
                .finally(() => { saveMedicalBtn.innerText = originalText; saveMedicalBtn.disabled = false; });
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